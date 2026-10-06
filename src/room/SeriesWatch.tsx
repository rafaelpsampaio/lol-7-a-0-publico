/**
 * src/room/SeriesWatch.tsx
 *
 * Tela de assistir uma serie da sala: reaproveita PlaybackScreen e, antes
 * dele, ChampionSelect (Fase 3) -- os dois do jogo solo (D-30, excecao de
 * quarentena conhecida, ver contract.test.tsx) -- com os dados que a sala
 * tem: a timeline vem da mensagem `games` (D-27, separada do estado por ser
 * grande), o roster de cada time vem das escolhas do draft (que continuam no
 * fio na fase de torneio -- o servidor nunca zera `room.draft` ao virar para
 * "tournament"), e o catalogo de campeoes carrega uma vez, degradado (D-26:
 * so os retratos dependem dele, nunca a simulacao). ChampionSelect usa
 * exatamente esses mesmos dados, ja calculados por `dadosPlayback()` -- Fase
 * 3 nao precisou de dado novo do servidor.
 *
 * Fase 4 acrescenta um terceiro reaproveitamento, SeriesResultScreen (tambem
 * do solo, mesma excecao D-30): quando a serie termina, ela substitui
 * PlaybackScreen/ChampionSelect por inteiro, com `isUser` de cada time vindo
 * de `perspectivaDoEspectador()` (nao de um lado fixo) -- espectador puro cai
 * sozinho na copy neutra que o componente ja tinha ("{time} avancou"), mesmo
 * principio do prop `perspectiva` do PlaybackScreen (Fase 2).
 *
 * A conversao de StoredGame para o que o PlaybackScreen espera repete, sem
 * alterar, a logica ja usada pelo jogo solo em App.tsx (handleReplaySeries).
 */

import { createEffect, createResource, createSignal, Show, type Accessor } from "solid-js";
import { quandoMudar, type PrimitivasReativas } from "./quandoMudar";
import { marcarVistas } from "./vistas";
import { finalRevelada, serieRevelada } from "./revelacao";
import { revelacaoDaSala } from "./BracketSeriesList";
import type { RoomStore, SlotId, StoredGame } from "../net/store";
import type { RoomPhase, TournamentTeamWire } from "../../server/protocol";
import type { PlayerVersion } from "../data/schema";
import type { MatchResult } from "../sim/types";
import type { SeriesState, TournamentTeam } from "../tournament/schema";
import { isUserTeam } from "../tournament/schema";
import { loadChampions } from "../data/loader";
import { PlaybackScreen } from "../playback/PlaybackScreen";
import { ChampionSelect } from "../playback/ChampionSelect";
import { SeriesResultScreen } from "../tournament/SeriesResultScreen";
import { criarNarracaoComMemoria } from "./narracao";

interface Props {
  store: RoomStore;
  onVoltar: () => void;
}

/**
 * Se quem sai e o host E ha sincronia ativa, manda `voltarAoChaveamento`
 * ANTES de `onVoltar` -- essa mensagem zera `sync` no servidor (D-28,
 * Tarefa 8) e solta todo mundo de volta pro proprio controle. Fora disso, a
 * saida e puramente local: ninguem mais e afetado.
 */
/**
 * Time de quem assiste (comparando publicId com os times do torneio) contra
 * o enquadramento do motor pra esta serie (`enquadrado`/`rival`) — "user" se
 * o enquadrado sou eu, "rival" se o rival e o meu, `null` se eu nao tenho
 * time nesta serie (espectador puro, ex.: fui eliminado e estou vendo outra
 * dupla jogar). Funcao pura e exportada de proposito: e o unico jeito de
 * testar essa logica sem esperar o overlay do PlaybackScreen, que so aparece
 * depois do GameTimer completar via rAF (nunca em SSR sincrono).
 */
export function perspectivaDoEspectador(
  meuTimeId: string | null,
  enquadradoId: string,
  rivalId: string
): "user" | "rival" | null {
  if (meuTimeId === enquadradoId) return "user";
  if (meuTimeId === rivalId) return "rival";
  return null;
}

