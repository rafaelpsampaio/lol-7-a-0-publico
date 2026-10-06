import { PlayerCard, PlayerStats } from "../components/PlayerCard";
import { playerName } from "../data/playerPresentation";
/**
 * src/room/RoomDraftScreen.tsx
 *
 * Draft da sala: a sua mao (privada), a vez de quem, e o que cada time ja
 * levou. Nao reaproveita a DraftScreen do jogo solo — aquele arquivo tem dono e
 * o fluxo aqui e outro: vez de cada um, baralho compartilhado, relogio.
 *
 * Fase 6 (docs/PLANO-EXPERIENCIA-SALA.md): visibilidade de turno e ritmo —
 * quem vem depois, aviso de escolha automatica, relogio urgente e toast de
 * picks recentes. Depende da Fase 8 (ordem fixa do draft, nao mais
 * serpentina) para "Proximo" poder ser calculado so com `order`+`turnIndex`,
 * sem inverter a cada volta.
 */

import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { RoomStore } from "../net/store";
import { ROLE_LABELS, ROLE_LONG_LABELS } from "../draft/hints";
import type { Role } from "../data/schema";
import type { DraftSeatWire, DraftWire } from "../../server/protocol";
import { DISCONNECTED_GRACE_SECONDS, PICKS_PER_SEAT } from "../../server/protocol";


const ROTAS: Role[] = ["top", "jungle", "mid", "adc", "support"];

interface RoomDraftScreenProps {
  store: RoomStore;
}



/**
 * Quem joga logo depois da vez atual — `order` e a mesma sequencia em toda
 * volta (Fase 8), entao basta andar uma posicao e voltar ao inicio no fim da
 * volta, sem saber se a volta e par ou impar. `null` quando a escolha atual
 * e a ultima do draft inteiro (nao ha proximo).
 */
export function proximoDaVez(draft: DraftWire): DraftSeatWire | null {
  if (draft.order.length === 0 || draft.turnIndex + 1 >= draft.totalTurns) return null;
  const indice = draft.order[(draft.turnIndex + 1) % draft.order.length];
  return indice === undefined ? null : (draft.seats[indice] ?? null);
}

/**
 * As escolhas novas entre dois snapshots de `seats`, na ordem em que os
 * assentos aparecem em `atual` — cobre tanto um pick manual quanto uma
 * sequencia de bots resolvida inteira num unico broadcast (o hub roda
 * #driveDraft antes de mandar o estado, Fase 6).
 */
export function picksNovos(
  anterior: DraftSeatWire[],
  atual: DraftSeatWire[]
): { teamName: string; cardName: string }[] {
  const antesPorIndice = new Map(anterior.map((s) => [s.index, s]));
  const saida: { teamName: string; cardName: string }[] = [];
  for (const seat of atual) {
    const antes = antesPorIndice.get(seat.index);
    for (const rota of ROTAS) {
      const cartaAgora = seat.picks[rota];
      if (cartaAgora !== undefined && antes?.picks[rota] === undefined) {
        saida.push({ teamName: seat.teamName, cardName: playerName(cartaAgora) });
      }
    }
  }
  return saida;
}

