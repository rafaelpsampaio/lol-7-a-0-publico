/**
 * src/room/contract.test.tsx
 *
 * Este teste nao testa uma tela; ele prende as dependencias que a Tarefa 12
 * tirou da quarentena (D-30). O cliente da sala tem uma excecao conhecida:
 * importa PlaybackScreen do jogo direto, mais alguns tipos. O outro builder
 * mexe nesse arquivo em outra maquina e nao sabe que a sala depende dele --
 * se ele mudar a assinatura, o jogo dele continua de pe e a sala quebra
 * silenciosamente, so descoberta na noite de jogo. Este arquivo e a rede que
 * evita isso: quebra no `npm test` DELE, antes do commit sair.
 *
 * O ultimo teste ("a sala nao importa nada alem do combinado") e o que
 * realmente vale: varre src/room/ inteiro (nao uma lista escrita a mao) e
 * recusa qualquer literal de string fora da lista combinada.
 */

import { readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PlaybackScreen } from "../playback/PlaybackScreen";
import { ChampionSelect } from "../playback/ChampionSelect";
import { SeriesResultScreen } from "../tournament/SeriesResultScreen";
import { MatchResultSchema } from "../sim/types";
import { StoredGameSchema } from "../../server/protocol";
import { tagFromName } from "../tournament/teamNames";

// A LISTA COMBINADA (D-30). Nao e uma lista de conveniencia: e a excecao de
// quarentena inteira do cliente da sala, escrita por extenso. Cada entrada aqui
// e um arquivo do outro builder que a sala passa a depender -- e uma
// dependencia que ele nao sabe que tem, porque quem mexe nesses arquivos e ele,
// noutra maquina. Ampliar a lista NAO e decisao de quem implementa uma tela:
// e decisao de quem coordena o plano, porque cada linha nova aumenta a
// superficie que quebra em silencio na noite de jogo. Precisou de um import
// novo? Peca antes; nao acrescente aqui e siga.
//
// Arqueologia de quem entrou depois do combinado original:
// - "../../server/protocol": o brief da Tarefa 12 nao listava, mas
//   BracketScreen.tsx (Tarefa 11) ja importava TournamentSeriesWire/
//   TournamentTeamWire dali, e SeriesWatch.tsx precisa do mesmo tipo para achar
//   o seatIndex do roster. E o contrato de rede, nao o jogo -- ausente do brief
//   por descuido, e nao por decisao.
// - "../sim/types" e "../data/schema": entraram caladas com o SeriesWatch (m-2
//   da revisao final apontou a ausencia da nota). As duas sao `import type`,
//   apagadas no build, e sao o que a reconstrucao do MatchResult e do roster
//   exige. Ficam -- mas registradas, para a proxima leitura desta lista saber
//   por que cada linha esta aqui.
// - "../playback/ChampionSelect" (Fase 3, docs/PLANO-EXPERIENCIA-SALA.md):
//   ampliacao explicita e combinada, nao um import a mais colado sem nota --
//   a introducao de campeoes da sala reusa o componente do solo, com os
//   mesmos dados que dadosPlayback() ja calcula pro PlaybackScreen.
// - "../tournament/SeriesResultScreen" (Fase 4, docs/PLANO-EXPERIENCIA-SALA.md):
//   mesmo espirito da entrada acima -- a tela de fim de serie reusa o
//   componente do solo, com `isUser` recalculado por time via
//   perspectivaDoEspectador() (SeriesWatch.tsx) em vez de vir fixo do lado
//   do jogador humano, que e como o solo sempre calculou.
// - "../components/ChaosSlider" (Fase 6 baixa prioridade,
//   docs/PLANO-EXPERIENCIA-SALA.md): substitui o input numerico cru de
//   "Nível de caos" no draft da sala pelo slider que o solo ja usava.
//   ChaosSlider ganhou um modo controlado (props value/onChange) so pra isso
//   -- a sala mantem o caos em estado local proprio, nunca no
//   chaosLevelSignal global persistido do solo.
// - "../draft/deckSafety" (pack dos amigos, A-02 de
//   docs/superpowers/specs/2026-10-02-pack-amigos-design.md, 2026-10-02):
//   ampliacao combinada com o dono do produto. A cobertura das bases do lobby
//   (src/room/bases.ts) usa a mesma conta de pior caso do servidor e do solo.
//   Arquivo novo, puro, deste pack; nao e do motor nem do outro builder.
// Revisão de cards: apresentação, atributos e opções são compartilhados com o solo.
const permitido =
  /^\.\.\/(playback\/PlaybackScreen|playback\/ChampionSelect|tournament\/SeriesResultScreen|tournament\/schema|tournament\/teamNames|data\/loader|data\/schema|sim\/types|draft\/hints|draft\/deckSafety|net\/store|components\/ChaosSlider|components\/PlayerCard|components\/StatsVisibilityToggle|data\/playerPresentation|data\/statsPolicy|\.\.\/server\/protocol)$/;

