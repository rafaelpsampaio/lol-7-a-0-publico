/**
 * src/pacotes/ListaDePacotes.tsx
 *
 * Lista de pacotes (secao 3.3): capa com as fotos, contagem por rota, selo do
 * baralho, Editar e o menu "..." com Exportar e Excluir. Importar planilha e
 * Novo pacote criam arquivos novos pela API. A planilha (exceljs) so carrega
 * por import() dinamico, fora do bundle principal.
 */

import { createResource, createSignal, For, Show } from "solid-js";
import type { ChampionEntry, PlayerVersion } from "../data/schema";
import type { ApiDePacotes, ResumoDoPacote } from "./api";
import { FalhaDaApi } from "./api";
import { normalizarCarta } from "./regrasDaCarta";
import { capaDoPacote } from "./resumo";
import { resumoDaImportacao, textoDoErro422 } from "./resumoDaImportacao";
import { ContagemPorRota, Selo } from "./Selos";
import { Icone } from "./Icones";
import { urlDaFoto } from "./fotoCache";
import { Modal } from "./Modal";
import "./pacotes.css";

interface PacoteNaLista {
  resumo: ResumoDoPacote;
  cartas: PlayerVersion[];
}

/** Pacote cujo arquivo nao abre (revisao final M2): mostra o erro, sem Editar. */
export function CartaoInvalido(props: { resumo: ResumoDoPacote; onExcluir: () => void }) {
  return (
    <article class="pk-pacote pk-pacote--invalido">
      <div class="pk-pacote__corpo">
        <h3 class="pk-pacote__nome">{props.resumo.nome}</h3>
        <p class="pk-aviso pk-aviso--erro" role="alert">
          Arquivo com problema: {props.resumo.erro ?? "não consegui ler"}. Corrija o arquivo ou desfaça a última mudança no git.
        </p>
        <div class="pk-pacote__rodape">
          <span class="pk-espaco" />
          <button type="button" class="pk-btn pk-btn--perigo" onClick={() => props.onExcluir()}>
            <Icone nome="lixeira" tamanho={16} />
            Excluir pacote
          </button>
        </div>
      </div>
    </article>
  );
}

export function CartaoDoPacote(props: {
  resumo: ResumoDoPacote;
  cartas: PlayerVersion[];
  menuAberto: boolean;
  onMenu: () => void;
  onEditar: () => void;
  onExportar: () => void;
  onExcluir: () => void;
}) {
  const ehPros = () => props.resumo.id === "pros";
  return (
    <article class="pk-pacote">
      <div class="pk-pacote__capa">
        <For each={capaDoPacote(props.cartas)}>
          {(item) => (item.tipo === "foto" ? <img src={urlDaFoto(item.src)} alt="" /> : <span>{item.texto}</span>)}
        </For>
      </div>
      <div class="pk-pacote__corpo">
        <h3 class="pk-pacote__nome">{props.resumo.nome}</h3>
        <p class="pk-pacote__sub">
          {ehPros()
            ? `${props.resumo.cartas} cartas · base padrão do jogo`
            : `${props.resumo.cartas} cartas · ${props.resumo.pessoas} pessoas`}
        </p>
        <ContagemPorRota cartas={props.cartas} />
        <div class="pk-pacote__rodape">
          <Selo cartas={props.cartas} />
          <span class="pk-espaco" />
          <span class="pk-mais">
            <button type="button" class="pk-mais__botao" aria-label="Mais opções" aria-expanded={props.menuAberto} onClick={() => props.onMenu()}>
              <Icone nome="mais-opcoes" tamanho={18} />
            </button>
            <Show when={props.menuAberto}>
              <div class="pk-pop" role="menu">
                <button type="button" role="menuitem" onClick={() => props.onExportar()}>
                  <Icone nome="planilha" tamanho={16} />
                  Exportar planilha
                </button>
                <Show when={!ehPros()}>
                  <button type="button" role="menuitem" class="pk-pop__perigo" onClick={() => props.onExcluir()}>
                    <Icone nome="lixeira" tamanho={16} />
                    Excluir pacote
                  </button>
                </Show>
              </div>
            </Show>
          </span>
          <button type="button" class="pk-btn pk-btn--primaria" onClick={() => props.onEditar()}>
            Editar
          </button>
        </div>
      </div>
    </article>
  );
}

