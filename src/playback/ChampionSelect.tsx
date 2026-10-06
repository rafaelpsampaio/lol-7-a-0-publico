import { playerName } from "../data/playerPresentation";
/**
 * src/playback/ChampionSelect.tsx
 *
 * Animated champion-select intro shown before each Bo5 game. Reveals the fearless
 * champion assignments one slot at a time (LoL pick-and-ban feel) — portrait
 * flips in + locks, role by role, blue (you) vs red (rival) — then auto-advances
 * to the live match. A "Pular" button skips straight to playback.
 */

import { createSignal, createMemo, onCleanup, For, Show } from "solid-js";
import type { PlayerVersion, ChampionEntry, Role } from "../data/schema";
import { labelCompProfileFromChampions } from "../sim/teamComp";

interface Props {
  userRoster: PlayerVersion[];
  rivalRoster: PlayerVersion[];
  userChampions: Record<string, string>;
  rivalChampions: Record<string, string>;
  catalogue: ChampionEntry[];
  userTeamName: string;
  rivalTeamName: string;
  userTeamTag: string;
  rivalTeamTag: string;
  /** Esconde o botão "Pular" quando `false` (padrão `true`). Usado pela sala
   * em modo sincronizado (Fase 3): lá pular é decisão do host, forçada para
   * todo mundo via servidor — não uma escolha individual de quem assiste. */
  canSkip?: boolean;
  onComplete: () => void;
}

const ROLES: Role[] = ["top", "jungle", "mid", "adc", "support"];
const ROLE_LABEL: Record<Role, string> = {
  top: "TOPO", jungle: "CAÇADOR", mid: "MEIO", adc: "ATIRADOR", support: "SUPORTE",
};

interface Pick {
  side: "user" | "rival";
  role: Role;
  player: string;
  champName: string;
  champImage?: string;
}

function shortName(p: PlayerVersion): string {
  return playerName(p);
}

function buildPicks(
  side: "user" | "rival",
  roster: PlayerVersion[],
  champions: Record<string, string>,
  byId: Map<string, ChampionEntry>
): Record<Role, Pick> {
  const out = {} as Record<Role, Pick>;
  for (const p of roster) {
    const e = champions[p.id] ? byId.get(champions[p.id]) : undefined;
    out[p.primaryRole] = {
      side,
      role: p.primaryRole,
      player: shortName(p),
      champName: e?.name ?? champions[p.id] ?? "Carregando",
      champImage: e?.image,
    };
  }
  return out;
}

export function ChampionSelect(props: Props) {
  const byId = createMemo(() => new Map(props.catalogue.map((c) => [c.id, c])));
  const userPicks = createMemo(() => buildPicks("user", props.userRoster, props.userChampions, byId()));
  const rivalPicks = createMemo(() => buildPicks("rival", props.rivalRoster, props.rivalChampions, byId()));

  // D-06: rotulo pt-BR de comp por time — derivado uma vez no setup (nao por frame).
  // Fonte unica: labelCompProfileFromChampions de teamComp.ts (nao reimplementa nada).
  // Comp neutra => string vazia => Show when=false => sem rotulo.
  const userComp = labelCompProfileFromChampions(props.userRoster, props.userChampions);
  const rivalComp = labelCompProfileFromChampions(props.rivalRoster, props.rivalChampions);

  // Reveal order: role by role, user then rival → 10 slots.
  const order = createMemo(() => ROLES.flatMap(r => [userPicks()[r], rivalPicks()[r]].filter(Boolean)));

  const [revealed, setRevealed] = createSignal(0);
  const REVEAL_MS = 420;

  const timer = setInterval(() => {
    setRevealed((n) => {
      const next = n + 1;
      if (next >= order().length) {
        clearInterval(timer);
        finishTimer = setTimeout(() => props.onComplete(), 900);
      }
      return next;
    });
  }, REVEAL_MS);
  let finishTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearInterval(timer);
    clearTimeout(finishTimer);
  });

  // Index of a pick within the global reveal order.
  const orderIndex = (side: "user" | "rival", role: Role) =>
    order().findIndex((p) => p.side === side && p.role === role);

  function skip() {
    clearInterval(timer);
    clearTimeout(finishTimer);
    props.onComplete();
  }

  const Slot = (p: { side: "user" | "rival"; role: Role }) => {
    const pick = () => (p.side === "user" ? userPicks() : rivalPicks())[p.role];
    const idx = orderIndex(p.side, p.role);
    const shown = () => idx >= 0 && revealed() > idx;
    return (
      <div class={`cs-slot cs-slot--${p.side}${shown() ? " cs-slot--revealed" : ""}`}>
        <Show
          when={pick()?.champImage && shown()}
          fallback={
            <div class="cs-portrait cs-portrait--empty">
              <span class="cs-role-ghost">{ROLE_LABEL[p.role][0]}</span>
            </div>
          }
        >
          <img class="cs-portrait" src={`/champions/${pick()!.champImage}`} alt={pick()!.champName} />
        </Show>
        <div class="cs-info">
          <span class="cs-role">{ROLE_LABEL[p.role]}</span>
          <span class="cs-player">{pick()?.player}</span>
          <span class="cs-champ">{shown() ? pick()?.champName : "-"}</span>
        </div>
      </div>
    );
  };

  return (
    <div class="champ-select" aria-label="Seleção de campeões">
      <div class="cs-header">
        <span class="cs-tag cs-tag--user">{props.userTeamTag}</span>
        <span class="cs-vs">SELEÇÃO DE CAMPEÕES</span>
        <span class="cs-tag cs-tag--rival">{props.rivalTeamTag}</span>
      </div>

      <div class="cs-board">
        <div class="cs-col cs-col--user">
          <Show when={userComp}>
            <div class="cs-comp-label cs-comp-label--user">{userComp}</div>
          </Show>
          <For each={ROLES}>{(role) => <Slot side="user" role={role} />}</For>
        </div>
        <div class="cs-center">
          <span class="cs-versus">VS</span>
        </div>
        <div class="cs-col cs-col--rival">
          <Show when={rivalComp}>
            <div class="cs-comp-label cs-comp-label--rival">{rivalComp}</div>
          </Show>
          <For each={ROLES}>{(role) => <Slot side="rival" role={role} />}</For>
        </div>
      </div>

      <Show when={props.canSkip ?? true}>
        <button class="cs-skip" onClick={skip}>Pular →</button>
      </Show>
    </div>
  );
}