/**
 * Acha, em qualquer texto-fonte, todo caminho que aponta para fora de
 * src/room/ (contem "../") ausente da lista permitida.
 *
 * Achado da revisao: a versao anterior so reconhecia `from "..."` -- um
 * import com aspas simples, um `import()` dinamico ou um `import type`
 * atravessavam sem acusar nada, porque nenhum bate com `from "`. A defesa
 * real nao e contra a SINTAXE de import, e contra o CAMINHO em si: qualquer
 * literal de string (aspas simples, duplas ou template) que contenha "../"
 * e candidato, nao importa como o import foi escrito. Por isso a varredura
 * agora procura o literal, nao a palavra "from".
 */
function apontamentosForaDaLista(fonte: string): string[] {
  const fora: string[] = [];
  for (const m of fonte.matchAll(/(['"`])(\.\.\/[^'"`]*)\1/g)) {
    const caminho = m[2]!;
    if (!permitido.test(caminho)) fora.push(caminho);
  }
  return fora;
}

describe("contrato do cliente da sala com o jogo", () => {
  it("PlaybackScreen aceita exatamente as props que a sala passa", () => {
    // Compila-ou-quebra: se o outro builder mudar a assinatura, o tsc acusa aqui.
    const props: Parameters<typeof PlaybackScreen>[0] = {
      result: { winner: "user", events: [], totalPlaybackMs: 0 },
      speedPreset: "fast",
      onPlayAgain: () => {},
      userRoster: [],
      rivalRoster: [],
      userChampions: {},
      rivalChampions: {},
      catalogue: [],
      userTeamName: "A",
      rivalTeamName: "B",
      userTeamTag: "AAA",
      rivalTeamTag: "BBB",
      seriesUserWins: 0,
      seriesRivalWins: 0,
      // Rundown da Sala 2: a sala passa a perspectiva de quem assiste, o
      // rotulo do botao e o aviso de fim de partida (revelacao, D1).
      perspectiva: null,
      continueLabel: "Próximo jogo",
      onFimDaPartida: () => {},
      secondaryLabel: "Voltar ao chaveamento",
      onSecondary: () => {},
    };
    expect(typeof PlaybackScreen).toBe("function");
    expect(props.userTeamTag).toBe("AAA");
  });

  it("ChampionSelect aceita exatamente as props que a sala passa (Fase 3)", () => {
    // Compila-ou-quebra, mesmo espirito do teste de PlaybackScreen acima.
    const props: Parameters<typeof ChampionSelect>[0] = {
      userRoster: [],
      rivalRoster: [],
      userChampions: {},
      rivalChampions: {},
      catalogue: [],
      userTeamName: "A",
      rivalTeamName: "B",
      userTeamTag: "AAA",
      rivalTeamTag: "BBB",
      canSkip: false,
      onComplete: () => {},
    };
    expect(typeof ChampionSelect).toBe("function");
    expect(props.canSkip).toBe(false);
  });

  it("SeriesResultScreen aceita exatamente as props que a sala passa (Fase 4)", () => {
    // Compila-ou-quebra, mesmo espirito dos testes de PlaybackScreen/ChampionSelect acima.
    const props: Parameters<typeof SeriesResultScreen>[0] = {
      slotId: "UB_QF_1",
      series: {
        status: "complete",
        teamAId: "assento-0",
        teamBId: "assento-1",
        wins: { "assento-0": 3, "assento-1": 1 },
        games: [],
        winnerId: "assento-0",
        fearlessUsed: {},
      },
      teams: {
        "assento-0": { id: "assento-0", isUser: true, displayName: "A", roster: [] },
        "assento-1": { id: "assento-1", isUser: false, displayName: "B", roster: [] },
      },
      catalogue: [],
      onContinue: () => {},
      onReplay: () => {},
      continueLabel: "Voltar ao chaveamento",
    };
    expect(typeof SeriesResultScreen).toBe("function");
    expect(props.continueLabel).toBe("Voltar ao chaveamento");
  });

  it("MatchResult tem os tres campos que a sala reconstroi", () => {
    const r = MatchResultSchema.safeParse({ winner: "user", events: [], totalPlaybackMs: 0 });
    expect(r.success).toBe(true);
  });

  it("StoredGame carrega o enquadramento que a sala usa para achar o lado azul", () => {
    const campos = Object.keys(StoredGameSchema.shape);
    expect(campos).toContain("userFrameTeamId");
    expect(campos).toContain("champions");
    expect(campos).toContain("events");
  });

  it("tagFromName devolve sigla curta", () => {
    expect(tagFromName("Dragoes de Cristal").length).toBeGreaterThan(0);
    expect(tagFromName("Dragoes de Cristal").length).toBeLessThanOrEqual(4);
  });

  it("a sala nao importa nada alem do combinado (D-30)", async () => {
    // Varre src/room/ inteiro, nao uma lista escrita a mao: a lista envelhece
    // no dia em que alguem cria uma tela nova, e e justamente essa tela nova
    // que este teste precisa pegar. VotePanel e PodiumScreen so nascem na
    // Tarefa 13 -- a varredura funciona antes e depois deles existirem.
    const dir = new URL("./", import.meta.url);
    const arquivos = (await readdir(dir)).filter(
      (f) => (f.endsWith(".tsx") || f.endsWith(".ts")) && !f.includes(".test.")
    );
    expect(arquivos.length).toBeGreaterThan(0);
    for (const nome of arquivos) {
      const fonte = readFileSync(new URL(nome, dir), "utf8");
      const fora = apontamentosForaDaLista(fonte);
      expect(fora, `${nome} aponta para ${fora.join(", ")}`).toEqual([]);
    }
  });
});

describe("robustez da varredura -- pega o caminho, nao a sintaxe do import (achado da revisao)", () => {
  // As tres formas que escapavam da versao anterior (regex `from "..."`
  // sozinha): aspas simples, import() dinamico e import type. As tres
  // apontam para o mesmo "../proibido", fora da lista combinada -- se
  // qualquer uma escapar, a varredura real do teste acima tambem deixaria
  // passar essa forma escrita num arquivo de verdade.
  it("pega import estatico com aspas simples", () => {
    const fonte = `import { X } from '../proibido';`;
    expect(apontamentosForaDaLista(fonte)).toContain("../proibido");
  });

  it("pega import() dinamico", () => {
    const fonte = `async function f() { const x = await import("../proibido"); }`;
    expect(apontamentosForaDaLista(fonte)).toContain("../proibido");
  });

  it("pega import type no formato inline (import(\"...\").Tipo, sem 'from')", () => {
    // Import de tipo em posicao inline (comum em TS: `type X = import("...").Y`)
    // nao tem a palavra "from" antes da string nenhuma -- textualmente e a
    // mesma forma de import() dinamico, so que so o compilador de tipos usa.
    // Regex velha (`from "..."`) nao bate aqui por definicao.
    const fonte = `type Foo = import("../proibido").Bar;`;
    expect(apontamentosForaDaLista(fonte)).toContain("../proibido");
  });

  it("nao acusa um caminho permitido, com aspas simples ou template", () => {
    const fonte = `import { x } from '../net/store';\nconst y = \`../data/loader\`;`;
    expect(apontamentosForaDaLista(fonte)).toEqual([]);
  });
});