export function ListaDePacotes(props: {
  api: ApiDePacotes;
  campeoes: ChampionEntry[];
  onVoltar: () => void;
  onEditar: (id: string) => void;
  onMudou: () => void;
}) {
  const [pacotes, { refetch }] = createResource(async (): Promise<PacoteNaLista[]> => {
    const lista = await props.api.listar();
    return Promise.all(
      lista.map(async (resumo) => ({
        resumo,
        // Pacote com arquivo quebrado nao tem cartas para carregar (revisao final M2).
        cartas: resumo.invalido === true ? [] : (await props.api.carregar(resumo.id)).players,
      }))
    );
  });
  const [aviso, setAviso] = createSignal<string | null>(null);
  const [menuAberto, setMenuAberto] = createSignal<string | null>(null);
  const [criando, setCriando] = createSignal(false);
  const [nomeNovo, setNomeNovo] = createSignal("");
  const [excluindo, setExcluindo] = createSignal<ResumoDoPacote | null>(null);
  const [ocupado, setOcupado] = createSignal(false);

  function mensagem(e: unknown): string {
    if (e instanceof FalhaDaApi) {
      const d = e.detalhe;
      if (d.tipo === "rede") return "Sem conexão com o servidor.";
      if (d.status === 403) return "Só o dono pode mudar os pacotes. Abra pelo link de host que o servidor mostra ao subir.";
      if (d.status === 422) return textoDoErro422(d.erro, d.cartas);
      return d.erro;
    }
    return e instanceof Error ? e.message : String(e);
  }

  /** Novo pacote vazio abre o editor; importacao fica na lista para mostrar o resumo (revisao final M1). */
  async function criar(nome: string, players: PlayerVersion[], resumo?: string): Promise<void> {
    setOcupado(true);
    setAviso(null);
    try {
      const { id } = await props.api.criar({ nome, players });
      props.onMudou();
      if (resumo === undefined) {
        props.onEditar(id);
      } else {
        void refetch();
        setAviso(`Pacote "${nome}" criado: ${resumo}`);
      }
    } catch (e) {
      setAviso(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  async function importar(arquivo: File | undefined): Promise<void> {
    if (arquivo === undefined) return;
    setOcupado(true);
    setAviso(null);
    try {
      const { parseWorkbook } = await import("../data/packImport");
      const resultado = await parseWorkbook(await arquivo.arrayBuffer(), props.campeoes);
      if (resultado.players.length === 0) {
        setAviso("Nenhuma carta válida na planilha. Exporte um pacote para ver o formato esperado.");
        return;
      }
      await criar(
        arquivo.name.replace(/\.(xlsx|xls)$/i, "").slice(0, 60) || "Pacote",
        resultado.players.map(normalizarCarta),
        resumoDaImportacao(resultado)
      );
    } catch (e) {
      setAviso(e instanceof FalhaDaApi ? mensagem(e) : "Não consegui ler a planilha. Salve como .xlsx e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  async function exportar(p: PacoteNaLista): Promise<void> {
    setMenuAberto(null);
    setAviso(null);
    try {
      const { buildPackWorkbook, downloadWorkbook } = await import("../data/packSheet");
      await downloadWorkbook(buildPackWorkbook(props.campeoes, { name: p.resumo.nome, players: p.cartas }), `pacote-${p.resumo.id}.xlsx`);
    } catch {
      setAviso("Não consegui gerar a planilha.");
    }
  }

  function confirmarNovo(): void {
    const nome = nomeNovo().trim();
    if (nome === "") return;
    setCriando(false);
    void criar(nome, []);
  }

  async function confirmarExclusao(): Promise<void> {
    const alvo = excluindo();
    setExcluindo(null);
    if (alvo === null) return;
    try {
      await props.api.excluir(alvo.id);
      props.onMudou();
      void refetch();
    } catch (e) {
      setAviso(mensagem(e));
    }
  }

  return (
    <div class="pk-tela">
      <div class="pk-conteudo">
        <div class="pk-topo">
          <button type="button" class="pk-voltar" onClick={() => props.onVoltar()}>
            <Icone nome="voltar" tamanho={18} />
            Início
          </button>
          <h1 class="pk-topo__titulo">Pacotes</h1>
          <label class="pk-btn">
            <Icone nome="planilha" tamanho={16} />
            {ocupado() ? "Lendo..." : "Importar planilha"}
            <input
              type="file"
              accept=".xlsx,.xls"
              class="pk-oculto"
              disabled={ocupado()}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                void importar(f);
              }}
            />
          </label>
          <button type="button" class="pk-btn pk-btn--primaria" disabled={ocupado()} onClick={() => { setNomeNovo(""); setCriando(true); }}>
            <Icone nome="mais" tamanho={16} />
            Novo pacote
          </button>
        </div>

        <Show when={aviso()}>{(msg) => <p class="pk-aviso" role="status">{msg()}</p>}</Show>
        <Show when={pacotes.error}>
          <p class="pk-aviso pk-aviso--erro" role="alert">
            Não consegui carregar os pacotes. <button type="button" class="pk-btn" onClick={() => void refetch()}>Tentar de novo</button>
          </p>
        </Show>
        <Show when={pacotes.loading && pacotes.state !== "refreshing"}>
          <p class="pk-vazio" role="status">Carregando pacotes...</p>
        </Show>

        <div class="pk-pacotes">
          <For each={pacotes.state === "errored" ? [] : pacotes.latest ?? []}>
            {(p) => (
              <Show
                when={p.resumo.invalido !== true}
                fallback={<CartaoInvalido resumo={p.resumo} onExcluir={() => setExcluindo(p.resumo)} />}
              >
                <CartaoDoPacote
                  resumo={p.resumo}
                  cartas={p.cartas}
                  menuAberto={menuAberto() === p.resumo.id}
                  onMenu={() => setMenuAberto((atual) => (atual === p.resumo.id ? null : p.resumo.id))}
                  onEditar={() => props.onEditar(p.resumo.id)}
                  onExportar={() => void exportar(p)}
                  onExcluir={() => {
                    setMenuAberto(null);
                    setExcluindo(p.resumo);
                  }}
                />
              </Show>
            )}
          </For>
        </div>
      </div>

      <Show when={criando()}>
        <Modal
          titulo="Novo pacote"
          acoes={[
            { rotulo: "Cancelar", tipo: "neutra", onClick: () => setCriando(false) },
            { rotulo: "Criar", tipo: "primaria", onClick: confirmarNovo },
          ]}
        >
          <input
            type="text"
            maxLength={60}
            placeholder="Ex: Amigos da firma"
            value={nomeNovo()}
            onInput={(e) => setNomeNovo(e.currentTarget.value)}
            onKeyDown={(e) => {
              // Enter confirma, igual ao botao (revisao final, item 2a).
              if (e.key === "Enter") confirmarNovo();
            }}
            aria-label="Nome do pacote"
          />
        </Modal>
      </Show>

      <Show when={excluindo()}>
        {(alvo) => (
          <Modal
            titulo={`Excluir "${alvo().nome}"?`}
            acoes={[
              { rotulo: "Cancelar", tipo: "neutra", onClick: () => setExcluindo(null) },
              { rotulo: "Excluir pacote", tipo: "perigo", onClick: () => void confirmarExclusao() },
            ]}
          >
            <p>O arquivo do pacote sai do projeto. Dá para recuperar pelo git enquanto não houver commit da exclusão.</p>
          </Modal>
        )}
      </Show>
    </div>
  );
}
