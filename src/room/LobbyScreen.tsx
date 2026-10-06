import { ChaosSlider } from "../components/ChaosSlider";
import { StatsVisibilityToggle } from "../components/StatsVisibilityToggle";
import { type StatsMode } from "../data/statsPolicy";
/**
 * src/room/LobbyScreen.tsx
 *
 * Lobby da sala: entrar (com time, ou so para assistir se a sala ja comecou),
 * ver quem chegou e com que sigla, e -- so para quem hospeda -- preparar o
 * draft em tres passos: convidar, escolher a base de jogadores e o tempo por
 * turno (Rundown da Sala 2, Fases B e E).
 *
 * Conexao e erro do servidor nao aparecem aqui: a faixa da RoomShell cuida
 * deles em todas as fases.
 */

import { createEffect, createSignal, For, Show } from "solid-js";
import type { RoomStore } from "../net/store";
import type { RoomPlayerWire } from "../../server/protocol";
import { MAX_PLAYERS, MAX_TURN_SECONDS, MIN_PLAYERS_TO_START, MIN_TURN_SECONDS, PICKS_PER_SEAT, SEATS } from "../../server/protocol";
import { ROLE_LONG_LABELS } from "../draft/hints";
import { coberturaDaBase, type BaseDisponivel, type CoberturaDaBase } from "./bases";
import { siglasDoLobby } from "./identidade";
import { tagsUnicos } from "../tournament/teamNames";

interface LobbyScreenProps {
  store: RoomStore;
  hostToken?: string;
  hostAuto?: boolean;
  /** Links que o servidor anunciou em /api/room-info. Nunca levam o token de host. */
  convites?: string[];
  /** O tunel foi pedido e o link publico ainda nao saiu: a lista vai crescer. */
  aguardandoTunel?: boolean;
  /**
   * Fase da sala segundo /api/room-info, para quem ainda nao entrou: fora do
   * lobby, a entrada e so para assistir (S19).
   */
  faseAntesDeEntrar?: string;
  /** Pacotes lidos dos arquivos (pela API) que o host pode publicar como base (D10). */
  bases?: BaseDisponivel[];
}

const ATALHOS_DE_TURNO = [30, 60, 90, 120];

/** Texto das faltas de uma base: "faltam 2 em Suporte e 1 em Topo". */
export function textoDasFaltas(c: CoberturaDaBase): string {
  const partes = c.faltas.map((f) => `${f.faltam} em ${ROLE_LONG_LABELS[f.rota]}`);
  return `faltam ${partes.join(", ")}`;
}

/**
 * O que ainda impede o host de comecar o draft, em frases. Vazio = pode
 * comecar. Antes o botao so ficava cinza, sem dizer por que (U19).
 */
export function bloqueiosDoDraft(estado: {
  conectados: number;
  basePronta: boolean;
  turnoValido: boolean;
}): string[] {
  const bloqueios: string[] = [];
  if (estado.conectados < MIN_PLAYERS_TO_START) {
    bloqueios.push(
      `Precisa de pelo menos ${MIN_PLAYERS_TO_START} pessoas conectadas (agora: ${estado.conectados}).`
    );
  }
  if (!estado.basePronta) bloqueios.push(`A base de jogadores não dá para ${SEATS} times · escolha outra no passo 2.`);
  if (!estado.turnoValido) {
    bloqueios.push(`O tempo por turno precisa ser um número inteiro entre ${MIN_TURN_SECONDS} e ${MAX_TURN_SECONDS} segundos.`);
  }
  return bloqueios;
}

