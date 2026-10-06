/**
 * src/room/RoomEntry.tsx
 *
 * Ponto de entrada do modo sala. Some quando o app nao esta sendo servido
 * pelo servidor de salas — o jogo solo continua exatamente como era.
 *
 * Servido pelo servidor de salas, a sala abre direto, em primeiro plano (o
 * menu solo nem e desenhado -- modo.ts), e quem ja entrou neste navegador
 * volta sozinho, sem formulario (Rundown da Sala 2, Fase B).
 */

import { createEffect, createMemo, createResource, createSignal, onCleanup, Show } from "solid-js";
import { RoomShell } from "./RoomShell";
import { salaEmPrimeiroPlano, saiuDaSalaNestaAba, setSalaEmPrimeiroPlano } from "./modo";
import type { BaseDisponivel } from "./bases";
import { finalRevelada, serieRevelada } from "./revelacao";
import { revelacaoDaSala } from "./BracketSeriesList";
import { quandoMudar } from "./quandoMudar";
import { telaEstavel } from "./telaEstavel";
import { createRoomStore, type RoomStore } from "../net/store";
import type { RoomPhase } from "../../server/protocol";
import { LobbyScreen } from "./LobbyScreen";
import { RoomDraftScreen } from "./RoomDraftScreen";
import { BracketScreen } from "./BracketScreen";
import { SeriesWatch } from "./SeriesWatch";
import { PodiumScreen } from "./PodiumScreen";
import "./room.css";

interface InfoDaSala {
  /** Links que os amigos abrem (D-02: um processo, uma porta). Sem token. */
  convites: string[];
  /** O tunel (--tunnel) foi pedido e o link publico ainda nao saiu. */
  aguardandoTunel: boolean;
  /** Fase da sala para quem ainda nao entrou: fora do lobby, so assistir. */
  fase: string;
  /** Quantos estao na sala (menu do dono). */
  conectados: number;
  hostAuto: boolean;
}

/**
 * A sala abre em primeiro plano? Nao abre para quem saiu dela nesta aba, nem
 * para o dono (E-04) com a sala ainda no lobby: ele cai no menu dele. Com a
 * sala no draft ou no torneio, o dono tambem vai para ela.
 */
export function salaVaiParaPrimeiroPlano(args: {
  dono: boolean;
  fase: string;
  saiuNestaAba: boolean;
}): boolean {
  const donoNoMenu = args.dono && args.fase === "lobby";
  return !args.saiuNestaAba && !donoNoMenu;
}

/** Intervalo entre as consultas ao servidor enquanto o link do tunel nao saiu. */
const INTERVALO_DO_TUNEL_MS = 3000;

/**
 * Resposta crua do /api/room-info -> o que o cliente usa. `null` quando nao e
 * um servidor de salas (ou a resposta e lixo): ai o modo sala some e o jogo
 * solo continua como era.
 */
export function lerInfoDaSala(info: unknown): InfoDaSala | null {
  if (typeof info !== "object" || info === null) return null;
  const bruto = info as {
    room?: unknown;
    convites?: unknown;
    aguardandoTunel?: unknown;
    fase?: unknown;
    conectados?: unknown;
    hostAuto?: unknown;
  };
  if (bruto.room !== true) return null;
  // Defesa: mesmo que um servidor antigo mande um link com token, ele nao
  // chega na tela.
  const convites = Array.isArray(bruto.convites)
    ? bruto.convites.filter((c): c is string => typeof c === "string" && !c.includes("host="))
    : [];
  return {
    convites,
    aguardandoTunel: bruto.aguardandoTunel === true,
    fase: typeof bruto.fase === "string" ? bruto.fase : "lobby",
    conectados: typeof bruto.conectados === "number" ? bruto.conectados : 0,
    hostAuto: bruto.hostAuto === true,
  };
}

export async function detectarSala(): Promise<InfoDaSala | null> {
  try {
    const res = await fetch("/api/room-info");
    if (!res.ok) return null;
    return lerInfoDaSala(await res.json());
  } catch {
    return null;
  }
}

/**
 * Le o ?host= e tira ele da barra de enderecos: quem hospeda compartilha tela,
 * e o token na URL entrega o controle da sala para quem estiver assistindo.
 */
