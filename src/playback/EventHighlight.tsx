/**
 * src/playback/EventHighlight.tsx
 *
 * Big centred banner that flashes on screen when something RELEVANT happens
 * (first blood, ace, pentakill, dragon soul, Baron/Elder, steals, Nexus exposed,
 * GG). It watches the latest reached event and auto-hides after a moment.
 *
 * pt-BR; text via {value} (no innerHTML); the colour follows the acting team.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import type { GameEvent } from "../sim/types";

interface Props {
  event: GameEvent | null;
}

/** Headline keyword for a relevant event kind, or null if not worth a banner. */
function headline(ev: GameEvent): string | null {
  // Dragon Soul is a dragon_taken whose ticker mentions "Alma".
  if (ev.ticker?.includes("Alma")) return "ALMA DO DRAGÃO";
  switch (ev.type) {
    case "first_blood": return "PRIMEIRO SANGUE";
    case "ace": return "ACE";
    case "penta_kill": return "PENTAKILL";
    case "quadra_kill": return "QUADRA KILL";
    case "triple_kill": return "TRIPLE KILL";
    case "baron_taken": return "BARÃO NASHOR";
    case "baron_steal": return "BARÃO ROUBADO!";
    case "elder_taken": return "DRAGÃO ANCIÃO";
    case "elder_steal": return "ANCIÃO ROUBADO!";
    case "dragon_steal": return "DRAGÃO ROUBADO!";
    case "nexus_exposed": return "NEXUS EXPOSTO";
    // Phase 28 (plano 28-04, D-03): destaque narrativo de zebra, adicao de
    // escopo declarada em 28-CONTEXT.md, fora dos quatro criterios do
    // ROADMAP.md. Posicionado junto dos demais desfechos de fim de partida,
    // imediatamente antes do case de "gg".
    case "upset_win": return "ZEBRA!";
    case "gg": return "FIM DE JOGO";
    default: return null;
  }
}

const STEAL_KINDS = new Set(["baron_steal", "elder_steal", "dragon_steal"]);

// Phase 28 (plano 28-04): tipos que ganham a classe modificadora de zebra,
// no mesmo padrao de STEAL_KINDS.
const UPSET_KINDS = new Set(["upset_win"]);

export function EventHighlight(props: Props) {
  const [shown, setShown] = createSignal<
    { word: string; ticker: string; team: string; steal: boolean; upset: boolean } | null
  >(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const ev = props.event;
    if (!ev) return;
    const word = headline(ev);
    if (!word) return;
    clearTimeout(timer);
    // Cuidado de sequencia (Phase 28, plano 28-04): o evento de zebra chega
    // IMEDIATAMENTE DEPOIS do evento de fim de jogo, e os dois tem o mesmo
    // instante de jogo (buildUpsetEvent herda timeSec/winProbUserAfter do
    // ultimo evento da timeline, ver src/sim/upset.ts). Este componente
    // mantem um UNICO banner por vez com temporizador de 2600 ms, entao o
    // banner de zebra, por chegar por ultimo, e o que fica na tela. Isso e
    // o comportamento DESEJADO (a zebra e a manchete, o fim de jogo e a
    // informacao de rotina) e nao deve ser tratado como bug de sobreposicao
    // por uma leitura futura.
    setShown({
      word,
      ticker: ev.ticker ?? "",
      team: ev.team,
      steal: STEAL_KINDS.has(ev.type),
      upset: UPSET_KINDS.has(ev.type),
    });
    timer = setTimeout(() => setShown(null), 2600);
  });

  onCleanup(() => clearTimeout(timer));

  return (
    <Show when={shown()}>
      {(s) => (
        <div
          class={`event-highlight event-highlight--${s().team}${s().steal ? " event-highlight--steal" : ""}${s().upset ? " event-highlight--upset" : ""}`}
          role="status"
          aria-live="assertive"
        >
          <div class="event-highlight-word">{s().word}</div>
          <Show when={s().ticker}>
            <div class="event-highlight-ticker">{s().ticker}</div>
          </Show>
        </div>
      )}
    </Show>
  );
}