/**
 * Placar da serie ATE o jogo no indice exibido agora — nao o placar final
 * de `SeriesState.wins` (D-24: a onda roda a serie inteira de uma vez, entao
 * `wins` ja chega fechado do servidor mesmo quando o espectador esta olhando
 * o Jogo 1 de uma serie que so fechou no Jogo 5). Achado do teste de sala
 * (2026-08-27): usar o placar final direto fazia PlaybackScreen tratar TODO
 * jogo de uma serie ja decidida como "a série encerrada", com o veredito
 * ("SEU TIME"/"RIVAL" venceu A SÉRIE) errado sempre que o jogo exibido nao
 * era o que realmente decidiu a serie. Funcao pura e exportada de proposito,
 * mesmo motivo de `perspectivaDoEspectador`.
 */
export function placarAteAqui(
  jogos: StoredGame[],
  indiceAtual: number,
  enquadradoId: string,
  rivalId: string
): { userWins: number; rivalWins: number } {
  const ateAqui = jogos.slice(0, indiceAtual + 1);
  return {
    userWins: ateAqui.filter((j) => j.winnerId === enquadradoId).length,
    rivalWins: ateAqui.filter((j) => j.winnerId === rivalId).length,
  };
}

export type EstagioPartida = "select" | "playback";

/**
 * Etapa a mostrar (selecao de campeoes ou o placar) — Fase 3. `syncStage` e
 * `null` fora de sincronia (cada tela controla a propria etapa, sem servidor
 * nenhum de por meio); em sincronia ele vem do servidor e vence assim que
 * chega a "playback" (o pulo do host chegando via broadcast), mesmo que a
 * revelacao local desta tela ainda nao tenha terminado — ninguem fica pra
 * tras. Fora isso (`syncStage` nulo ou ainda "select"), quem decide e a
 * revelacao local (`localStage`): o fim natural da animacao, igual em toda
 * tela porque o temporizador comeca no mesmo instante para todo mundo.
 *
 * Funcao pura e exportada de proposito: essa e a peca do design que mais
 * fica errada mudando na cabeca sem testar (achado da revisao do usuario
 * sobre pular ter que "arrastar todo mundo junto").
 */
export function estagioChampSelect(
  syncStage: EstagioPartida | null,
  localStage: EstagioPartida
): EstagioPartida {
  return syncStage === "playback" ? "playback" : localStage;
}

export type AcaoContinuar = "avancar" | "mostrarResultado" | "bloqueado";

/**
 * O que o clique de "continuar" (botao do PlaybackScreen) deve fazer --
 * Fase 4. Serie decidida vence sempre, pra QUALQUER um: mostrar o resultado
 * nao precisa de lockstep (o jogo que decidiu a serie ja e dado final do
 * servidor, igual pra todo mundo), so o AVANCO de jogo continua sob a mesma
 * regra de sempre (`podeNavegar` -- convidado sincronizado nao decide
 * sozinho). Funcao pura e exportada de proposito, mesmo motivo de
 * `estagioChampSelect`: e a peca nova desta fase, testavel sem depender de
 * clique nenhum.
 */
export function decidirContinuar(serieCompleta: boolean, podeNavegar: boolean): AcaoContinuar {
  if (serieCompleta) return "mostrarResultado";
  if (!podeNavegar) return "bloqueado";
  return "avancar";
}

/**
 * Texto do botao de "continuar" do fim de jogo. Segue `decidirContinuar`: onde
 * o clique seria "bloqueado" (convidado sincronizado, jogo que nao decide a
 * serie) o botao nao pode prometer "Próximo jogo" e nao fazer nada -- diz que
 * a tela espera o host (achado da revisao final). Funcao pura e exportada de
 * proposito: o overlay do fim de jogo so aparece depois do GameTimer via rAF,
 * nunca em SSR sincrono.
 */
export function rotuloContinuar(serieDecidida: boolean, podeNavegar: boolean): string {
  if (serieDecidida) return "Ver resultado da série";
  if (!podeNavegar) return "Aguardando o host…";
  return "Próximo jogo";
}

/**
 * Texto do botao principal da tela de resultado da serie. A fase `finished` e a
 * testemunha das DUAS terminacoes do torneio (campeao, ou urna que decidiu
 * "parar" -- esta sem `championId`), e nas duas o clique leva ao podio. Antes o
 * rotulo olhava so o campeao e dizia "Voltar ao chaveamento" depois do "parar"
 * (achado da revisao final). Funcao pura e exportada: a tela de resultado so
 * existe depois de um clique, que renderToString nao dispara.
 */
