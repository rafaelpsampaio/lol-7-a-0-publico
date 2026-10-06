/**
 * src/components/ChampionEditor.tsx
 *
 * Champion-trait editor (D-03): renders the loaded champion catalogue as a
 * table — one row per champion — and lets the user override each champion's
 * traits (0–2 from the 5-value ChampionTrait set). Edits are written to the
 * persisted `championOverrides` store (src/storage/championOverrides.ts) and
 * later merged over the catalogue via `mergeOverrides` in App.tsx, so the edits
 * actually drive `runMatch`.
 *
 * Trait selection is capped at 2 per champion (matching ChampionEntrySchema's
 * `traits.max(2)`): once two checkboxes are ticked, the remaining boxes are
 * disabled until one is unticked.
 *
 * No UI-SPEC this phase (planned with --skip-ui) — a plain table with checkboxes
 * and no extra chrome. Trait strings are rendered via {value} JSX only (no
 * innerHTML) — T-02-02 carry-over.
 *
 * SolidJS conventions: class= (not className); signals called as functions.
 */

import { createResource, For, Show } from "solid-js";
import { loadChampions } from "../data/loader";
import { ChampionTraitSchema, type ChampionTrait } from "../data/schema";
import {
  championOverrides,
  setChampionOverrides,
} from "../storage/championOverrides";

/** The 5-value champion-trait catalogue (D-04), straight from the Zod enum. */
const ALL_CHAMPION_TRAITS: ChampionTrait[] = ChampionTraitSchema.options;

/** pt-BR display labels for the 5 champion traits. */
const TRAIT_LABELS: Record<ChampionTrait, string> = {
  high_first_blood: "First blood alto",
  objective_control: "Controle de objetivos",
  late_scaling: "Escala bem (late)",
  early_dominant: "Domina early",
  teamfight: "Teamfight",
};

const MAX_TRAITS = 2;

/**
 * Returns the currently effective traits for a champion: the override if one
 * exists, otherwise the catalogue's own traits.
 */
function effectiveTraits(
  championId: string,
  catalogueTraits: ChampionTrait[]
): ChampionTrait[] {
  return championOverrides[championId] ?? catalogueTraits;
}

/**
 * Toggle a trait for a champion, capped at MAX_TRAITS. Writes the new trait list
 * to the persisted override store (D-03). Adding a trait at the cap is a no-op.
 */
function toggleTrait(
  championId: string,
  catalogueTraits: ChampionTrait[],
  trait: ChampionTrait,
  checked: boolean
) {
  const current = effectiveTraits(championId, catalogueTraits);
  let next: ChampionTrait[];
  if (checked) {
    if (current.includes(trait)) return;
    if (current.length >= MAX_TRAITS) return; // cap enforced
    next = [...current, trait];
  } else {
    next = current.filter((t) => t !== trait);
  }
  setChampionOverrides(championId, next);
}

/**
 * Champion-trait editor table (D-03). Loads the catalogue once via a resource;
 * each row exposes the 5 trait checkboxes, capped at 2 ticked.
 */
export function ChampionEditor() {
  const [champions] = createResource(() => loadChampions());

  return (
    <div class="champion-editor">
      <h2 class="champion-editor__title">Editor de traços de campeão</h2>

      <Show when={champions.error}>
        <div class="champion-editor__error" role="alert">
          Erro ao carregar os campeões. Verifique o arquivo champions.json.
        </div>
      </Show>

      <Show when={champions()} fallback={<p>Carregando campeões…</p>}>
        <table class="champion-editor__table">
          <thead>
            <tr>
              <th>Campeão</th>
              <For each={ALL_CHAMPION_TRAITS}>
                {(trait) => <th>{TRAIT_LABELS[trait]}</th>}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={champions()}>
              {(champion) => {
                const traits = () =>
                  effectiveTraits(champion.id, champion.traits);
                const atCap = () => traits().length >= MAX_TRAITS;
                return (
                  <tr>
                    <td class="champion-editor__name">{champion.name}</td>
                    <For each={ALL_CHAMPION_TRAITS}>
                      {(trait) => {
                        const isOn = () => traits().includes(trait);
                        return (
                          <td>
                            <input
                              type="checkbox"
                              checked={isOn()}
                              disabled={!isOn() && atCap()}
                              aria-label={`${champion.name}: ${TRAIT_LABELS[trait]}`}
                              onChange={(e) =>
                                toggleTrait(
                                  champion.id,
                                  champion.traits,
                                  trait,
                                  e.currentTarget.checked
                                )
                              }
                            />
                          </td>
                        );
                      }}
                    </For>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
