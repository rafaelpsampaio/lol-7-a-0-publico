/**
 * src/tournament/BracketView.tsx
 *
 * Tournament bracket hub — shows all 14 slots organized into rounds.
 * Active series (user's current match) is highlighted in accent.
 * Bot results auto-fill instantly when the user advances.
 *
 * Layout: Chave Superior (upper bracket) + Chave Inferior (lower bracket) +
 * Grande Final — scroll on mobile, two-panel >= 768px.
 *
 * UI-SPEC Screen 2 / Accessibility: aria-live on update region.
 * SolidJS conventions: class= not className; <For> for lists.
 */

import { For } from "solid-js";
import type { TournamentState, SlotId } from "./schema";
import { BracketNode } from "./BracketNode";

// ---------------------------------------------------------------------------
// Slot groupings for display
// ---------------------------------------------------------------------------

const UPPER_BRACKET_ROUNDS: { label: string; slots: SlotId[] }[] = [
  { label: "Quartas · Chave Superior", slots: ["UB_QF_1", "UB_QF_2", "UB_QF_3", "UB_QF_4"] },
  { label: "Semis · Chave Superior", slots: ["UB_SF_1", "UB_SF_2"] },
  { label: "Final · Chave Superior", slots: ["UB_F"] },
];

const LOWER_BRACKET_ROUNDS: { label: string; slots: SlotId[] }[] = [
  { label: "Rodada 1 · Chave Inferior", slots: ["LB_R1_1", "LB_R1_2"] },
  { label: "Rodada 2 · Chave Inferior", slots: ["LB_R2_1", "LB_R2_2"] },
  { label: "Semis · Chave Inferior", slots: ["LB_SF"] },
  { label: "Final · Chave Inferior", slots: ["LB_F"] },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  state: TournamentState;
  onStartSeries: (slotId: SlotId) => void;
  onReplaySeries: (slotId: SlotId, gameIndex: number) => void;
}

// ---------------------------------------------------------------------------
// BracketView component
// ---------------------------------------------------------------------------

export function BracketView(props: Props) {
  /** Find the user's next "ready" slot — the active slot or first ready user slot */
  function getActiveSlotId(): SlotId | null {
    // Use explicitly set activeSlotId first
    if (props.state.activeSlotId) return props.state.activeSlotId;
    // Otherwise find the first ready slot containing the user team
    for (const [slotId, slot] of Object.entries(props.state.slots) as [SlotId, typeof props.state.slots[SlotId]][]) {
      const s = slot.series;
      if (
        s.status === "ready" &&
        (s.teamAId === props.state.userTeamId || s.teamBId === props.state.userTeamId)
      ) {
        return slotId;
      }
    }
    return null;
  }

  const activeSlotId = () => getActiveSlotId();

  function isUserSlot(slotId: SlotId): boolean {
    const series = props.state.slots[slotId]?.series;
    if (!series) return false;
    return (
      series.teamAId === props.state.userTeamId ||
      series.teamBId === props.state.userTeamId
    );
  }

  function renderRound(round: { label: string; slots: SlotId[] }) {
    return (
      <div class="bracket-round">
        <h3 class="bracket-round__label">{round.label}</h3>
        <div class="bracket-round__slots">
          <For each={round.slots}>
            {(slotId) => (
              <BracketNode
                slot={props.state.slots[slotId]!}
                teams={props.state.teams}
                isActive={activeSlotId() === slotId}
                isUserSlot={isUserSlot(slotId)}
                onStart={() => props.onStartSeries(slotId)}
                onReplay={() => props.onReplaySeries(slotId, 0)}
              />
            )}
          </For>
        </div>
      </div>
    );
  }

  return (
    <div class="bracket-view" aria-live="polite" aria-label="Chaveamento do torneio">
      <h2 class="bracket-view__title">Chaveamento</h2>

      {/* Upper bracket */}
      <section class="bracket-section" aria-label="Chave Superior">
        <h3 class="bracket-section__heading">Chave Superior</h3>
        <div class="bracket-section__rounds">
          <For each={UPPER_BRACKET_ROUNDS}>
            {(round) => renderRound(round)}
          </For>
        </div>
      </section>

      {/* Lower bracket */}
      <section class="bracket-section" aria-label="Chave Inferior">
        <h3 class="bracket-section__heading">Chave Inferior</h3>
        <p>Mesmo perdendo a primeira série, seu time pode vencer a lower e ser campeão.</p>
        <div class="bracket-section__rounds">
          <For each={LOWER_BRACKET_ROUNDS}>
            {(round) => renderRound(round)}
          </For>
        </div>
      </section>

      {/* Grand Final */}
      <section class="bracket-section" aria-label="Grande Final">
        <h3 class="bracket-section__heading">Grande Final</h3>
        <div class="bracket-section__rounds">
          <div class="bracket-round">
            <BracketNode
              slot={props.state.slots["GF"]!}
              teams={props.state.teams}
              isActive={activeSlotId() === "GF"}
              isUserSlot={isUserSlot("GF")}
              onStart={() => props.onStartSeries("GF")}
              onReplay={() => props.onReplaySeries("GF", 0)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