export function rotuloDoResultado(fase: RoomPhase | null | undefined): string {
  return fase === "finished" ? "Ver pódio" : "Voltar ao chaveamento";
}

/**
 * A serie esta decidida ATE O JOGO EXIBIDO? -- nao `status === "complete"`,
 * que e verdade em qualquer jogo: a onda simula a serie inteira antes de
 * alguem assistir (D-24). O ultimo jogo da timeline e sempre o que decidiu
 * (runWave para no jogo em que alguem chega a SERIES_WINS). Achado 2 do
 * Rundown da Sala 2: depois do Jogo 1, o unico botao era "Ver resultado da
 * serie" e pulava os jogos 2 a 5.
 */
export function serieDecididaAteAqui(indiceAtual: number, totalJogos: number): boolean {
  return totalJogos > 0 && indiceAtual >= totalJogos - 1;
}

/**
 * Em sincronia o indice do jogo vem do servidor e o sinal local ficaria
 * parado em 0. Quando o host solta a sincronia (ao sair da serie), o servidor
 * zera `sync` e o indice exibido cairia do jogo sincronizado para o Jogo 1:
 * todo convidado voltaria a selecao de campeoes do inicio (achado da revisao
 * final). Este efeito faz o indice local acompanhar o sincronizado, de modo
 * que a tela continue no mesmo jogo quando a sincronia cai.
 *
 * `indiceSincronizado` devolve `null` fora de sincronia -- ai nada e escrito e
 * a navegacao local segue por conta propria. Efeito NAO adiado (nao usa
 * `quandoMudar`: o `defer` dele pularia o primeiro valor, e quem monta a tela
 * com a sincronia ja ligada tambem precisa do indice). O parametro `p` existe
 * so para o teste usar o nucleo reativo do cliente (ver quandoMudar.ts).
 */
export function acompanharIndiceSincronizado(
  indiceSincronizado: Accessor<number | null>,
  aplicar: (indice: number) => void,
  p: Pick<PrimitivasReativas, "createEffect"> = { createEffect }
): void {
  p.createEffect(() => {
    const indice = indiceSincronizado();
    if (indice !== null) aplicar(indice);
  });
}

export function saidaDaSerie(
  store: Pick<RoomStore, "isHost" | "playbackControl">,
  sincronizado: boolean,
  onVoltar: () => void
): void {
  if (store.isHost() && sincronizado) {
    store.playbackControl("voltarAoChaveamento");
  }
  onVoltar();
}

