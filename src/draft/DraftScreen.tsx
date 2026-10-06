import { PlayerCard, PlayerStats } from "../components/PlayerCard";
import { playerName } from "../data/playerPresentation";
import { statsMode } from "../storage/statsMode";
/**
 * src/draft/DraftScreen.tsx
 *
 * SolidJS draft screen: speed preset selector + 5-round candidate pick (DRFT-01, DRFT-03).
 *
 * Design decisions applied (02-CONTEXT.md):
 *   D-05: round flow 5→4→3→2→1; picking a role locks it and draws fresh candidates next round
 *   D-06: personId de-duplicated within a round (enforced in generateRound)
 *   D-07: rival roster uses weighted-random BotTeamBuilder (higher strength → more likely)
 *   D-08: DraftScreen references RivalInterface type, not BotTeamBuilder directly
 *   D-09: speed preset is the pre-match choice (4 options, default "Rápido ~30s")
 *
 * UI-SPEC: all copy in pt-BR; class= not className; signals called as functions.
 * Threat model T-02-02: player/trait strings rendered via {value} JSX only — no innerHTML.
 *
 * NOT included (Phase 4 scope): champion portraits, win-prob bar, in-game speed controls.
 */

import { createSignal, For, Show } from "solid-js";
import type { PlayerVersion, Role } from "../data/schema";
import { generateRound, ALL_ROLES } from "./orchestrator";
import type { RoundCandidates, Roster } from "./types";
import { BotTeamBuilder } from "./BotTeamBuilder";
import type { RivalInterface } from "./RivalInterface";
import { mulberry32, seedFromString } from "../sim/rng";
import { ROLE_LABELS } from "./hints";

// ---------------------------------------------------------------------------
// SpeedPreset — pre-match timing choice (D-09)
// ---------------------------------------------------------------------------

export type SpeedPreset = "super_fast" | "fast" | "slow" | "super_slow";

const SPEED_PRESET_OPTIONS: { value: SpeedPreset; label: string }[] = [
  { value: "super_fast", label: "Super rápido ~15s" },
  { value: "fast", label: "Rápido ~30s" },
  { value: "slow", label: "Devagar ~60s" },
  { value: "super_slow", label: "Super devagar ~90s" },
];

// Derive rival seed from draft seed (Pitfall 5: per-rival seed derivation)
const RIVAL_SEED_OFFSET = 0x9e3779b9;

// ROLE_LABELS / trait labels now live in ./hints (shared with hint derivation).

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DraftScreenProps {
  players: PlayerVersion[];
  /**
   * Called when the user has picked all 5 roles, designated a captain, and the
   * rival roster is ready. `captainPersonId` is the personId of the chosen captain
   * (Feature 3b — always one of the 5 picked players).
   */
  onDraftComplete: (
    userRoster: Roster,
    rivalRoster: Roster,
    speedPreset: SpeedPreset,
    captainPersonId: string
  ) => void;
  /** Optional rival implementation (defaults to BotTeamBuilder); injectable for testing. */
  rival?: RivalInterface;
  /** Optional seed for deterministic drafting (defaults to timestamp-based). */
  draftSeed?: number;
  /**
   * Championship-creation choice: when false the draft hides the revealed numeric
   * attributes (lane/mid/late) so players pick on intuition + public hints only.
   * Defaults to true (reveal after pick) for back-compat with existing callers/tests.
   */
  showStats?: boolean;
}

// ---------------------------------------------------------------------------
// DraftScreen component
// ---------------------------------------------------------------------------