function lerHostToken(): string | undefined {
  const token = new URLSearchParams(window.location.search).get("host") ?? undefined;
  if (token !== undefined) {
    try {
      window.history.replaceState({}, "", window.location.pathname);
    } catch {
      // Navegador sem history API utilizavel: o token fica na barra, paciencia.
    }
  }
  return token;
}

/** Toda troca de tela da sala comeca no topo (sem window em SSR/testes). */
function rolarAoTopo(): void {
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}

export type TelaDoTorneio = "watch" | "podium" | "bracket";

/**
 * Decisao pura de qual tela mostrar dentro da fase de torneio -- separada do
 * componente pra poder ser testada direto, sem montar SolidJS nenhum (mesmo
 * raciocinio de `saidaDaSerie` em SeriesWatch.tsx).
 *
 * A prioridade e: uma serie com timeline carregada e que eu nao deixei;
 * depois a fase decide entre podio e chaveamento. Essa ordem (nao a lida ao
 * pe da letra do brief, que checava a fase antes da serie) e o que faz D-32
 * valer de verdade: sem ela, clicar numa serie jogada no podio nunca
 * navegaria pra lugar nenhum, porque a fase `finished` venceria sempre.
 *
 * A votacao nao toma mais a tela (Rundown da Sala 2, S6): ela aparece dentro
 * do chaveamento. E o podio so aparece depois que a pessoa viu a Grande Final
 * (ou pediu para ver o podio): antes disso, o chaveamento oferece assisti-la
 * -- o podio contava o campeao no primeiro segundo (S4).
 */
export function escolherTelaDoTorneio(estado: {
  gamesCarregado: boolean;
  voltouAoChaveamento: boolean;
  fase: RoomPhase | undefined;
  finalRevelada: boolean;
}): TelaDoTorneio {
  if (estado.gamesCarregado && !estado.voltouAoChaveamento) return "watch";
  if (estado.fase === "finished" && estado.finalRevelada) return "podium";
  return "bracket";
}

/**
 * Fase `tournament` ou `finished`: escolhe entre chaveamento, assistir uma
 * serie, votacao e podio.
 *
 * "Voltei ao chaveamento" e estado LOCAL do cliente -- um sinal booleano
 * zerado toda vez que chega uma timeline nova (`games`) (o servidor so sabe o
 * que eu estou *acompanhando*, `tournament.watching`; nunca onde a MINHA
 * tela esta, e nao precisa saber). Sem isso, o botao de voltar da
 * SeriesWatch nao teria efeito nenhum -- o proximo render veria `games()`
 * ainda preenchido e voltaria direto pra tela que acabou de sair.
 */