export function SeriesWatch(props: Props) {
  // D-26: o catalogo so muda retratos, nunca a simulacao -- carrega
  // degradado (catalogue vazio) em vez de deixar a tela em branco.
  const [catalogo] = createResource(loadChampions);

  const meuSlot = (): SlotId | null => {
    const meu = props.store.publicId();
    if (meu === null) return null;
    return props.store.tournament()?.watching[meu] ?? null;
  };

  const serie = () => {
    const slot = meuSlot();
    if (slot === null) return null;
    return props.store.tournament()?.series.find((s) => s.slotId === slot) ?? null;
  };

  const timePorId = (id: string | null): TournamentTeamWire | null => {
    if (id === null) return null;
    return props.store.tournament()?.teams.find((t) => t.id === id) ?? null;
  };

  /** Meu proprio time (pelo publicId), independente de qual serie estou
   * vendo agora — usado so pra saber de que lado torcer no veredito. */
  const meuTimeId = (): string | null => {
    const meu = props.store.publicId();
    if (meu === null) return null;
    return props.store.tournament()?.teams.find((t) => t.publicId === meu)?.id ?? null;
  };

  /** O roster de um time vem do assento do draft, pelo seatIndex -- ponte
   * entre o teamId do torneio e o assento (a mensagem `games` nao carrega
   * roster nenhum). */
  const rosterDoTime = (id: string | null): PlayerVersion[] => {
    const time = timePorId(id);
    if (time === null) return [];
    const assento = props.store.draft()?.seats[time.seatIndex];
    if (assento === undefined) return [];
    return Object.values(assento.picks).filter((p): p is PlayerVersion => p !== undefined);
  };

  /** Timeline da serie assistida, so quando a mensagem `games` ja chegou
   * PARA ESSA serie (D-27: `games` e endereçada e pode ainda ser de uma
   * serie anterior logo depois de trocar de escolha). */
  const jogosDaSerie = (): StoredGame[] | null => {
    const slot = meuSlot();
    const g = props.store.games();
    if (slot === null || g === null || g.slotId !== slot) return null;
    return g.games;
  };

  /** Há sincronia na sala (decisão do host, global) — vale para a sala inteira. */
  const salaSincronizada = () => props.store.tournament()?.sync != null;

  /**
   * A sincronia governa a MINHA tela só quando ela aponta para a série que eu
   * estou acompanhando (G-1 da revisão final). `sync` é global, mas `watching`
   * não: toda onda nova aponta cada humano para a série do próprio time
   * (`autoWatch`) sem mexer no `sync`. Nesse instante o `sync.gameIndex` do
   * host passaria a indexar a MINHA série — mostrando o jogo errado, ou jogo
   * nenhum se o índice não existir aqui. Fora da série sincronizada a
   * navegação volta a ser local, que é o comportamento honesto.
   */
  const estaSincronizado = () => {
    const sync = props.store.tournament()?.sync ?? null;
    return sync != null && sync.slotId === meuSlot();
  };

  // Navegacao fora de sincronia: sinal local, nunca sai para o servidor por
  // desenho (D-28) -- o servidor so aceita playbackControl com sync ativo, e
  // a UI nem manda a mensagem fora disso (server/room/hub.ts).
  const [indiceLocal, setIndiceLocal] = createSignal(0);

  // Fase 4 -- tela de fim de serie (SeriesResultScreen), local a cada
  // visualizacao: quem decide entrar nela e o proprio clique de "continuar"
  // (continuar(), abaixo), nunca o servidor -- ver nota da funcao.
  const [mostrarResultado, setMostrarResultado] = createSignal(false);

  // Troquei de serie: o indice local da serie anterior nao faz sentido aqui,
  // nem a tela de resultado da serie que fiquei vendo antes. So quando a
  // serie MUDA -- um roomState qualquer (alguem marcou pronto) nao conta.
  quandoMudar(meuSlot, () => {
    setIndiceLocal(0);
    setMostrarResultado(false);
  });

  // Em sincronia o indice vem do servidor; o local o acompanha para que, quando
  // o host soltar a sincronia, a tela continue no mesmo jogo em vez de voltar ao
  // Jogo 1. Declarado DEPOIS do quandoMudar acima de proposito: se a serie e o
  // indice sincronizado mudam juntos, o zero do reset roda primeiro e este
  // efeito escreve por cima.
  acompanharIndiceSincronizado(
    () => (estaSincronizado() ? props.store.tournament()?.sync?.gameIndex ?? 0 : null),
    setIndiceLocal
  );

  const totalJogos = () => jogosDaSerie()?.length ?? 0;

  const indiceAtual = (): number => {
    if (estaSincronizado()) return props.store.tournament()?.sync?.gameIndex ?? 0;
    const max = Math.max(0, totalJogos() - 1);
    return Math.min(Math.max(0, indiceLocal()), max);
  };

  const jogoAtual = (): StoredGame | null => {
    const jogos = jogosDaSerie();
    if (jogos === null) return null;
    return jogos[indiceAtual()] ?? null;
  };

  // Fase 3 — champion select antes de cada jogo. `localStage` e o que decide
  // fora de sincronia (revelacao/pular locais, como no solo); em sincronia
  // ela ainda serve de base para o fim NATURAL da animacao (que ja acontece
  // no mesmo instante em toda tela), mas perde para `sync.stage` assim que o
  // host pula (estagioChampSelect).
  const [localStage, setLocalStage] = createSignal<EstagioPartida>("select");

  // Chave do "jogo que estou vendo agora": muda com a serie, o indice e o
  // restartCount (reiniciar repete o MESMO indice, entao sem restartCount a
  // troca nao seria percebida). Qualquer mudanca aqui e um jogo novo -- a
  // selecao de campeoes volta a valer.
  const chaveJogoAtual = () =>
    `${meuSlot() ?? ""}:${indiceAtual()}:${props.store.tournament()?.sync?.restartCount ?? 0}`;

  quandoMudar(chaveJogoAtual, () => setLocalStage("select"));

  const syncStage = (): EstagioPartida | null =>
    estaSincronizado() ? props.store.tournament()?.sync?.stage ?? "select" : null;

  const estagio = () => estagioChampSelect(syncStage(), localStage());

  /** Só o host vê o botão de pular a introdução em sincronia -- convidado
   * espera o broadcast, igual não navega sozinho (`podeNavegar`). Fora de
   * sincronia o próprio `ChampionSelect` já tem o "Pular" dele, local. */
  const podeVerBotaoPular = () => estaSincronizado() && props.store.isHost() && estagio() === "select";

  function pularSelecao() {
    props.store.playbackControl("pularSelecao");
  }

  /** Em sincronia, so o host navega -- e a navegacao dele manda todo mundo
   * junto (D-28). Fora de sincronia, cada espectador anda por conta propria. */
  const podeNavegar = () => !estaSincronizado() || props.store.isHost();

  /**
   * O que a saida da tela faz alem de `onVoltar`: se quem sai e o host E ha
   * sincronia ativa, ela solta os outros sete da sala antes de sair -- sem
   * isso a sala inteira fica presa numa serie que o host abandonou (a
   * sincronia e decisao do host; `voltarAoChaveamento` ja zera `sync` no
   * servidor desde a Tarefa 8 -- so faltava alguem mandar a mensagem).
   * Fora disso (nao e host, ou nao ha sincronia), a saida e puramente
   * local -- ninguem mais e afetado.
   *
   * Funcao pura e exportada de proposito: o clique real so pode ser
   * conferido no navegador (renderToString nao dispara evento de DOM), mas
   * a DECISAO de mandar ou nao `voltarAoChaveamento` e testavel direto, sem
   * depender de clique nenhum.
   */
  function sair() {
    // `salaSincronizada`, não `estaSincronizado`: o host que sai tem que soltar
    // a sala mesmo quando a própria tela dele já derivou para outra série (uma
    // onda nova reaponta o `watching` sem mexer no `sync`). Do contrário a
    // sincronia ficaria órfã, sem ninguém para desligá-la.
    saidaDaSerie(props.store, salaSincronizada(), props.onVoltar);
  }

  function irPara(delta: 1 | -1) {
    if (estaSincronizado()) {
      props.store.playbackControl(delta === 1 ? "proximoJogo" : "jogoAnterior");
      return;
    }
    const max = Math.max(0, totalJogos() - 1);
    setIndiceLocal((i) => Math.min(max, Math.max(0, i + delta)));
  }

  /** O jogo exibido e o que decidiu a serie (ver `serieDecididaAteAqui`). */
  const serieDecidida = () => serieDecididaAteAqui(indiceAtual(), totalJogos());

  /**
   * Fase 4 -- o que "continuar" (botao do PlaybackScreen) faz depende do
   * contexto: com jogo pela frente, avanca (mesma regra de `irPara`, so quem
   * `podeNavegar` decide por sincronia); com a serie decidida, mostra a tela
   * de resultado. Essa segunda parte NAO passa por `podeNavegar` de proposito
   * -- ao contrario de avancar de jogo, mostrar o resultado nao precisa de
   * lockstep nenhum: o jogo que acabou de decidir a serie ja e o mesmo dado
   * final pra todo mundo (veio do servidor), entao cada tela pode chegar la
   * sozinha sem ninguem ficar pra tras (mesmo raciocinio da revelacao natural
   * do ChampionSelect na Fase 3 -- so o "pular" manual precisava de lockstep,
   * nao o fim natural).
   */
  /**
   * "Proximo jogo" cinza no jogo decisivo contava, desde o primeiro segundo,
   * que a serie acabava ali (revisao final, achado 5). Enquanto a serie nao foi
   * revelada para mim, o botao fica ativo; no ultimo jogo ele leva ao resultado
   * da serie -- a pessoa escolheu pular para o fim.
   */
  const serieReveladaParaMim = () => {
    const s = serie();
    const ctx = revelacaoDaSala(props.store);
    return s !== null && ctx !== null && serieRevelada(s, ctx);
  };
  const [finishedGame, setFinishedGame] = createSignal<string | null>(null);
  const jogoTerminou = () => finishedGame() === chaveJogoAtual() && jogoAtual() !== null;
  const proximoDesabilitado = () => !jogoTerminou() || (indiceAtual() >= totalJogos() - 1 && serieReveladaParaMim());
  function proximoPelaBarra() {
    if (proximoDesabilitado()) return;
    if (indiceAtual() >= totalJogos() - 1) {
      continuar();
      return;
    }
    irPara(1);
  }

  /** Vi o jogo que decidiu esta serie: o chaveamento pode mostrar o resultado (D1). */
  function registrarSerieVista() {
    setFinishedGame(chaveJogoAtual());
    const slot = meuSlot();
    if (slot !== null && serieDecidida()) marcarVistas(props.store.tournament()?.id, [slot]);
  }

  function continuar() {
    if (!jogoTerminou()) return;
    switch (decidirContinuar(serieDecidida(), podeNavegar())) {
      case "mostrarResultado":
        registrarSerieVista();
        setMostrarResultado(true);
        return;
      case "avancar":
        irPara(1);
        return;
      case "bloqueado":
        return;
    }
  }

  /** "Ver replay" da tela de resultado: so fecha ela, sem mexer em indice
   * nenhum -- volta pro ultimo jogo, onde a barra de navegacao ja existente
   * (prev/next) cuida do resto. */
  function fecharResultado() {
    setMostrarResultado(false);
  }

  /**
   * Props para SeriesResultScreen (reaproveitado do solo, Fase 4) a partir do
   * que a sala ja tem. `isUser` de cada time vem de comparar com `meuTimeId`,
   * nao de um lado fixo -- o mesmo cuidado do prop `perspectiva` no
   * PlaybackScreen (Fase 2): espectador puro (nenhum time bate) cai sozinho
   * na copy neutra que o componente ja tinha ("{time} avancou").
   */
  const dadosResultado = (): { series: SeriesState; teams: Record<string, TournamentTeam> } | null => {
    const s = serie();
    const jogos = jogosDaSerie();
    if (s === null || jogos === null || s.teamAId === null || s.teamBId === null) return null;

    const timeA = timePorId(s.teamAId);
    const timeB = timePorId(s.teamBId);
    if (timeA === null || timeB === null) return null;

    const meuId = meuTimeId();
    const constroiTime = (wire: TournamentTeamWire): TournamentTeam => ({
      id: wire.id,
      isUser: isUserTeam(wire.id, meuId),
      displayName: wire.displayName,
      tag: wire.tag,
      roster: rosterDoTime(wire.id),
    });

    return {
      series: {
        status: s.status,
        teamAId: s.teamAId,
        teamBId: s.teamBId,
        wins: s.wins,
        games: jogos,
        winnerId: s.winnerId,
        fearlessUsed: {},
      },
      teams: {
        [timeA.id]: constroiTime(timeA),
        [timeB.id]: constroiTime(timeB),
      },
    };
  };

  /** Sem o total: "Jogo 1 de 3" ja contava que a serie acabava 3 a 0
   * (Rundown da Sala 2, achado 4). Uma unica string pelo mesmo motivo do SSR:
   * o Solid envolve cada expressao dinamica em comentarios de hidratacao, entao
   * "Jogo {n} · melhor de 5" nunca ficaria contiguo no HTML. */
  const textoIndicador = () => `Jogo ${indiceAtual() + 1} · melhor de 5`;

  /**
   * O que dizer quando não há partida para desenhar. "Carregando a partida…"
   * é verdade enquanto a timeline não chegou (D-27: ela vem numa mensagem
   * separada), mas era mentira quando a série já estava aqui e o índice
   * sincronizado simplesmente não existe nela — aí a espera nunca termina, e
   * quem lê "carregando" fica esperando (G-1 da revisão final).
   */
  const jogoForaDaSerie = () => jogosDaSerie() !== null && jogoAtual() === null;
  const textoSemPartida = () =>
    jogoForaDaSerie()
      ? "A sala está sincronizada num jogo que esta série não tem."
      : "Carregando a partida…";

  /**
   * Reconstrucao de MatchResult + props do PlaybackScreen a partir do
   * StoredGame -- mesma logica de App.tsx/handleReplaySeries (D-08),
   * repetida aqui e nao importada, porque o jogo solo nao expoe essa
   * conversao como funcao.
   */
  const renomearNarracao = criarNarracaoComMemoria();

  const dadosPlayback = () => {
    const s = serie();
    const jogo = jogoAtual();
    if (s === null || jogo === null || s.teamAId === null || s.teamBId === null) return null;

    const enquadrado = jogo.userFrameTeamId ?? s.teamAId;
    const rival = enquadrado === s.teamAId ? s.teamBId : s.teamAId;
    const aEhEnquadrado = enquadrado === s.teamAId;

    const timeEnquadrado = timePorId(enquadrado);
    const timeRival = timePorId(rival);
    if (timeEnquadrado === null || timeRival === null) return null;

    const result: MatchResult = {
      winner: jogo.winnerId === enquadrado ? "user" : "rival",
      // "Seu time"/"Rival" do motor -> nomes reais (narracao.ts, achado S9).
      events: renomearNarracao(jogo.events, timeEnquadrado.displayName, timeRival.displayName),
      totalPlaybackMs: jogo.totalPlaybackMs,
    };

    const { userWins, rivalWins } = placarAteAqui(jogosDaSerie() ?? [], indiceAtual(), enquadrado, rival);

    return {
      result,
      perspectiva: perspectivaDoEspectador(meuTimeId(), enquadrado, rival),
      userRoster: rosterDoTime(enquadrado),
      rivalRoster: rosterDoTime(rival),
      userChampions: aEhEnquadrado ? jogo.champions.teamA : jogo.champions.teamB,
      rivalChampions: aEhEnquadrado ? jogo.champions.teamB : jogo.champions.teamA,
      userTeamName: timeEnquadrado.displayName,
      rivalTeamName: timeRival.displayName,
      userTeamTag: timeEnquadrado.tag,
      rivalTeamTag: timeRival.tag,
      seriesUserWins: userWins,
      seriesRivalWins: rivalWins,
    };
  };

  /**
   * O torneio pode ter acabado em outra serie enquanto eu continuo vendo
   * esta -- sem aviso, a virada para o podio so acontece quando eu clicar
   * "voltar" por conta propria (achado de UX, Fase 1 item 9).
   */
  const campeao = () => {
    const t = props.store.tournament();
    if (t === null || t.championId === null) return null;
    return timePorId(t.championId);
  };

  /** Na propria Grande Final o banner anunciava o campeao no primeiro segundo
   * do Jogo 1. Ali o resultado chega pela propria partida. */
  const campeaoParaBanner = () => {
    if (meuSlot() === "GF") return null;
    // Sem spoiler (D1): so depois de a pessoa ter visto a final (ou pedido o podio).
    const t = props.store.tournament();
    const ctx = revelacaoDaSala(props.store);
    if (t === null || ctx === null || !finalRevelada(t, ctx)) return null;
    return campeao();
  };

  /** Um so texto dinamico, mesmo motivo de `nomeTime` em BracketSeriesList.tsx:
   * o SSR do Solid envolve cada expressao em comentarios de hidratacao, entao
   * duas expressoes lado a lado ("{a} {b}") nunca ficam contiguas no HTML. */
  const nomeCampeao = (time: TournamentTeamWire) => `${time.tag} ${time.displayName}`;

  return (
    <section class="room-watch">
      <Show when={campeaoParaBanner()}>
        {(time) => (
          <p class="room-watch__champion-banner" role="status">
            🏆 Torneio encerrado · {nomeCampeao(time())} é campeão.{" "}
            <button type="button" class="room-watch__champion-link" onClick={sair}>
              Ver pódio
            </button>
          </p>
        )}
      </Show>
      <Show
        when={dadosPlayback()}
        fallback={
          // Sem PlaybackScreen não há `onPlayAgain`, e era ele o único caminho
          // de volta desta tela. Uma tela sem saída é a pior falha de interface
          // que este plano pode entregar — o botão fica aqui, sempre.
          <div class="room-watch__sem-partida">
            <p class="room-watch__loading">{textoSemPartida()}</p>
            <button type="button" class="room-btn room-watch__back-btn" onClick={sair}>
              Voltar ao chaveamento
            </button>
          </div>
        }
      >
        {(dados) => (
          <Show
            when={mostrarResultado() && dadosResultado()}
            fallback={
              <>
                <div class="room-watch__nav">
                  {/* Em sincronia o convidado acompanha o host (D-28): sair daqui so
                      marcaria "voltei" localmente e o chaveamento, sem cards
                      clicaveis, o deixaria preso ate o host soltar a sincronia.
                      Quem nao pode navegar nao ve o botao. */}
                  <Show when={podeNavegar()}>
                    <button type="button" class="room-btn room-btn--small room-btn--ghost room-watch__back-link" onClick={sair}>
                      ← Chaveamento
                    </button>
                  </Show>
                  <Show when={podeNavegar()}>
                    <button
                      type="button"
                      class="room-btn room-btn--small room-watch__nav-btn"
                      disabled={indiceAtual() === 0}
                      onClick={() => irPara(-1)}
                    >
                      Jogo anterior
                    </button>
                  </Show>
                  <span class="room-watch__nav-indicator">{textoIndicador()}</span>
                  <Show when={!podeNavegar()}>
                    <span class="room-watch__sync-note">Assistindo juntos: o host avança os jogos.</span>
                  </Show>
                  <Show when={podeNavegar()}>
                    <button
                      type="button"
                      class="room-btn room-btn--small room-watch__nav-btn"
                      disabled={proximoDesabilitado()}
                      onClick={proximoPelaBarra}
                    >
                      Próximo jogo
                    </button>
                  </Show>
                  <Show when={podeVerBotaoPular()}>
                    <button type="button" class="room-btn room-btn--small room-watch__nav-btn" onClick={pularSelecao}>
                      Pular introdução →
                    </button>
                  </Show>
                </div>

                <Show
                  when={estagio() === "playback"}
                  fallback={
                    <ChampionSelect
                      userRoster={dados().userRoster}
                      rivalRoster={dados().rivalRoster}
                      userChampions={dados().userChampions}
                      rivalChampions={dados().rivalChampions}
                      catalogue={catalogo() ?? []}
                      userTeamName={dados().userTeamName}
                      rivalTeamName={dados().rivalTeamName}
                      userTeamTag={dados().userTeamTag}
                      rivalTeamTag={dados().rivalTeamTag}
                      canSkip={!estaSincronizado()}
                      onComplete={() => setLocalStage("playback")}
                    />
                  }
                >
                  <PlaybackScreen
                    result={dados().result}
                    perspectiva={dados().perspectiva}
                    speedPreset="fast"
                    onPlayAgain={continuar}
                    onFimDaPartida={registrarSerieVista}
                    secondaryLabel="Voltar ao chaveamento"
                    onSecondary={podeNavegar() ? sair : undefined}
                    continueLabel={rotuloContinuar(serieDecidida(), podeNavegar())}
                    userRoster={dados().userRoster}
                    rivalRoster={dados().rivalRoster}
                    userChampions={dados().userChampions}
                    rivalChampions={dados().rivalChampions}
                    catalogue={catalogo() ?? []}
                    userTeamName={dados().userTeamName}
                    rivalTeamName={dados().rivalTeamName}
                    userTeamTag={dados().userTeamTag}
                    rivalTeamTag={dados().rivalTeamTag}
                    seriesUserWins={dados().seriesUserWins}
                    seriesRivalWins={dados().seriesRivalWins}
                  />
                </Show>
              </>
            }
          >
            {(res) => (
              <SeriesResultScreen
                slotId={meuSlot()!}
                series={res().series}
                teams={res().teams}
                catalogue={catalogo() ?? []}
                onContinue={() => {
                  const t = props.store.tournament();
                  const id = props.store.publicId();
                  if (t && id && t.barreira.includes(id) && !t.resultadosLiberados) props.store.setReady(true);
                  sair();
                }}
                onReplay={fecharResultado}
                continueLabel={props.store.tournament()?.barreira.includes(props.store.publicId() ?? "") && !props.store.tournament()?.resultadosLiberados ? "Ready · terminei de assistir" : rotuloDoResultado(props.store.state()?.phase)}
              />
            )}
          </Show>
        )}
      </Show>
    </section>
  );
}