export function DraftScreen(props: DraftScreenProps) {
  const draftSeed = props.draftSeed ?? seedFromString(`draft-${Date.now()}`);
  const rival: RivalInterface = props.rival ?? new BotTeamBuilder();

  // Championship-creation choice: reveal numbers after a pick, or run on intuition.
  // Defaults to true so existing callers/tests that omit the prop keep showing stats.
  const mode = () => props.showStats === false ? "never" : statsMode();

  // Pre-draft speed selection (D-09)
  const [speedPreset, setSpeedPreset] = createSignal<SpeedPreset>("fast");
  const [draftStarted, setDraftStarted] = createSignal(false);

  // Draft state signals
  const [round, setRound] = createSignal(1);
  const [filledRoles, setFilledRoles] = createSignal<Set<Role>>(new Set());
  const [usedPersonIds, setUsedPersonIds] = createSignal<Set<string>>(new Set());
  const [roster, setRoster] = createSignal<Partial<Record<Role, PlayerVersion>>>({});
  const [candidates, setCandidates] = createSignal<RoundCandidates>({});
  const [justPickedRole, setJustPickedRole] = createSignal<Role | null>(null);
  // Captain step (Feature 3b): once all 5 roles are picked, we hold the built
  // rosters here and show a completed-roster panel where the user designates ONE
  // of the 5 players as captain (⭐) before confirming.
  const [completedRoster, setCompletedRoster] = createSignal<Roster | null>(null);
  const [pendingRivalRoster, setPendingRivalRoster] = createSignal<Roster | null>(null);
  const [captainPersonId, setCaptainPersonId] = createSignal<string | null>(null);
  // DRFT soft-discard: every card SHOWN to the user, so later rounds prefer
  // fresh cards and the non-picked candidates of a round don't reappear next.
  const [seenCardIds, setSeenCardIds] = createSignal<Set<string>>(new Set());

  /** Add all candidate card ids of a round to the seen set (returns a new Set). */
  function recordSeen(prev: Set<string>, round: RoundCandidates): Set<string> {
    const next = new Set(prev);
    for (const candidate of Object.values(round)) {
      if (candidate) next.add(candidate.id);
    }
    return next;
  }

  // Generate the first round's candidates
  function startDraft() {
    const rng = mulberry32(draftSeed ^ round());
    const newCandidates = generateRound(props.players, new Set(), new Set(), rng);
    setSeenCardIds((prev) => recordSeen(prev, newCandidates));
    setCandidates(newCandidates);
    setDraftStarted(true);
  }

  // Handle the user picking a candidate for a role
  function pickCandidate(role: Role, player: PlayerVersion) {
    // Lock the role and record the personId
    const newFilledRoles = new Set(filledRoles());
    newFilledRoles.add(role);
    const newUsedPersonIds = new Set(usedPersonIds());
    newUsedPersonIds.add(player.personId);
    const newRoster = { ...roster(), [role]: player };

    setFilledRoles(newFilledRoles);
    setUsedPersonIds(newUsedPersonIds);
    setRoster(newRoster);
    setJustPickedRole(role);

    if (newFilledRoles.size === 5) {
      // All 5 roles picked — build the rival roster now, then stage the captain
      // designation step (Feature 3b). We do NOT call onDraftComplete yet; the
      // user must pick a captain on the completed-roster panel first.
      const rivalSeed = (draftSeed ^ RIVAL_SEED_OFFSET) >>> 0;
      const rivalRoster = rival.buildRoster(
        props.players,
        rivalSeed,
        newUsedPersonIds // (D-04: rival may use the same person but D-03 allows it for bots)
        // Per CONTEXT.md D-03/D-04: bot team may field a different version of the same person
        // so we pass an empty exclusion (rivals have independent pools). Pass empty set.
      );
      const completeRoster = newRoster as Roster;
      setPendingRivalRoster(rivalRoster);
      setCompletedRoster(completeRoster);
      // Default the captain to the mid-laner (a sensible LoL shotcaller default).
      setCaptainPersonId(completeRoster.mid.personId);
      return;
    }

    // Advance to next round with fresh candidates for remaining open roles.
    // The non-picked candidates of THIS round are already in seenCardIds, so the
    // soft-discard in generateRound keeps them out of the next round while the
    // role still has unseen cards (DRFT).
    const nextRound = round() + 1;
    setRound(nextRound);
    // Use a round-specific seed so each round's draw is different
    const rng = mulberry32(draftSeed ^ nextRound);
    const newCandidates = generateRound(
      props.players,
      newFilledRoles,
      newUsedPersonIds,
      rng,
      seenCardIds()
    );
    setSeenCardIds((prev) => recordSeen(prev, newCandidates));
    setCandidates(newCandidates);
    setJustPickedRole(null);
  }

  // Open roles for the current round
  function openRoles(): Role[] {
    return ALL_ROLES.filter((r) => !filledRoles().has(r));
  }

  // Compute the round header "escolha um {role}" — first open role name
  function currentRoleLabel(): string {
    const open = openRoles();
    return open.length > 0 ? ROLE_LABELS[open[0]] : "";
  }

  // Confirm the completed roster + captain choice and hand off to App (Feature 3b).
  function confirmDraft() {
    const userRoster = completedRoster();
    const rivalRoster = pendingRivalRoster();
    const captain = captainPersonId();
    if (!userRoster || !rivalRoster || !captain) return;
    props.onDraftComplete(userRoster, rivalRoster, speedPreset(), captain);
  }

  return (
    <div class="draft-screen" aria-label="Tela de draft">
      {/* ----------------------------------------------------------------- */}
      {/* Speed preset selector (D-09) — shown before draft starts          */}
      {/* ----------------------------------------------------------------- */}
      <Show when={!draftStarted()}>
        <div class="pre-draft">
          <h1 class="draft-title">Monte seu time</h1>

          <div class="speed-preset-section" aria-label="Velocidade da partida">
            <p class="speed-preset-label">Velocidade da partida</p>
            <div class="speed-preset-row" role="group" aria-label="Escolha a velocidade">
              <For each={SPEED_PRESET_OPTIONS}>
                {(option) => (
                  <button
                    class={`speed-btn${speedPreset() === option.value ? " speed-btn--selected" : ""}`}
                    aria-pressed={speedPreset() === option.value}
                    onClick={() => setSpeedPreset(option.value)}
                  >
                    {option.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <button class="start-draft-btn" onClick={startDraft}>
            Iniciar draft
          </button>
        </div>
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Draft rounds                                                       */}
      {/* ----------------------------------------------------------------- */}
      <Show when={draftStarted() && !completedRoster()}>
        {/* Round header */}
        <div class="round-header">
          <h2 class="round-title">
            Rodada {round()} de 5 · escolha um{" "}
            <span class="round-role-highlight">{currentRoleLabel()}</span>
          </h2>
          {/* Team tray — picked cards shown in their position (Top, JGL, Mid…). */}
          <div class="role-slots" aria-label="Seu time por rota">
            <For each={ALL_ROLES}>
              {(role) => {
                // Reactive accessor — `<For each={ALL_ROLES}>` runs this body ONCE
                // (the array never changes), so a plain `const picked = roster()[role]`
                // would be captured empty forever. Reading roster() lazily inside JSX
                // is what makes each slot fill in as picks are locked (DRFT).
                const picked = () => roster()[role];
                return (
                  <div
                    class={`role-slot${picked() ? " role-slot--filled" : ""}`}
                    aria-label={
                      picked()
                        ? `Rota ${ROLE_LABELS[role]}: ${playerName(picked()!)} escolhido`
                        : `Rota ${ROLE_LABELS[role]}: vazia`
                    }
                  >
                    <span class="role-slot-label">{ROLE_LABELS[role]}</span>
                    {/* Avatar — the picked card's face, or an empty placeholder so
                        the user always sees which positions are still open. */}
                    <div class="role-slot-avatar" aria-hidden="true">
                      <Show
                        when={picked()?.photo}
                        fallback={<span class="role-slot-avatar-empty">{ROLE_LABELS[role]}</span>}
                      >
                        <img
                          class="role-slot-photo"
                          src={picked()!.photo}
                          alt={playerName(picked()!)}
                        />
                      </Show>
                    </div>
                    <Show
                      when={picked()}
                      fallback={<span class="role-slot-empty-text">Vazio</span>}
                    >
                      <span class="role-slot-player">{playerName(picked()!)}</span>
                      {/* Reveal-after-pick: full numeric stats become visible
                          only once the card is locked into the roster (DRFT) AND
                          the creator left stats visible (intuition mode hides them). */}
                      <span class="player-card__year">{picked()!.year}</span><PlayerStats player={picked()!} mode={mode()} picked />
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Candidate cards grid */}
        <div class="candidates-grid">
          <For each={openRoles()}>
            {(role) => {
              // Reactive accessors — a still-open role keeps the SAME For item
              // across rounds, so reading candidates() lazily (not once) is what
              // makes the card refresh when a new round is drawn.
              const candidate = () => candidates()[role];
              const isJustPicked = () => justPickedRole() === role;

              return (
                <Show
                  when={candidate()}
                  keyed
                  fallback={
                    <div class="draft-card draft-card--empty" aria-label={`Sem candidatos para ${ROLE_LABELS[role]}`}>
                      <p class="empty-state-heading">Sem candidatos disponíveis</p>
                      <p class="empty-state-body">
                        O arquivo players.json não tem jogadores suficientes para a rota{" "}
                        {ROLE_LABELS[role]}. Adicione pelo menos 1 card de {role} para continuar.
                      </p>
                    </div>
                  }
                >
                  {(cand) => {
                    // `keyed` re-runs this block with the NEW card whenever the
                    // round redraws — so hints recompute and the card refreshes.

                    return (
                      <div
                        class={`draft-card${isJustPicked() ? " draft-card--picked" : ""}`}
                        aria-label={`Candidato ${playerName(cand)} para ${ROLE_LABELS[role]}`}
                      >
                        <PlayerCard player={cand} mode={mode()} />

                        <Show
                          when={!isJustPicked()}
                          fallback={
                            <span class="picked-confirmation" aria-live="polite">
                              Escolhido ✓
                            </span>
                          }
                        >
                          <button
                            class="pick-btn"
                            aria-label={`Escolher ${playerName(cand)} para ${ROLE_LABELS[role]}`}
                            onClick={() => pickCandidate(role, cand)}
                          >
                            Escolher
                          </button>
                        </Show>
                      </div>
                    );
                  }}
                </Show>
              );
            }}
          </For>
        </div>
      </Show>

      {/* ----------------------------------------------------------------- */}
      {/* Captain designation step (Feature 3b) — completed-roster panel      */}
      {/* Shown once all 5 roles are picked; the user clicks the ⭐ on one     */}
      {/* player to make them captain (exactly one), then confirms.           */}
      {/* ----------------------------------------------------------------- */}
      <Show when={completedRoster()} keyed>
        {(finalRoster) => (
          <div class="captain-panel" aria-label="Escolha o capitão do time">
            <h2 class="captain-panel-title">Escolha o capitão do time</h2>
            <p class="captain-panel-hint">
              Toque na estrela para definir o capitão. O capitão influencia o time
              na simulação.
            </p>
            <div class="captain-roster" role="group" aria-label="Jogadores do time">
              <For each={ALL_ROLES}>
                {(role) => {
                  const player = finalRoster[role];
                  const isCaptain = () =>
                    captainPersonId() === player.personId;
                  return (
                    <div
                      class={`captain-card${isCaptain() ? " captain-card--captain" : ""}`}
                    >
                      <span class="captain-card-role">{ROLE_LABELS[role]}</span>
                      <span class="captain-card-name">
                        {playerName(player)}
                        <Show when={isCaptain()}>
                          <span class="captain-badge" aria-hidden="true">
                            {" "}
                            ⭐
                          </span>
                        </Show>
                      </span>
                      <button
                        type="button"
                        class={`captain-toggle${isCaptain() ? " captain-toggle--on" : ""}`}
                        aria-pressed={isCaptain()}
                        aria-label={
                          isCaptain()
                            ? `${playerName(player)} é o capitão`
                            : `Definir ${playerName(player)} como capitão`
                        }
                        onClick={() => setCaptainPersonId(player.personId)}
                      >
                        ⭐
                      </button>
                    </div>
                  );
                }}
              </For>
            </div>
            <button
              type="button"
              class="confirm-draft-btn"
              disabled={!captainPersonId()}
              onClick={confirmDraft}
            >
              Confirmar time
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}