export function RoomScreen(props: { store: RoomStore }) {

  // A timeline chega numa mensagem propria (D-27) so quando a MINHA serie
  // muda, quando eu clico num card (mesmo o da serie que acabei de deixar) ou
  // quando reconecto. E exatamente quando "voltei ao chaveamento" deve zerar.
  // Vigiar `tournament()` zerava a cada roomState: qualquer "Estou pronto"
  // de qualquer pessoa puxava todo mundo de volta para a partida.
  //
  // Excecao (S20): timeline que chegou SOZINHA (sem clique -- recarreguei a
  // pagina, a conexao voltou) de uma serie que eu JA vi ate o fim nao reabre o
  // Jogo 1 dela: conta como se eu tivesse voltado ao chaveamento (ou ao podio,
  // se for a Grande Final). Serie que eu ainda nao vi abre normalmente -- e o
  // "continuar de onde parei" de quem caiu no meio da partida.
  const serieAssistidaJaVista = () => {
    const t = props.store.tournament();
    const meu = props.store.publicId();
    const ctx = revelacaoDaSala(props.store);
    if (t === null || meu === null || ctx === null) return false;
    const slot = t.watching[meu];
    const serie = slot === undefined ? undefined : t.series.find((x) => x.slotId === slot);
    return serie !== undefined && serieRevelada(serie, ctx);
  };
  // Montou ja com uma timeline na mao (ela chegou junto do roomState que
  // trouxe esta tela): mesma regra de "chegou sozinha".
  const [voltouAoChaveamento, setVoltouAoChaveamento] = createSignal(
    props.store.games() !== null && serieAssistidaJaVista()
  );
  let pedidosVistos = props.store.pedidosDeSerie?.() ?? 0;
  let slotAnterior: string | null = props.store.games()?.slotId ?? null;
  // Em "Assistir juntos" a serie da sala vale mesmo ja vista: o host pode
  // estar revendo a final com todo mundo (revisao final, achado 8).
  const souLevadoPelaSincronia = () => {
    const t = props.store.tournament();
    const meu = props.store.publicId();
    return t?.sync != null && meu !== null && t.watching[meu] === t.sync.slotId;
  };
  quandoMudar(
    () => props.store.games(),
    (g) => {
      const pedidos = props.store.pedidosDeSerie?.() ?? 0;
      const chegouSozinha = pedidos === pedidosVistos;
      pedidosVistos = pedidos;
      // Mesma serie reenviada (a reconexao manda de novo): fica onde estava
      // (revisao final, achado 10).
      const reenvio = g !== null && g.slotId === slotAnterior;
      slotAnterior = g?.slotId ?? null;
      if (reenvio && chegouSozinha) return;
      setVoltouAoChaveamento(chegouSozinha && serieAssistidaJaVista() && !souLevadoPelaSincronia());
    }
  );

  quandoMudar(() => props.store.tournament()?.resultadosLiberados, (liberados) => {
    if (liberados) setVoltouAoChaveamento(true);
  });

  const escolha = () => {
    const t = props.store.tournament();
    const ctx = revelacaoDaSala(props.store);
    return escolherTelaDoTorneio({
      gamesCarregado: props.store.games() !== null,
      voltouAoChaveamento: voltouAoChaveamento(),
      fase: props.store.state()?.phase,
      finalRevelada: t === null || ctx === null || finalRevelada(t, ctx),
    });
  };

  quandoMudar(escolha, rolarAoTopo);

  // So recria a tela quando a ESCOLHA muda ("watch", "bracket", ...) -- ver
  // telaEstavel.ts. Uma funcao comum aqui era reexecutada a cada roomState
  // e devolvia uma SeriesWatch nova, que voltava para o Jogo 1.
  const tela = telaEstavel(escolha, (atual) => {
    switch (atual) {
      case "watch":
        return <SeriesWatch store={props.store} onVoltar={() => setVoltouAoChaveamento(true)} />;
      case "podium":
        return <PodiumScreen store={props.store} />;
      case "bracket":
        return <BracketScreen store={props.store} />;
    }
  });

  return <>{tela()}</>;
}

export type TelaDaSala = "lobby" | "draft" | "torneio";

/**
 * Qual tela de fase a sala mostra. Torneio e fim de noite sao a MESMA tela
 * (RoomScreen): separar as duas recriaria a RoomScreen quando a Grande Final
 * acaba, e ela esqueceria onde a pessoa estava.
 */
export function telaDaFase(fase: RoomPhase | undefined): TelaDaSala {
  if (fase === "draft") return "draft";
  if (fase === "tournament" || fase === "finished") return "torneio";
  return "lobby";
}