export function LobbyScreen(props: LobbyScreenProps) {
  const lembrada = props.store.identidadeGuardada?.() ?? null;
  const [nickname, setNickname] = createSignal(lembrada?.nickname ?? "");
  const [teamName, setTeamName] = createSignal(lembrada?.teamName ?? "");
  const [tentouEnviar, setTentouEnviar] = createSignal(false);
  const [editando, setEditando] = createSignal(false);
  const [erroArquivo, setErroArquivo] = createSignal<string | null>(null);
  const [chaos, setChaos] = createSignal(props.store.state()?.settings.chaosLevel ?? 0.25);
  const [statsMode, setStatsMode] = createSignal<StatsMode>(props.store.state()?.settings.statsMode ?? "never");
  const [turnSeconds, setTurnSeconds] = createSignal(props.store.state()?.settings.turnSeconds ?? 60);
  const [linkCopiado, setLinkCopiado] = createSignal<string | null>(null);
  const [carregandoPadrao, setCarregandoPadrao] = createSignal(false);
  const [novoHost, setNovoHost] = createSignal<RoomPlayerWire | null>(null);
  const [jaFoiHost, setJaFoiHost] = createSignal(props.store.isHost());
  createEffect(() => { if (props.store.isHost()) setJaFoiHost(true); });

  const entrou = () => props.store.clientId() !== null && props.store.state() !== null;
  const enviando = () => props.store.status?.() === "entrando";
  const soAssistir = () => props.faseAntesDeEntrar !== undefined && props.faseAntesDeEntrar !== "lobby";

  /**
   * A entrada inicial pode usar o link do terminal; depois o controle pode
   * ser transferido pelo lobby. Nao tratar uma transferencia nesta sessao
   * como link invalido.
   */
  const tokenDeHostInvalido = () => entrou() && !props.store.state()?.hostAuto && props.hostToken !== undefined && !props.store.isHost() && !jaFoiHost();

  const jogadores = (): RoomPlayerWire[] => (props.store.state()?.players ?? []).filter((p) => !p.spectator);
  const siglas = () => siglasDoLobby(props.store.state()?.players ?? []);
  const conectados = () => jogadores().filter((p) => p.connected).length;
  const bots = () => Math.max(0, SEATS - conectados());
  const host = () => props.store.state()?.players.find((p) => p.isHost) ?? null;
  const souEu = (p: RoomPlayerWire) => p.publicId === props.store.publicId?.();

  const textoAguardando = () => {
    const h = host();
    return h === null ? "Aguardando quem hospeda começar o draft." : `Aguardando ${h.nickname} começar o draft.`;
  };

  /** Sigla que o time digitado vai ganhar, entre os que ja estao na sala. */
  const siglaPrevista = () => {
    const nome = teamName().trim();
    if (nome === "") return null;
    const outros = jogadores()
      .filter((p) => p.connected && !souEu(p))
      .map((p) => p.teamName);
    const tags = tagsUnicos([...outros, nome]);
    return tags[tags.length - 1] ?? null;
  };

  const turnoValido = () =>
    Number.isInteger(turnSeconds()) && turnSeconds() >= MIN_TURN_SECONDS && turnSeconds() <= MAX_TURN_SECONDS;
  const basePronta = () => props.store.state()?.baseStatus.ready === true;
  const bloqueios = () => bloqueiosDoDraft({ conectados: conectados(), basePronta: basePronta(), turnoValido: turnoValido() });

  const convites = () => props.convites ?? [];
  const temLinkHttps = () => convites().some((link) => link.startsWith("https://"));

  const faltasDaSala = (): CoberturaDaBase => {
    const st = props.store.state()?.baseStatus;
    if (st === undefined) return { pronta: false, faltas: [] };
    const faltas = (Object.keys(st.spareByRole) as (keyof typeof st.spareByRole)[])
      .map((rota) => ({ rota, faltam: st.needed - st.spareByRole[rota] }))
      .filter((f) => f.faltam > 0);
    return { pronta: st.ready, faltas };
  };

  async function copiarLink(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(link);
      setTimeout(() => setLinkCopiado(null), 2000);
    } catch {
      // Sem permissao de clipboard: o link continua visivel para copiar a mao.
    }
  }

  function entrar(ev: Event): void {
    ev.preventDefault();
    setTentouEnviar(true);
    const espectador = soAssistir() && !entrou();
    if (nickname().trim() === "") return;
    if (!espectador && teamName().trim() === "") return;
    if (editando()) {
      // Ja na sala: troca pelo socket aberto, sem cair (revisao final, achado 3).
      props.store.rename(nickname().trim(), teamName().trim());
    } else {
      props.store.connect(nickname().trim(), espectador ? "" : teamName().trim(), props.hostToken);
    }
    setEditando(false);
  }

  async function publicar(base: BaseDisponivel): Promise<void> {
    setErroArquivo(null);
    let jogadores = base.jogadores;
    if (base.atualizar !== undefined) {
      try {
        jogadores = await base.atualizar();
      } catch {
        setErroArquivo(`Não consegui ler o pacote "${base.nome}" agora. Tente de novo.`);
        return;
      }
    }
    props.store.publishBase({ players: jogadores }, base.nome);
  }

  async function publicarPadrao(): Promise<void> {
    setErroArquivo(null);
    setCarregandoPadrao(true);
    try {
      const res = await fetch("/api/base-padrao");
      if (!res.ok) throw new Error(String(res.status));
      props.store.publishBase((await res.json()) as unknown, "Base padrão do jogo");
    } catch {
      setErroArquivo("Não consegui carregar a base padrão do jogo. Tente de novo.");
    } finally {
      setCarregandoPadrao(false);
    }
  }

  async function escolherArquivo(ev: Event): Promise<void> {
    const input = ev.currentTarget as HTMLInputElement;
    const arquivo = input.files?.[0];
    // Deixa o campo pronto para reenviar o mesmo arquivo depois de um erro.
    input.value = "";
    if (arquivo === undefined) return;
    setErroArquivo(null);

    let texto: string;
    try {
      texto = await arquivo.text();
    } catch {
      setErroArquivo("Não consegui ler esse arquivo. Tente escolher de novo.");
      return;
    }
    let base: unknown;
    try {
      base = JSON.parse(texto) as unknown;
    } catch {
      setErroArquivo(`"${arquivo.name}" não é um JSON válido. Escolha um arquivo players.json do jogo.`);
      return;
    }
    props.store.publishBase(base, arquivo.name);
  }

  const formulario = () => (
    <form class="room-lobby__form" onSubmit={entrar}>
      <label class="room-lobby__field">
        Seu apelido
        <input value={nickname()} maxLength={24} autocomplete="nickname" onInput={(e) => setNickname(e.currentTarget.value)} />
      </label>
      <Show when={tentouEnviar() && nickname().trim() === ""}>
        <p class="room-note" role="status">
          Escreva um apelido para entrar.
        </p>
      </Show>
      <Show when={!(soAssistir() && !entrou())}>
        <label class="room-lobby__field">
          Nome do seu time
          <input value={teamName()} maxLength={24} onInput={(e) => setTeamName(e.currentTarget.value)} />
          <Show when={siglaPrevista()}>
            {(sigla) => <span class="room-lobby__field-hint">{`Sigla no chaveamento e na partida: ${sigla()}`}</span>}
          </Show>
        </label>
        <Show when={tentouEnviar() && teamName().trim() === ""}>
          <p class="room-note" role="status">
            Escreva um nome de time para entrar.
          </p>
        </Show>
      </Show>
      <div class="room-lobby__chips">
        <button class="room-btn room-btn--primary" type="submit" disabled={enviando()}>
          {enviando() ? "Entrando…" : editando() ? "Salvar" : soAssistir() && !entrou() ? "Entrar para assistir" : "Entrar na sala"}
        </button>
        <Show when={editando()}>
          <button type="button" class="room-btn" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </Show>
      </div>
    </form>
  );

  return (
    <Show
      when={entrou()}
      fallback={
        <section class="room-lobby room-lobby--entrada">
          <div class="room-card">
            <h2 class="room-title">{soAssistir() ? "A sala já começou" : "Entrar na sala"}</h2>
            <p class="room-help">
              {soAssistir()
                ? "Você entra para assistir: acompanha o draft e as séries, mas sem time, sem voto e sem marcar pronto."
                : `Escolha um apelido e o nome do seu time. O nome aparece no chaveamento e não pode repetir. Cabem até ${MAX_PLAYERS} pessoas; as vagas que sobrarem viram times controlados pelo computador.`}
            </p>
            <Show when={props.hostAuto && !soAssistir()}>
              <p class="room-help">O primeiro jogador a entrar assume o controle da sala. Todos usam este mesmo link.</p>
            </Show>
            {formulario()}
          </div>
        </section>
      }
    >
      <section class="room-lobby">
        <header class="room-card room-lobby__overview">
          <p class="room-lobby__eyebrow">SALA DE JOGO</p>
          <h2 class="room-title">Prepare a próxima disputa</h2>
          <p class="room-help">Reúna os times, escolha os jogadores e defina as regras antes do draft.</p>
          <dl class="room-lobby__summary">
            <div><dt>Participantes</dt><dd>{conectados()} / {MAX_PLAYERS}</dd></div>
            <div><dt>Times com bots</dt><dd>{bots()}</dd></div>
            <div><dt>Host da sala</dt><dd>{host()?.nickname ?? "Aguardando host"}</dd></div>
            <div><dt>Base em uso</dt><dd>{props.store.state()?.settings.baseName ?? "Base salva no servidor"}</dd></div>
          </dl>
        </header>
        <div class="room-card">
          <h2 class="room-title">{`Times na sala (${jogadores().length} de ${MAX_PLAYERS})`}</h2>
          <Show when={tokenDeHostInvalido()}>
            <p class="room-note" role="status">
              O link de host que você usou não vale mais para esta sala (ela deve ter reiniciado). Você entrou como
              convidado.
            </p>
          </Show>
          <p class="room-help">O host pode jogar de qualquer computador. A máquina que executa o servidor precisa continuar ligada.</p>
          <Show when={props.store.isHost() && novoHost()}>
            <div class="room-note" role="status">
              <p>Passar o controle para <strong>{novoHost()?.nickname}</strong>? Você continua jogando como convidado. O link de host anterior será desativado.</p>
              <p class="room-help">O novo host deve revisar as regras antes de começar. Opções ainda não aplicadas ficam neste navegador.</p>
              <div class="room-lobby__chips">
                <button type="button" class="room-btn room-btn--primary" onClick={() => {
                  const alvo = novoHost();
                  if (alvo) props.store.transferHost(alvo.publicId);
                  setNovoHost(null);
                }}>Transferir controle</button>
                <button type="button" class="room-btn" onClick={() => setNovoHost(null)}>Cancelar</button>
              </div>
            </div>
          </Show>
          <ul class="room-lobby__players">
            <For each={jogadores()}>
              {(p) => (
                <li class="room-lobby__player" classList={{ "is-offline": !p.connected, "is-me": souEu(p) }}>
                  <span class="room-lobby__tag">{siglas().get(p.publicId) ?? "-"}</span>
                  <span class="room-lobby__team">{p.teamName}</span>
                  <span class="room-lobby__nick">{p.nickname}</span>
                  <Show when={souEu(p)}>
                    <span class="room-badge room-badge--you">você</span>
                  </Show>
                  <Show when={p.isHost}>
                    <span class="room-badge room-badge--gold">host</span>
                  </Show>
                  <Show when={!p.connected}>
                    <span class="room-badge room-badge--warn">caiu</span>
                  </Show>
                  <span class="room-lobby__player-actions">
                    <Show when={souEu(p) && !editando()}>
                      <button
                        type="button"
                        class="room-btn room-btn--small"
                        onClick={() => {
                          setNickname(p.nickname);
                          setTeamName(p.teamName);
                          setEditando(true);
                        }}
                      >
                        Trocar nome
                      </button>
                    </Show>
                    <Show when={props.store.isHost() && p.connected && !p.isHost && !souEu(p)}>
                      <button type="button" class="room-btn room-btn--small" onClick={() => setNovoHost(p)}>Tornar host</button>
                    </Show>
                    <Show when={props.store.isHost() && !p.connected && !souEu(p)}>
                      <button type="button" class="room-btn room-btn--small" onClick={() => props.store.removePlayer(p.publicId)}>
                        Remover
                      </button>
                    </Show>
                  </span>
                </li>
              )}
            </For>
            <Show when={bots() > 0}>
              <li class="room-lobby__player is-bot">
                {`+ ${bots()} ${bots() === 1 ? "time controlado" : "times controlados"} pelo computador (bots) para fechar os ${SEATS} do chaveamento.`}
              </li>
            </Show>
          </ul>
          <Show when={editando()}>{formulario()}</Show>
          <Show when={!props.store.isHost()}>
            <p class="room-note room-note--ok" role="status">
              {textoAguardando()}
            </p>
          </Show>
        </div>

        <Show
          when={props.store.isHost()}
          fallback={
            <div class="room-card">
              <h3 class="room-subtitle">Como a noite funciona</h3>
              <ol class="room-lobby__steps">
                <li class="room-lobby__step">
                  <p class="room-lobby__step-title">Draft</p>
                  <p class="room-help">
                    {`${PICKS_PER_SEAT} voltas; em cada uma, cada time leva 1 jogador para uma rota que ainda esteja vazia. Na sua vez aparece a sua mão de cartas e um relógio · se o tempo acabar, o jogo escolhe por você.`}
                  </p>
                </li>
                <li class="room-lobby__step">
                  <p class="room-lobby__step-title">Torneio</p>
                  <p class="room-help">
                    {`Chave dupla com ${SEATS} times e séries melhor de 5. Perder uma série na chave superior manda o time para a inferior; perder na inferior elimina.`}
                  </p>
                </li>
                <li class="room-lobby__step">
                  <p class="room-lobby__step-title">Rodadas</p>
                  <p class="room-help">
                    Cada rodada começa quando todo mundo marca “pronto”. Você assiste à série do seu time · o
                    resultado só aparece para você depois que você a vê.
                  </p>
                </li>
            </ol>
            </div>
          }
        >
          <div class="room-card room-lobby__configuration">
            <h3 class="room-subtitle">Preparar o draft</h3>
            <p class="room-help">Você é o host desta sala: só você escolhe a base, o tempo e começa o draft.</p>
            <ol class="room-lobby__steps">
              <li class="room-lobby__step" classList={{ "is-ok": conectados() >= MIN_PLAYERS_TO_START }}>
                <p class="room-lobby__step-title">Convide os amigos</p>
                <Show
                  when={convites().length > 0}
                  fallback={
                    <p class="room-help">
                      Mande para o grupo o link "Amigos na sua rede" que aparece no terminal (ou o link público, se você
                      subiu com --tunnel).
                    </p>
                  }
                >
                  <For each={convites()}>
                    {(link) => (
                      <div class="room-lobby__invite-row">
                        <code class="room-lobby__invite-link">{link}</code>
                        <button type="button" class="room-btn room-btn--small" onClick={() => void copiarLink(link)}>
                          {linkCopiado() === link ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    )}
                  </For>
                  <p class="room-help">
                    {temLinkHttps()
                      ? "O link https funciona de qualquer lugar; os de número só no mesmo wi-fi."
                      : "Esses links funcionam só para quem está no mesmo wi-fi."}
                  </p>
                </Show>
                <Show when={props.aguardandoTunel === true}>
                  <p class="room-help">Gerando o link público (túnel)… ele aparece aqui em alguns segundos.</p>
                </Show>
              </li>

              <li class="room-lobby__step" classList={{ "is-ok": basePronta() }}>
                <p class="room-lobby__step-title">Base de jogadores</p>
                <div class="room-base-active" role="status">
                  <span>BASE SELECIONADA</span>
                  <strong>{props.store.state()?.settings.baseName ?? "Base salva no servidor"}</strong>
                  <small>{basePronta() ? "Pronta para o draft" : "Verifique a cobertura das rotas"}</small>
                </div>
                <Show when={props.store.state()?.baseSummary}>
                  <p class="room-help">{props.store.state()?.baseSummary?.cards} cartas · {props.store.state()?.baseSummary?.people} jogadores</p>
                  <p class="room-help">{props.store.state()?.baseSummary?.examples.join(", ")}</p>
                </Show>
                <Show
                  when={basePronta()}
                  fallback={
                    <p class="room-note" role="status">
                      {`A base da sala pode deixar um dos ${SEATS} times sem jogador numa rota (${textoDasFaltas(faltasDaSala())}, de quem só joga aquela rota). Escolha uma base abaixo.`}
                    </p>
                  }
                >
                  <p class="room-note room-note--ok">{`Base pronta: nenhuma sequência de escolhas deixa um dos ${SEATS} times sem rota.`}</p>
                </Show>
                <Show when={props.store.baseMessage()}>
                  {(msg) => <p class="room-help">{msg()}</p>}
                </Show>
                <ul class="room-lobby__bases">
                  <li class="room-lobby__base" classList={{ "is-selected": props.store.state()?.settings.baseName === "Base padrão do jogo" }}>
                    <span class="room-lobby__base-name">Base padrão do jogo</span>
                    <span class="room-lobby__base-info">Os profissionais que vêm com o LoL 7 a 0.</span>
                    <button
                      type="button"
                      class="room-btn room-btn--small"
                      aria-pressed={props.store.state()?.settings.baseName === "Base padrão do jogo"}
                      disabled={carregandoPadrao()}
                      onClick={() => void publicarPadrao()}
                    >
                      {carregandoPadrao() ? "Carregando…" : props.store.state()?.settings.baseName === "Base padrão do jogo" ? "✓ Selecionada" : "Usar esta base"}
                    </button>
                  </li>
                  <For each={props.bases ?? []}>
                    {(base) => {
                      const cobertura = coberturaDaBase(base.jogadores);
                      return (
                        <li class="room-lobby__base" classList={{ "is-selected": props.store.state()?.settings.baseName === base.nome }}>
                          <span class="room-lobby__base-name">{base.nome}</span>
                          <span class="room-lobby__base-info" classList={{ "is-bad": !cobertura.pronta }}>
                            {cobertura.pronta
                              ? `${base.jogadores.length} jogadores · dá para ${SEATS} times`
                              : `${base.jogadores.length} jogadores · ${textoDasFaltas(cobertura)}`}
                          </span>
                          <button
                            type="button"
                            class="room-btn room-btn--small"
                            aria-pressed={props.store.state()?.settings.baseName === base.nome}
                            disabled={!cobertura.pronta}
                            onClick={() => void publicar(base)}
                          >
                            {props.store.state()?.settings.baseName === base.nome ? "✓ Selecionada" : "Usar esta base"}
                          </button>
                        </li>
                      );
                    }}
                  </For>
                </ul>
                <details class="room-lobby__advanced">
                  <summary>Opção avançada: usar um arquivo players.json</summary>
                  <label class="room-lobby__file">
                    <input type="file" accept=".json,application/json" onChange={escolherArquivo} />
                  </label>
                </details>
                <Show when={erroArquivo()}>
                  {(msg) => <p class="room-note room-note--danger">{msg()}</p>}
                </Show>
              </li>

              <li class="room-lobby__step" classList={{ "is-ok": turnoValido() }}>
                <p class="room-lobby__step-title">Tempo por turno no draft</p>
                <div class="room-lobby__chips" role="group" aria-label="Segundos por turno">
                  <For each={ATALHOS_DE_TURNO}>
                    {(s) => (
                      <button
                        type="button"
                        class="room-btn room-btn--small"
                        classList={{ "room-btn--active": turnSeconds() === s }}
                        aria-pressed={turnSeconds() === s}
                        onClick={() => setTurnSeconds(s)}
                      >
                        {`${s} s`}
                      </button>
                    )}
                  </For>
                  <label class="room-lobby__field">
                    <input
                      type="number"
                      aria-label="Outro tempo, em segundos"
                      min={MIN_TURN_SECONDS}
                      max={MAX_TURN_SECONDS}
                      value={turnSeconds()}
                      onInput={(e) => setTurnSeconds(Number(e.currentTarget.value))}
                    />
                  </label>
                </div>
              </li>
              <li class="room-lobby__step">
                <p class="room-lobby__step-title">Regras da partida</p>
                <p class="room-help">Estas opções valem para toda a sala ao começar o draft.</p>
                <div class="room-lobby__rules">
                  <StatsVisibilityToggle value={statsMode} onChange={setStatsMode} />
                  <ChaosSlider value={chaos} onChange={setChaos} />
                </div>
              </li>
            </ol>

            <div class="room-lobby__launch">
            <p class="room-help">{bloqueios().length === 0 ? "Tudo pronto para começar." : "Confira o que falta para liberar o draft."}</p>
            <button
              class="room-btn room-btn--primary"
              disabled={bloqueios().length > 0}
              onClick={() => props.store.startDraft(turnSeconds(), statsMode(), chaos())}
            >
              {`Começar o draft (${conectados()} ${conectados() === 1 ? "pessoa" : "pessoas"} + ${bots()} bots)`}
            </button>
            <Show when={bloqueios().length > 0}>
              <ul class="room-lobby__blockers">
                <For each={bloqueios()}>{(b) => <li>{b}</li>}</For>
              </ul>
            </Show>
            </div>
          </div>
        </Show>
      </section>
    </Show>
  );
}