export function RoomDraftScreen(props: RoomDraftScreenProps) {
  const [restante, setRestante] = createSignal<number | null>(null);
  const mode = () => props.store.state?.()?.settings?.statsMode ?? "never";
  const options = () => props.store.isMyTurn() ? props.store.hand() : (props.store.draft()?.options ?? []);

  /**
   * O contador anda no relogio de quem esta olhando, a partir do tempo restante
   * que o servidor mandou (D-16). Comparar com um instante do servidor faria o
   * numero nascer estourado na maquina de quem tem o relogio adiantado.
   */
  createEffect(() => {
    props.store.draft()?.turnIndex;
    const inicial = props.store.turnMsRemaining();
    setRestante(inicial);
    if (inicial === null) return;

    const comeco = Date.now();
    const timer = setInterval(() => {
      setRestante(Math.max(0, inicial - (Date.now() - comeco)));
    }, 250);
    onCleanup(() => clearInterval(timer));
  });

  const segundos = () => {
    const ms = restante();
    return ms === null ? null : Math.ceil(ms / 1000);
  };

  const daVez = () => {
    const d = props.store.draft();
    if (d === null || d.currentSeat === null) return null;
    return d.seats[d.currentSeat] ?? null;
  };

  /** Mesmo motivo de textoOnda em BracketScreen.tsx: uma unica string, senao
   * "Próximo: " e o nome viram nós de texto separados pelo comentário de
   * hidratação do SSR. */
  const textoProximo = () => {
    const d = props.store.draft();
    const p = d === null ? null : proximoDaVez(d);
    return p === null ? null : `Próximo: ${p.teamName}`;
  };

  /**
   * So preenchido no broadcast que segue um timeout (Fase 6, D-17: bot nunca
   * estoura relogio) — some sozinho assim que qualquer outro evento gerar o
   * proximo roomState, sem temporizador do lado do cliente.
   */
  const textoTimeout = () => {
    const d = props.store.draft();
    if (d === null || d.timedOutSeat === null) return null;
    const assento = d.seats[d.timedOutSeat];
    return assento === undefined ? null : `${assento.teamName} perdeu o prazo · a escolha foi automática.`;
  };

  /**
   * Toast de picks recem-chegados. Comparo o `seats` de agora com o do
   * ultimo roomState visto — pega tanto um pick manual quanto uma sequencia
   * de bots resolvida inteira num unico broadcast (Fase 6). `seatsAnteriores`
   * fica fora de um signal de proposito: e so memoria de comparacao, nunca
   * dado que a UI le direto.
   */
  const [toasts, setToasts] = createSignal<{ id: number; texto: string }[]>([]);
  let seatsAnteriores: DraftSeatWire[] | null = null;
  let proximoToastId = 0;
  const timersDeToast = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const t of timersDeToast) clearTimeout(t);
  });

  createEffect(() => {
    const seatsAtuais = props.store.draft()?.seats ?? null;
    if (seatsAtuais !== null && seatsAnteriores !== null) {
      for (const pick of picksNovos(seatsAnteriores, seatsAtuais)) {
        const id = proximoToastId++;
        const texto = `${pick.teamName} escolheu ${pick.cardName}`;
        setToasts((atual) => [...atual, { id, texto }]);
        const timer = setTimeout(() => {
          timersDeToast.delete(timer);
          setToasts((atual) => atual.filter((t) => t.id !== id));
        }, 4000);
        timersDeToast.add(timer);
      }
    }
    seatsAnteriores = seatsAtuais;
  });

  const meuId = () => props.store.publicId();
  const meuAssento = () => {
    const meu = meuId();
    return meu === null ? null : props.store.draft()?.seats.find((s) => s.publicId === meu) ?? null;
  };
  const souEspectador = () =>
    props.store.state?.()?.players.find((p) => p.publicId === meuId())?.spectator === true;

  const apelidoDe = (seat: DraftSeatWire): string | null =>
    seat.publicId === null
      ? null
      : props.store.state?.()?.players.find((p) => p.publicId === seat.publicId)?.nickname ?? null;

  /** Os assentos na ordem em que escolhem (Fase 8: a mesma em toda volta), nao na de entrada (S18). */
  const assentosNaOrdem = (): DraftSeatWire[] => {
    const d = props.store.draft();
    if (d === null) return [];
    const naOrdem = d.order.map((i) => d.seats[i]).filter((s): s is DraftSeatWire => s !== undefined);
    return naOrdem.length === d.seats.length ? naOrdem : d.seats;
  };

  /** "Rotas que faltam no seu time: Topo, Meio" -- uma frase so (SSR). */
  const textoRotasQueFaltam = () => {
    const meu = meuAssento();
    if (meu === null) return null;
    const faltam = ROTAS.filter((r) => meu.picks[r] === undefined).map((r) => ROLE_LONG_LABELS[r]);
    return faltam.length === 0 ? null : `Rotas que faltam no seu time: ${faltam.join(", ")}.`;
  };

  /** "Vez de Corujas (bia)" -- uma frase so. */
  const textoDaVez = () => {
    const v = daVez();
    if (v === null) return "Vez de …";
    const apelido = apelidoDe(v);
    return apelido === null ? `Vez de ${v.teamName} (bot)` : `Vez de ${v.teamName} (${apelido})`;
  };

  const host = () => props.store.state?.()?.players.find((p) => p.isHost) ?? null;
  const textoEsperaTorneio = () => {
    const h = host();
    return h === null ? "Esperando o host começar o torneio." : `Esperando ${h.nickname} (host) começar o torneio.`;
  };

  return (
    <section class="room-draft">
      <header class="room-draft__head room-card">
        <h2 class="room-title">Draft</h2><p class="room-help">Base em uso: {props.store.state?.()?.settings?.baseName ?? "Base salva no servidor"} · {props.store.state?.()?.baseSummary?.cards ?? 0} cartas · {props.store.state?.()?.baseSummary?.people ?? 0} jogadores</p><p class="room-help">{props.store.state?.()?.baseSummary?.examples.join(", ")}</p>
        <Show when={props.store.draft()}>
          {(d) => (
            <p class="room-draft__status">
              {`Volta ${d().round} de ${PICKS_PER_SEAT} · escolha ${Math.min(d().turnIndex + 1, d().totalTurns)} de ${d().totalTurns} · ${d().remainingCards} cartas no baralho`}
            </p>
          )}
        </Show>
        <p class="room-help">
          Em cada volta, cada time leva 1 jogador para uma rota que ainda esteja vazia. A carta escolhida sai do
          baralho para todos; outra versão da mesma pessoa pode ir para outro time, nunca para o mesmo.
        </p>
      </header>

      <div class="room-draft__toasts" aria-live="polite">
        <For each={toasts()}>{(t) => <p class="room-draft__toast">{t.texto}</p>}</For>
      </div>

      <Show when={textoTimeout()}>
        <p class="room-note" role="status">
          {textoTimeout()}
        </p>
      </Show>

      <Show when={props.store.connected() === false}>
        {/* Sem socket, este cliente nao tem como saber QUANDO vai virar a sua
            vez nem receber um deadline novo enquanto estiver fora do ar. O que
            da pra dizer e o numero real e fixo da carencia. String unica (SSR
            do Solid separa texto e valor dinamico em nos distintos). A faixa
            da RoomShell cuida da reconexao. */}
        <p class="room-note" role="status">
          {`Sem conexão: se for a sua vez, o jogo escolhe por você em até ${DISCONNECTED_GRACE_SECONDS} segundos. A sala está tentando reconectar sozinha.`}
        </p>
      </Show>

      <Show
        when={!props.store.draft()?.finished}
        fallback={
          <div class="room-draft__done room-card">
            {/* D-34: a sala fica parada de proposito aqui para todo mundo
                olhar os 8 rosters (abaixo) antes da primeira bola rolar. */}
            <h3 class="room-subtitle">Draft encerrado</h3>
            <p class="room-help" role="status">
              Os 8 times estão montados · confira os elencos abaixo antes de o torneio começar.
            </p>
            <Show when={props.store.isHost()} fallback={<p class="room-note room-note--ok">{textoEsperaTorneio()}</p>}>
              <div class="room-draft__chaos">
                {/* Slider reaproveitado do solo (src/components/ChaosSlider.tsx),
                    em modo controlado, com o caos local da sala. */}
                
                
                <button class="room-btn room-btn--primary" onClick={() => props.store.startTournament(props.store.state?.()?.settings?.chaosLevel ?? 0.25)}>
                  Começar o torneio
                </button>
              </div>
            </Show>
          </div>
        }
      >
        <div class="room-draft__turn-card room-card" classList={{ "is-mine": props.store.isMyTurn() }}>
          <p class="room-draft__turn">
            {/* aria-live so aqui: muda uma vez por turno. O relogio ao lado muda
                a cada ~250ms e reanunciaria tudo se estivesse na mesma regiao. */}
            <span aria-live="polite">
              <Show when={props.store.isMyTurn()} fallback={<>{textoDaVez()}</>}>
                <strong>Sua vez!</strong>
              </Show>
            </span>
            <Show when={segundos() !== null}>
              <span class="room-draft__clock" classList={{ "is-urgent": (segundos() ?? 99) <= 10 }}>
                {segundos()}s
              </span>
            </Show>
          </p>
          <Show when={textoProximo()}>
            <p class="room-draft__next">{textoProximo()}</p>
          </Show>
          <Show when={souEspectador()}>
            <p class="room-help">Você está assistindo o draft · sem time nesta noite.</p>
          </Show>
          <Show when={!souEspectador() && textoRotasQueFaltam()}>
            {(texto) => <p class="room-help">{texto()}</p>}
          </Show>
        </div>

        <Show
          when={options().length > 0}
          fallback={
            <Show
              when={props.store.isMyTurn()}
              fallback={
                <Show when={!souEspectador()}>
                  <p class="room-draft__wait">Esperando {daVez()?.teamName ?? "o próximo time"}.</p>
                </Show>
              }
            >
              {/* "e minha vez E a mao esta vazia": a escolha acabou de ser
                  enviada, ou a mao ainda nao chegou (logo depois de reconectar).
                  Um texto neutro nao mente em nenhum dos dois. */}
              <p class="room-draft__wait">Preparando sua mão…</p>
            </Show>
          }
        >
          <ul class="room-draft__hand">
            <For each={options()}>
              {(item) => (
                <li class="room-draft__card" classList={{ "is-disabled": !props.store.connected() }}>
                  <PlayerCard player={item.card} mode={mode()} />
                  <button
                    class="room-btn room-btn--primary room-draft__pick"
                    disabled={!props.store.connected() || !props.store.isMyTurn()}
                    onClick={() => props.store.pick(item.card.id)}
                  >
                    {props.store.isMyTurn() ? "Escolher" : "Em análise"}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>

      <h3 class="room-subtitle">Times, na ordem de escolha</h3>
      <ol class="room-draft__seats">
        <For each={assentosNaOrdem()}>
          {(seat, posicao) => (
            <li
              class="room-draft__seat"
              classList={{
                "is-turn": props.store.draft()?.currentSeat === seat.index,
                "is-mine": seat.publicId !== null && seat.publicId === meuId(),
                "is-offline": !seat.connected,
              }}
            >
              <div class="room-draft__seat-head">
                <span class="room-draft__seat-pos">{`${posicao() + 1}º`}</span>
                <strong>{seat.teamName}</strong>
                <Show when={apelidoDe(seat)}>{(a) => <span class="room-draft__seat-nick">{a()}</span>}</Show>
                <Show when={seat.publicId !== null && seat.publicId === meuId()}>
                  <span class="room-badge room-badge--you">você</span>
                </Show>
                <Show when={seat.isBot}>
                  <span class="room-draft__badge">bot</span>
                </Show>
                <Show when={!seat.isBot && !seat.connected}>
                  <span class="room-draft__badge room-draft__badge--offline">caiu</span>
                </Show>
              </div>
              <ul class="room-draft__roster">
                <For each={ROTAS}>
                  {(rota) => (
                    <li class="room-draft__slot">
                      <span class="room-draft__slot-role">{ROLE_LABELS[rota]}</span>
                      <Show when={seat.picks[rota]} fallback={<span class="room-draft__slot-empty">-</span>}>
                        {(carta) => (
                          <>
                            <span class="room-draft__slot-name">{playerName(carta())}</span>
                            <span class="room-draft__slot-year">{carta().year}</span>
                            <PlayerStats player={carta()} mode={mode()} picked />
                          </>
                        )}
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </li>
          )}
        </For>
      </ol>
    </section>
  );
}