export function RoomEntry(
  props: {
    bases?: () => BaseDisponivel[];
    /** E-04: o dono escolhe no menu; undefined enquanto o servidor nao respondeu. */
    ehDono?: () => boolean | undefined;
    /** Esconde a faixa "ha uma sala aberta" (no menu do dono ela repetiria o bloco Multiplayer). */
    esconderFaixa?: () => boolean;
  } = {}
) {
  const [primeiraLeitura] = createResource(detectarSala);
  // A ultima leitura BOA do servidor. As consultas de acompanhamento so entram
  // aqui quando dao certo: uma falha passageira nao pode derrubar a sala da
  // tela (o <Show when={sala()}> la embaixo viraria null).
  const [leituraRecente, setLeituraRecente] = createSignal<InfoDaSala | null>(null);
  const sala = () => leituraRecente() ?? primeiraLeitura() ?? null;

  // O cloudflared so anuncia o link publico alguns segundos depois do arranque.
  // Enquanto o servidor disser que esta aguardando o tunel, pergunta de novo a
  // cada 3s; quando o link chega, o memo vira false, o efeito refaz e o relogio
  // para. Um setTimeout encadeado, nao setInterval,
  // para nunca haver duas consultas no ar ao mesmo tempo.
  const aguardandoTunel = createMemo(() => sala()?.aguardandoTunel === true);
  const store = createRoomStore();
  const hostToken = lerHostToken();
  // Quem ainda nao entrou tambem rele a sala: a fase decide entre o formulario
  // com time (lobby) e o "so assistir", e ela muda (a Revanche volta ao lobby
  // com a pessoa ainda no formulario -- revisao final, achado 1).
  const precisaReler = createMemo(() => aguardandoTunel() || store.clientId() === null);
  createEffect(() => {
    if (!precisaReler()) return;
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const agendar = () => {
      timer = setTimeout(() => {
        void detectarSala().then((info) => {
          if (!ativo) return;
          if (info !== null) setLeituraRecente(info);
          // O set acima pode ter desligado este efeito (ativo = false).
          if (ativo) agendar();
        });
      }, INTERVALO_DO_TUNEL_MS);
    };
    agendar();
    onCleanup(() => {
      ativo = false;
      clearTimeout(timer);
    });
  });

  // Servidor de sala confirmado: a sala abre em primeiro plano (D3), a menos
  // que a pessoa tenha saido dela nesta aba. O dono (E-04) cai no menu dele,
  // exceto com a sala ja no draft ou no torneio. Quem ja entrou neste
  // navegador volta sozinho com o apelido e o time lembrados (S10).
  let jaDecidiu = false;
  createEffect(() => {
    const info = sala();
    if (jaDecidiu || info === null) return;
    const dono = props.ehDono?.();
    if (props.ehDono !== undefined && dono === undefined) return; // espera a resposta do servidor
    jaDecidiu = true;
    if (salaVaiParaPrimeiroPlano({ dono: dono === true, fase: info.fase, saiuNestaAba: saiuDaSalaNestaAba() })) {
      setSalaEmPrimeiroPlano(true);
    }
    if (store.status() === "fora") store.entrarComIdentidadeGuardada(hostToken);
  });

  // Voltou para a aba (celular acordou, wi-fi voltou): nao espera a proxima
  // tentativa marcada.
  if (typeof window !== "undefined") {
    const voltar = () => {
      if (document.visibilityState !== "hidden") store.tentarAgora();
    };
    document.addEventListener("visibilitychange", voltar);
    window.addEventListener("online", voltar);
    onCleanup(() => {
      document.removeEventListener("visibilitychange", voltar);
      window.removeEventListener("online", voltar);
    });

    // "Sua vez" fora da aba (S18): o titulo da aba avisa.
    const tituloOriginal = document.title;
    createEffect(() => {
      document.title = store.isMyTurn() ? "Sua vez no draft! · LoL 7 a 0" : tituloOriginal;
    });
    onCleanup(() => {
      document.title = tituloOriginal;
    });
  }

  quandoMudar(() => store.state()?.phase ?? null, rolarAoTopo);

  // Mesmo motivo do RoomScreen: a tela da fase so e recriada quando a FASE
  // muda, nunca a cada roomState. As props continuam reativas (o JSX as
  // compila como getters), entao os convites do lobby seguem atualizando.
  const tela = telaEstavel(
    () => telaDaFase(store.state()?.phase),
    (atual) => {
      if (atual === "draft") return <RoomDraftScreen store={store} />;
      if (atual === "torneio") return <RoomScreen store={store} />;
      return (
        <LobbyScreen
          store={store}
          hostToken={hostToken}
          convites={sala()?.convites ?? []}
          aguardandoTunel={aguardandoTunel()}
          faseAntesDeEntrar={sala()?.fase}
          hostAuto={sala()?.hostAuto}
          bases={props.bases?.() ?? []}
        />
      );
    }
  );

  const entrou = () => store.clientId() !== null;

  /** Frase da faixa no menu solo (uma expressao so, por causa do SSR). */
  const textoDaFaixa = () => {
    if (!entrou()) return "Há uma sala com amigos aberta neste servidor.";
    if (store.isMyTurn()) return "É a sua vez no draft da sala!";
    return "Você está numa sala com amigos · seu lugar continua guardado.";
  };

  return (
    <Show when={sala()}>
      <Show
        when={salaEmPrimeiroPlano()}
        fallback={
          <Show when={props.esconderFaixa?.() !== true}>
            <div class="room-return" classList={{ "is-urgent": store.isMyTurn() }} role="status">
              <span>{textoDaFaixa()}</span>
              <button type="button" class="room-btn room-btn--primary room-btn--small" onClick={() => setSalaEmPrimeiroPlano(true)}>
                {entrou() ? "Voltar para a sala" : "Entrar na sala"}
              </button>
            </div>
          </Show>
        }
      >
        <RoomShell store={store} onSair={() => setSalaEmPrimeiroPlano(false)}>
          {tela()}
        </RoomShell>
      </Show>
    </Show>
  );
}
