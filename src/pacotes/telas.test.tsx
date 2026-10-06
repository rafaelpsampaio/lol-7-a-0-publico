import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import type { PlayerVersion, Role } from "../data/schema";
import { MenuDoDono } from "./MenuDoDono";
import { CartaoDoPacote, CartaoInvalido } from "./ListaDePacotes";
import { CabecalhoDoEditor } from "./CabecalhoDoEditor";
import { ListaDePessoas, filtrarPessoas } from "./ListaDePessoas";
import { FormularioDaCarta } from "./FormularioDaCarta";
import { PreviaDaCarta } from "./PreviaDaCarta";
import { criarRascunho, pessoasDoRascunho } from "./rascunho";

const POOL = ["aatrox", "camille", "garen", "darius", "fiora", "jax", "malphite", "riven"].map((championId) => ({
  championId,
  mastery: 3 as const,
}));

function cartaDeTeste(id: string, personId: string, nome: string, rota: Role, fases: [number, number, number] = [70, 70, 70], foto?: string): PlayerVersion {
  const [lanePhase, midGame, lateGame] = fases;
  const nota = Math.round((lanePhase + midGame + lateGame) / 3);
  return {
    id,
    personId,
    displayName: nome,
    roles: [rota],
    primaryRole: rota,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [rota]: nota },
    lanePhase,
    midGame,
    lateGame,
    traits: [],
    championPool: POOL,
    ...(foto === undefined ? {} : { photo: foto }),
  };
}

const nada = () => undefined;

describe("MenuDoDono (secao 3.2)", () => {
  it("tres opcoes com sala, e o numero de quem esta nela", () => {
    const html = renderToString(() => (
      <MenuDoDono pacoteAtivo="Amigos" temSala conectados={2} fotos={["/players/rafa.jpg"]} onSolo={nada} onEditar={nada} onMultiplayer={nada} />
    ));
    expect(html).toContain("Jogo solo");
    expect(html).toContain("Pacote: <!--$-->Amigos");
    expect(html).toContain("Editar pacotes");
    expect(html).toContain("Multiplayer");
    expect(html).toContain("2 na sala");
    expect(html).toContain('src="/players/rafa.jpg"');
  });

  it("sem sala (npm run dev), sem a opcao Multiplayer", () => {
    const html = renderToString(() => (
      <MenuDoDono pacoteAtivo="Pros / Mundial" temSala={false} conectados={0} fotos={[]} onSolo={nada} onEditar={nada} onMultiplayer={nada} />
    ));
    expect(html).not.toContain("Multiplayer");
  });
});

describe("CartaoDoPacote (secao 3.3)", () => {
  const cartas = [cartaDeTeste("rafa-top", "rafa", "Rafa Top", "top", [70, 70, 70], "/players/rafa.jpg"), cartaDeTeste("ber-jungle", "ber", "Ber Jungle", "jungle")];

  it("nome, contagem, selo e capa, sem o caminho do arquivo", () => {
    const html = renderToString(() => (
      <CartaoDoPacote
        resumo={{ id: "amigos", nome: "Amigos", cartas: 2, pessoas: 2, versao: "v" }}
        cartas={cartas}
        menuAberto={false}
        onMenu={nada}
        onEditar={nada}
        onExportar={nada}
        onExcluir={nada}
      />
    ));
    expect(html).toContain("Amigos");
    expect(html).toContain("2 cartas · 2 pessoas");
    expect(html).toContain("Faltam cartas em");
    expect(html).toContain('src="/players/rafa.jpg"');
    expect(html).not.toContain("public/packs");
  });

  it("os Pros nao tem Excluir no menu", () => {
    const html = renderToString(() => (
      <CartaoDoPacote
        resumo={{ id: "pros", nome: "Pros / Mundial", cartas: 2, pessoas: 2, versao: "v" }}
        cartas={cartas}
        menuAberto
        onMenu={nada}
        onEditar={nada}
        onExportar={nada}
        onExcluir={nada}
      />
    ));
    expect(html).toContain("base padrão do jogo");
    expect(html).toContain("Exportar planilha");
    expect(html).not.toContain("Excluir pacote");
  });
});

