/**
 * src/pacotes/EditorDoPacote.tsx
 *
 * Editor de um pacote (secao 3.4 da spec 2026-10-05-editor-de-pacotes-design):
 * pessoas a esquerda, pessoa e carta no centro, previa do draft a direita. As
 * mudancas ficam no rascunho ate o Salvar (E-05).
 */

import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import type { ChampionEntry } from "../data/schema";
import type { ApiDePacotes } from "./api";
import type { ErrosDaCarta } from "./regrasDaCarta";
import { notaGeral } from "./regrasDaCarta";
import {
  adicionarCarta,
  adicionarPessoa,
  contarAlteracoes,
  criarRascunho,
  errosPorCarta,
  fotoParaMostrar,
  fotosParaSubir,
  marcarFoto,
  pessoasDoRascunho,
  removerCarta,
  removerFoto,
  renomearPacote,
  renomearPessoa,
  type Rascunho,
} from "./rascunho";
import { descartarRascunho, salvarRascunho } from "./salvar";
import { recortarFoto } from "./foto";
import { marcarFotoTrocada, urlDaFoto } from "./fotoCache";
import { NOME_DA_ROTA } from "./resumo";
import { CabecalhoDoEditor } from "./CabecalhoDoEditor";
import { ListaDePessoas } from "./ListaDePessoas";
import { FormularioDaCarta } from "./FormularioDaCarta";
import { PreviaDaCarta } from "./PreviaDaCarta";
import { Icone, IconeDeRota } from "./Icones";
import { Modal } from "./Modal";
import { Avatar } from "./Selos";
import "./pacotes.css";

type Dialogo =
  | { tipo: "sair" }
  | { tipo: "conflito" }
  | { tipo: "nome"; alvo: "pacote" | "pessoa" | "nova-pessoa" }
  | { tipo: "foto"; personId: string; dados: Blob; previa: string };

const TITULO_DO_NOME = { pacote: "Nome do pacote", pessoa: "Nome da pessoa", "nova-pessoa": "Nova pessoa" } as const;

export function EditorDoPacote(props: {
  api: ApiDePacotes;
  id: string;
  campeoes: ChampionEntry[];
  onVoltar: () => void;
  onMudou: () => void;
}) {
  const [rascunho, setRascunho] = createSignal<Rascunho | null>(null);
  const [erroDeCarga, setErroDeCarga] = createSignal<string | null>(null);
  const [pessoaAberta, setPessoaAberta] = createSignal<string | null>(null);
  const [cartaAberta, setCartaAberta] = createSignal<string | null>(null);
  const [salvando, setSalvando] = createSignal(false);
  const [aviso, setAviso] = createSignal<string | null>(null);
  const [errosDoServidor, setErrosDoServidor] = createSignal<ErrosDaCarta[]>([]);
  const [dialogo, setDialogo] = createSignal<Dialogo | null>(null);
  const [textoDoNome, setTextoDoNome] = createSignal("");
  const [erroDaFoto, setErroDaFoto] = createSignal<string | null>(null);
  // Previas (object URLs) criadas por este editor e ainda vivas, para nao vazar.
  const previasVivas = new Set<string>();
  const soltarPrevia = (url: string) => {
    if (previasVivas.delete(url)) URL.revokeObjectURL(url);
  };
  onCleanup(() => {
    for (const url of previasVivas) URL.revokeObjectURL(url);
    previasVivas.clear();
  });

  const aplicar = (f: (r: Rascunho) => Rascunho) => {
    // Revisao final I-1: durante o Salvar nenhuma edicao entra (seria perdida).
    if (salvando()) return;
    setRascunho((r) => (r === null ? r : f(r)));
    setErrosDoServidor([]);
  };

  const pessoas = createMemo(() => {
    const r = rascunho();
    return r === null ? [] : pessoasDoRascunho(r);
  });
  const erros = createMemo(() => {
    const r = rascunho();
    const mapa = r === null ? new Map<string, string[]>() : errosPorCarta(r);
    for (const e of errosDoServidor()) mapa.set(e.id, [...(mapa.get(e.id) ?? []), ...e.erros]);
    return mapa;
  });
  const pessoasComErro = createMemo(() => {
    const ids = new Set<string>();
    for (const c of rascunho()?.cartas ?? []) if (erros().has(c.id)) ids.add(c.personId);
    return ids;
  });
  const alteracoes = () => {
    const r = rascunho();
    return r === null ? 0 : contarAlteracoes(r);
  };
  const pessoa = () => pessoas().find((p) => p.personId === pessoaAberta()) ?? null;
  const carta = () => {
    const p = pessoa();
    return p === null ? null : (p.cartas.find((c) => c.id === cartaAberta()) ?? p.cartas[0] ?? null);
  };

  function abrirPessoa(personId: string | null, cartaId?: string) {
    setPessoaAberta(personId);
    setCartaAberta(cartaId ?? null);
  }

  async function carregar() {
    setErroDeCarga(null);
    try {
      const r = criarRascunho(await props.api.carregar(props.id));
      setRascunho(r);
      if (!r.cartas.some((c) => c.personId === pessoaAberta())) abrirPessoa(r.cartas[0]?.personId ?? null);
    } catch (e) {
      setErroDeCarga(e instanceof Error ? e.message : String(e));
    }
  }

  onMount(() => {
    void carregar();
    // Fechar a aba com alteracoes nao salvas (secao 3.4).
    const avisar = (e: BeforeUnloadEvent) => {
      if (alteracoes() > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    onCleanup(() => window.removeEventListener("beforeunload", avisar));
  });

  async function salvar(forcar = false) {
    const r = rascunho();
    if (r === null || salvando()) return;
    setSalvando(true);
    setAviso(null);
    // O caminho da foto nao muda: marca as trocadas para a tela buscar de novo.
    const trocadas = fotosParaSubir(r).map(([personId]) => personId);
    let res: Awaited<ReturnType<typeof salvarRascunho>>;
    try {
      res = await salvarRascunho(r, props.api, { forcar });
    } catch (e) {
      // salvarRascunho ja converte erros em resultado; isto e so a rede de seguranca.
      setAviso(`Não consegui gravar o arquivo (${e instanceof Error ? e.message : "erro inesperado"}).`);
      return;
    } finally {
      setSalvando(false);
    }
    for (const personId of trocadas) marcarFotoTrocada(personId);
    setRascunho(res.rascunho);
    if (res.tipo === "salvo") {
      setErrosDoServidor([]);
      setAviso("Salvo. Commite para levar ao outro PC.");
      props.onMudou();
    } else if (res.tipo === "conflito") {
      setDialogo({ tipo: "conflito" });
    } else if (res.tipo === "sem-permissao") {
      setAviso("Só o dono pode salvar. Abra pelo link de host que o servidor mostra ao subir.");
    } else if (res.tipo === "invalido") {
      setErrosDoServidor(res.cartas);
      setAviso(res.erro);
    } else {
      setAviso(res.mensagem);
    }
  }

  async function descartar() {
    const r = rascunho();
    if (r !== null) await descartarRascunho(r, props.api);
    setAviso(null);
    setErrosDoServidor([]);
    await carregar();
  }

  async function descartarESair() {
    const r = rascunho();
    if (r !== null) await descartarRascunho(r, props.api);
    props.onVoltar();
  }

  function voltar() {
    if (salvando()) return;
    if (alteracoes() > 0) setDialogo({ tipo: "sair" });
    else props.onVoltar();
  }

  function abrirNome(alvo: "pacote" | "pessoa" | "nova-pessoa") {
    setTextoDoNome(alvo === "pacote" ? (rascunho()?.nome ?? "") : alvo === "pessoa" ? (pessoa()?.nome ?? "") : "");
    setDialogo({ tipo: "nome", alvo });
  }

  function confirmarNome(alvo: "pacote" | "pessoa" | "nova-pessoa") {
    const valor = textoDoNome().trim();
    if (valor === "" || salvando()) return;
    setDialogo(null);
    if (alvo === "pacote") aplicar((r) => renomearPacote(r, valor));
    else if (alvo === "pessoa") {
      const p = pessoaAberta();
      if (p !== null) aplicar((r) => renomearPessoa(r, p, valor));
    } else {
      const r = rascunho();
      if (r === null) return;
      const nova = adicionarPessoa(r, valor);
      setRascunho(nova.rascunho);
      abrirPessoa(nova.personId, nova.cartaId);
    }
  }

  async function escolherFoto(personId: string, arquivo: File | undefined) {
    if (arquivo === undefined || salvando()) return;
    setErroDaFoto(null);
    try {
      const { dados, previa } = await recortarFoto(arquivo);
      previasVivas.add(previa);
      setDialogo({ tipo: "foto", personId, dados, previa });
    } catch (e) {
      setErroDaFoto(e instanceof Error ? e.message : "Não consegui usar essa foto.");
    }
  }

  function novaCarta(personId: string) {
    if (salvando()) return;
    const r = rascunho();
    if (r === null) return;
    const nova = adicionarCarta(r, personId);
    setRascunho(nova.rascunho);
    setCartaAberta(nova.cartaId);
  }

  function removerCartaAberta(cartaId: string) {
    aplicar((r) => removerCarta(r, cartaId));
    setCartaAberta(null);
    if (pessoa() === null) abrirPessoa(pessoas()[0]?.personId ?? null);
  }

  const dialogoDe = <T extends Dialogo["tipo"]>(tipo: T) => {
    const d = dialogo();
    return d !== null && d.tipo === tipo ? (d as Extract<Dialogo, { tipo: T }>) : null;
  };

  return (
    <div class="pk-tela">
      <div class="pk-conteudo">
        <Show when={erroDeCarga()}>
          {(msg) => (
            <div class="pk-aviso pk-aviso--erro" role="alert">
              Não consegui abrir o pacote ({msg()}).{" "}
              <button type="button" class="pk-btn" onClick={() => void carregar()}>
                Tentar de novo
              </button>{" "}
              <button type="button" class="pk-btn pk-btn--texto" onClick={() => props.onVoltar()}>
                Voltar
              </button>
            </div>
          )}
        </Show>
        <Show when={rascunho()}>
          {(r) => (
            <>
              <CabecalhoDoEditor
                nome={r().nome}
                cartas={r().cartas}
                alteracoes={alteracoes()}
                cartasComErro={erros().size}
                salvando={salvando()}
                onVoltar={voltar}
                onRenomear={() => abrirNome("pacote")}
                onDescartar={() => void descartar()}
                onSalvar={() => void salvar()}
              />
              <Show when={aviso()}>{(msg) => <p class="pk-aviso" role="status">{msg()}</p>}</Show>
              <div class="pk-editor" inert={salvando()}>
                <ListaDePessoas
                  pessoas={pessoas()}
                  selecionada={pessoaAberta()}
                  comErro={pessoasComErro()}
                  fotoDe={(personId) => fotoParaMostrar(r(), personId)}
                  onEscolher={(personId) => abrirPessoa(personId)}
                  onNovaPessoa={() => abrirNome("nova-pessoa")}
                />
                <section class="pk-centro">
                  <Show when={pessoa()} fallback={<p class="pk-vazio">Este pacote ainda não tem ninguém. Comece em "Nova pessoa".</p>}>
                    {(p) => (
                      <>
                        <div class="pk-pessoa">
                          <label class="pk-avatar-trocar" title="Trocar foto">
                            <Avatar src={fotoParaMostrar(r(), p().personId)} nome={p().nome} class="pk-avatar--grande">
                              <span class="pk-avatar__camera">
                                <Icone nome="camera" tamanho={16} />
                              </span>
                            </Avatar>
                            <input
                              type="file"
                              accept="image/*"
                              class="pk-oculto"
                              onChange={(e) => {
                                const f = e.currentTarget.files?.[0];
                                e.currentTarget.value = "";
                                void escolherFoto(p().personId, f);
                              }}
                            />
                          </label>
                          <div>
                            <h2 class="pk-pessoa__nome">
                              {p().nome}
                              <button type="button" class="pk-icone-btn" aria-label="Renomear pessoa" onClick={() => abrirNome("pessoa")}>
                                <Icone nome="lapis" tamanho={16} />
                              </button>
                            </h2>
                            <p class="pk-pessoa__info">
                              {p().cartas.length === 1 ? "1 carta" : `${p().cartas.length} cartas`} · a foto vale para todas
                              <Show when={fotoParaMostrar(r(), p().personId)}>
                                {" · "}
                                <button type="button" class="pk-link" onClick={() => aplicar((x) => removerFoto(x, p().personId))}>
                                  Remover foto
                                </button>
                              </Show>
                            </p>
                            <Show when={erroDaFoto()}>{(msg) => <p class="pk-erro-curto" role="alert">{msg()}</p>}</Show>
                          </div>
                        </div>
                        <div class="pk-abas" role="tablist">
                          <For each={p().cartas}>
                            {(c) => (
                              <button
                                type="button"
                                role="tab"
                                aria-selected={carta()?.id === c.id}
                                class="pk-aba"
                                classList={{ "pk-aba--on": carta()?.id === c.id, "pk-aba--erro": erros().has(c.id) }}
                                onClick={() => setCartaAberta(c.id)}
                              >
                                <IconeDeRota rota={c.primaryRole} tamanho={16} />
                                {c.year ?? NOME_DA_ROTA[c.primaryRole]}
                                <b class="pk-aba__nota">{notaGeral(c)}</b>
                              </button>
                            )}
                          </For>
                          <button type="button" class="pk-aba pk-aba--nova" onClick={() => novaCarta(p().personId)}>
                            <Icone nome="mais" tamanho={16} />
                            Nova carta
                          </button>
                        </div>
                        <Show when={carta()}>
                          {(c) => (
                            <FormularioDaCarta
                              carta={c()}
                              erros={erros().get(c().id) ?? []}
                              campeoes={props.campeoes}
                              aplicar={aplicar}
                              onRemover={() => removerCartaAberta(c().id)}
                            />
                          )}
                        </Show>
                      </>
                    )}
                  </Show>
                </section>
                <aside class="pk-previa">
                  <Show when={carta()}>{(c) => <PreviaDaCarta carta={{ ...c(), photo: urlDaFoto(fotoParaMostrar(r(), c().personId)) }} />}</Show>
                </aside>
              </div>
            </>
          )}
        </Show>
      </div>

      <Switch>
        <Match when={dialogoDe("sair")}>
          <Modal
            titulo="Sair sem salvar?"
            acoes={[
              { rotulo: "Continuar editando", tipo: "neutra", onClick: () => setDialogo(null) },
              { rotulo: "Sair sem salvar", tipo: "perigo", onClick: () => { setDialogo(null); void descartarESair(); } },
            ]}
          >
            <p>As alterações deste pacote ainda não foram para o arquivo.</p>
          </Modal>
        </Match>
        <Match when={dialogoDe("conflito")}>
          <Modal
            titulo="Este pacote mudou fora do editor"
            acoes={[
              { rotulo: "Recarregar", tipo: "neutra", onClick: () => { setDialogo(null); void descartar(); } },
              { rotulo: "Salvar por cima", tipo: "perigo", onClick: () => { setDialogo(null); void salvar(true); } },
            ]}
          >
            <p>
              Alguém mudou o arquivo (git pull ou edição à mão) desde que você abriu. Recarregar descarta as suas alterações.
              Salvar por cima descarta a versão de fora.
            </p>
          </Modal>
        </Match>
        <Match when={dialogoDe("nome")}>
          {(d) => (
            <Modal
              titulo={TITULO_DO_NOME[d().alvo]}
              acoes={[
                { rotulo: "Cancelar", tipo: "neutra", onClick: () => setDialogo(null) },
                { rotulo: d().alvo === "nova-pessoa" ? "Criar" : "Salvar nome", tipo: "primaria", onClick: () => confirmarNome(d().alvo) },
              ]}
            >
              <input
                type="text"
                maxLength={60}
                value={textoDoNome()}
                onInput={(e) => setTextoDoNome(e.currentTarget.value)}
                onKeyDown={(e) => {
                  // Enter confirma, igual ao botao (revisao final, item 2a).
                  if (e.key === "Enter") confirmarNome(d().alvo);
                }}
                aria-label={TITULO_DO_NOME[d().alvo]}
              />
            </Modal>
          )}
        </Match>
        <Match when={dialogoDe("foto")}>
          {(d) => (
            <Modal
              titulo="Usar esta foto?"
              acoes={[
                { rotulo: "Cancelar", tipo: "neutra", onClick: () => { soltarPrevia(d().previa); setDialogo(null); } },
                {
                  rotulo: "Usar esta foto",
                  tipo: "primaria",
                  onClick: () => {
                    const { personId, dados, previa } = d();
                    setDialogo(null);
                    // Trocou uma foto nova ainda nao salva: solta a previa anterior.
                    const antiga = rascunho()?.fotos[personId];
                    if (antiga?.tipo === "nova" && antiga.previa !== previa) soltarPrevia(antiga.previa);
                    aplicar((r) => marcarFoto(r, personId, dados, previa));
                  },
                },
              ]}
            >
              <img src={d().previa} alt="Prévia da foto recortada" />
              <p>O recorte é o quadrado do meio da foto. Ela só vai para o arquivo quando você salvar.</p>
            </Modal>
          )}
        </Match>
      </Switch>
    </div>
  );
}