describe("editor do pacote (secao 3.4)", () => {
  const rafa18 = { ...cartaDeTeste("rafa-top-2018", "rafa", "Rafa Top 2018", "top", [75, 85, 85], "/players/rafa.jpg"), year: 2018, traits: ["mental_fort", "teamfights"] as PlayerVersion["traits"] };
  const rafaSup = cartaDeTeste("rafa-support", "rafa", "Rafa Sup", "support", [75, 75, 75], "/players/rafa.jpg");
  const igao = cartaDeTeste("igao-adc", "raidenchups", "Igão Adc", "adc", [80, 80, 80]);
  const pessoas = () => pessoasDoRascunho(criarRascunho({ id: "amigos", nome: "Amigos", versao: "v", players: [rafa18, rafaSup, igao] }));

  it("cabecalho: alteracoes, erros e Salvar bloqueado com carta errada", () => {
    const comErro = renderToString(() => (
      <CabecalhoDoEditor nome="Amigos" cartas={[rafa18]} alteracoes={3} cartasComErro={2} salvando={false} onVoltar={nada} onRenomear={nada} onDescartar={nada} onSalvar={nada} />
    ));
    expect(comErro).toContain("3 alterações");
    expect(comErro).toContain("2 cartas com erro");
    expect(comErro).toMatch(/<button[^>]*disabled[^>]*>Salvar/);

    const limpo = renderToString(() => (
      <CabecalhoDoEditor nome="Amigos" cartas={[rafa18]} alteracoes={1} cartasComErro={0} salvando={false} onVoltar={nada} onRenomear={nada} onDescartar={nada} onSalvar={nada} />
    ));
    expect(limpo).toContain("1 alteração");
    expect(limpo).not.toMatch(/<button[^>]*disabled[^>]*>Salvar/);
  });

  it("lista de pessoas: nome, maior nota e alerta de erro", () => {
    const html = renderToString(() => (
      <ListaDePessoas pessoas={pessoas()} selecionada="rafa" comErro={new Set(["raidenchups"])} fotoDe={(id) => (id === "rafa" ? "/players/rafa.jpg" : undefined)} onEscolher={nada} onNovaPessoa={nada} />
    ));
    expect(html).toContain("Rafa");
    expect(html).toContain(">82<");
    expect(html).toContain("Tem carta com erro");
    expect(html).toContain("Nova pessoa");
  });

  it("filtro por busca (sem acento) e por rota", () => {
    expect(filtrarPessoas(pessoas(), "igao", null).map((p) => p.personId)).toEqual(["raidenchups"]);
    expect(filtrarPessoas(pessoas(), "", "support").map((p) => p.personId)).toEqual(["rafa"]);
  });

  it("formulario: nota geral, traits e erros da carta", () => {
    const html = renderToString(() => (
      <FormularioDaCarta carta={rafa18} erros={["Escolha pelo menos 8 campeões (faltam 1)."]} campeoes={[]} aplicar={nada} onRemover={nada} />
    ));
    expect(html).toContain("Nota geral");
    expect(html).toContain(">82<");
    expect(html).toContain("Traits · 2 de 4");
    expect(html).toContain("Escolha pelo menos 8 campeões (faltam 1).");
    expect(html).toContain("Campeões · 8 no pool, mínimo 8");
    expect(html).toContain("Remover esta carta");
    expect(html).not.toContain("Persona");
  });

  it("previa: o PlayerCard do draft com o selo da nota", () => {
    const html = renderToString(() => <PreviaDaCarta carta={rafa18} />);
    expect(html).toContain("No draft");
    expect(html).toContain("player-card__ovr");
  });
});

describe("CartaoInvalido (revisao final M2)", () => {
  it("mostra o erro em pt-BR e nao oferece Editar", () => {
    const html = renderToString(() => (
      <CartaoInvalido resumo={{ id: "amigos", nome: "amigos", invalido: true, erro: "JSON quebrado", cartas: 0, pessoas: 0, versao: "" }} onExcluir={() => undefined} />
    ));
    expect(html).toContain("Arquivo com problema: ");
    expect(html).toContain("JSON quebrado");
    expect(html).toContain("desfaça a última mudança no git");
    expect(html).not.toContain("Editar");
  });
});
