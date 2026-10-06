/**
 * scripts/diff-golden.test.ts
 *
 * Testes de scripts/diff-golden.ts (Fase 23 / INST-07).
 * Cobre o parser do .snap, o detector de violacoes de ordem, o diff de quatro
 * dimensoes e (Task 2) o CLI de comparacao de dois arquivos.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseSnapFile,
  detectOrderViolations,
  diffDigests,
  formatDiffReport,
  diffFiles,
  type GoldenDigest,
} from "./diff-golden";

// ---------------------------------------------------------------------------
// Fixtures sinteticas no formato EXATO de um bloco de snapshot vitest:
//   exports[`nome`] = `
//   "<JSON.stringify(digest, null, 2)>"
//   `;
// Mesma forma produzida por digestTimeline() em src/__tests__/golden/fixtures.ts
// e confirmada por leitura direta de
// src/__tests__/golden/__snapshots__/golden.test.ts.snap nesta sessao.
// ---------------------------------------------------------------------------

function makeSnapBlock(name: string, digest: unknown): string {
  return `exports[\`${name}\`] = \`\n"${JSON.stringify(digest, null, 2)}"\n\`;\n`;
}

const DIGEST_A: GoldenDigest = {
  winner: "user",
  finalScore: { userKills: 10, rivalKills: 5 },
  events: [
    { kind: "first_blood", timeSec: 100, side: "user", actors: ["a"], victims: ["b"] },
    { kind: "dragon_taken", timeSec: 300, side: "user", actors: ["a"], victims: [] },
  ],
};

const DIGEST_B: GoldenDigest = {
  winner: "rival",
  finalScore: { userKills: 3, rivalKills: 12 },
  events: [
    { kind: "first_blood", timeSec: 90, side: "rival", actors: ["c"], victims: ["d"] },
  ],
};

describe("diff-golden -- diff estruturado de golden em quatro dimensoes (INST-07)", () => {
  // -------------------------------------------------------------------------
  // parseSnapFile
  // -------------------------------------------------------------------------

  describe("parseSnapFile", () => {
    it("sobre o snapshot real do projeto devolve 15 entradas, cada uma com winner/finalScore/events", () => {
      const text = readFileSync(
        join(process.cwd(), "src/__tests__/golden/__snapshots__/golden.test.ts.snap"),
        "utf8"
      );
      const map = parseSnapFile(text);
      expect(map.size).toBe(15);
      for (const [, digest] of map) {
        expect(digest).toHaveProperty("winner");
        expect(digest).toHaveProperty("finalScore");
        expect(digest).toHaveProperty("events");
        expect(Array.isArray(digest.events)).toBe(true);
      }
    });

    it("sobre um texto sintetico de dois blocos devolve duas entradas, na ordem de aparicao", () => {
      const text = makeSnapBlock("bloco-a", DIGEST_A) + "\n" + makeSnapBlock("bloco-b", DIGEST_B);
      const map = parseSnapFile(text);
      expect([...map.keys()]).toEqual(["bloco-a", "bloco-b"]);
      expect(map.get("bloco-a")).toEqual(DIGEST_A);
      expect(map.get("bloco-b")).toEqual(DIGEST_B);
    });

    it("sobre texto sem nenhum bloco devolve mapa vazio, sem lancar", () => {
      expect(() => {
        const map = parseSnapFile("texto qualquer sem formato de snapshot vitest\nnada aqui.");
        expect(map.size).toBe(0);
      }).not.toThrow();
    });

    it("le os mesmos blocos com LF ou CRLF no checkout do Windows", () => {
      const lf = makeSnapBlock("bloco-a", DIGEST_A) + "\n" + makeSnapBlock("bloco-b", DIGEST_B);
      const crlf = lf.replace(/\n/g, "\r\n");
      expect([...parseSnapFile(crlf)]).toEqual([...parseSnapFile(lf)]);
      expect(parseSnapFile(crlf).size).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // detectOrderViolations
  // -------------------------------------------------------------------------

  describe("detectOrderViolations", () => {
    it("acusa evento com tempo menor que o do evento anterior", () => {
      const events: GoldenDigest["events"] = [
        { kind: "first_blood", timeSec: 300, side: "user", actors: [], victims: [] },
        { kind: "gank", timeSec: 250, side: "user", actors: [], victims: [] },
      ];
      const violations = detectOrderViolations(events);
      expect(violations.some((v) => v.includes("fora de ordem cronologica"))).toBe(true);
    });

    it("acusa evento de Baron antes de 1200 segundos", () => {
      const events: GoldenDigest["events"] = [
        { kind: "baron_taken", timeSec: 900, side: "user", actors: [], victims: [] },
      ];
      const violations = detectOrderViolations(events);
      expect(violations.some((v) => v.includes("Baron antes do spawn"))).toBe(true);
    });

    it("acusa evento de Elder de um lado que nao tomou nenhum dragao antes", () => {
      const events: GoldenDigest["events"] = [
        { kind: "elder_taken", timeSec: 1800, side: "user", actors: [], victims: [] },
      ];
      const violations = detectOrderViolations(events);
      expect(violations.some((v) => v.includes("Elder antes de qualquer dragao"))).toBe(true);
    });

    it("devolve lista vazia para uma timeline bem formada", () => {
      const events: GoldenDigest["events"] = [
        { kind: "first_blood", timeSec: 100, side: "user", actors: [], victims: [] },
        { kind: "dragon_taken", timeSec: 300, side: "user", actors: [], victims: [] },
        { kind: "baron_taken", timeSec: 1300, side: "user", actors: [], victims: [] },
        { kind: "elder_taken", timeSec: 1900, side: "user", actors: [], victims: [] },
      ];
      expect(detectOrderViolations(events)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // diffDigests
  // -------------------------------------------------------------------------

  describe("diffDigests", () => {
    it("marca troca de vencedor e reporta o vencedor antigo e o novo", () => {
      const diff = diffDigests(DIGEST_A, DIGEST_B);
      expect(diff.winnerChanged).toBe(true);
      expect(diff.oldWinner).toBe("user");
      expect(diff.newWinner).toBe("rival");
    });

    it("nao marca troca de vencedor quando o vencedor e o mesmo", () => {
      const diff = diffDigests(DIGEST_A, DIGEST_A);
      expect(diff.winnerChanged).toBe(false);
    });

    it("lista tipos de evento acrescentados e removidos, sem repeticao", () => {
      const oldD: GoldenDigest = {
        winner: "user",
        finalScore: {},
        events: [
          { kind: "first_blood", timeSec: 100, side: "user", actors: [], victims: [] },
          { kind: "gank", timeSec: 200, side: "user", actors: [], victims: [] },
          { kind: "gank", timeSec: 250, side: "rival", actors: [], victims: [] },
        ],
      };
      const newD: GoldenDigest = {
        winner: "user",
        finalScore: {},
        events: [
          { kind: "first_blood", timeSec: 100, side: "user", actors: [], victims: [] },
          { kind: "dragon_taken", timeSec: 300, side: "user", actors: [], victims: [] },
        ],
      };
      const diff = diffDigests(oldD, newD);
      expect(diff.kindsAdded).toEqual(["dragon_taken"]);
      expect(diff.kindsRemoved).toEqual(["gank"]);
    });

    it("calcula o delta aproximado de duracao pelo tempo do ultimo evento de cada lado", () => {
      const oldD: GoldenDigest = {
        winner: "user",
        finalScore: {},
        events: [{ kind: "gg", timeSec: 1800, side: null, actors: [], victims: [] }],
      };
      const newD: GoldenDigest = {
        winner: "user",
        finalScore: {},
        events: [{ kind: "gg", timeSec: 1815, side: null, actors: [], victims: [] }],
      };
      const diff = diffDigests(oldD, newD);
      expect(diff.durationDeltaSecApprox).toBe(15);
    });
  });

  // -------------------------------------------------------------------------
  // formatDiffReport
  // -------------------------------------------------------------------------

  describe("formatDiffReport", () => {
    it("nomeia as quatro dimensoes e reporta diff vazio quando os mapas sao identicos", () => {
      const map = new Map([["bloco-a", DIGEST_A]]);
      const report = formatDiffReport(map, map);
      expect(report).toContain("Vencedores mudados");
      expect(report).toContain("Tipos de evento acrescentados ou removidos");
      expect(report).toContain("Delta de duracao aproximado");
      expect(report).toContain("Violacoes de ordem detectadas");
      expect(report).toContain("Nenhuma diferenca encontrada");
    });

    it("imprime a nota de limitacao de lane mesmo sem diferenca", () => {
      const map = new Map([["bloco-a", DIGEST_A]]);
      const report = formatDiffReport(map, map);
      expect(report.toLowerCase()).toContain("lane");
    });

    it("lista blocos presentes so num dos lados como mudanca de estrutura", () => {
      const oldMap = new Map([["bloco-a", DIGEST_A]]);
      const newMap = new Map([
        ["bloco-a", DIGEST_A],
        ["bloco-b", DIGEST_B],
      ]);
      const report = formatDiffReport(oldMap, newMap);
      expect(report).toContain("acrescentado: bloco-b");
    });

    it("nao contem o caractere travessao", () => {
      const oldMap = new Map([["bloco-a", DIGEST_A]]);
      const newMap = new Map([["bloco-a", DIGEST_B]]);
      const report = formatDiffReport(oldMap, newMap);
      expect(report.includes(String.fromCharCode(8212))).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Importar o modulo nao dispara o CLI
  // -------------------------------------------------------------------------

  it("importar o modulo num teste nao executa o CLI (nenhum efeito colateral no import)", () => {
    // Se o import no topo deste arquivo tivesse disparado o CLI, este teste
    // nunca chegaria a rodar sob vitest (o CLI leria process.argv do vitest
    // e tentaria comparar arquivos que nao existem nesse contexto). O fato
    // de a suite inteira rodar normalmente ja prova a ausencia de efeito
    // colateral; o assert abaixo documenta a intencao explicitamente.
    expect(typeof parseSnapFile).toBe("function");
    expect(typeof formatDiffReport).toBe("function");
  });

  // -------------------------------------------------------------------------
  // Task 2 -- CLI: comparacao de dois caminhos de arquivo (via funcao exportada)
  // -------------------------------------------------------------------------

  describe("diffFiles (CLI, comparacao de dois caminhos de arquivo)", () => {
    it("compara dois arquivos de snapshot escritos em tmp/ e nomeia as quatro dimensoes no relatorio", () => {
      mkdirSync("tmp", { recursive: true });
      const oldPath = join("tmp", "diff-golden-test-old.snap");
      const newPath = join("tmp", "diff-golden-test-new.snap");
      writeFileSync(oldPath, makeSnapBlock("bloco-x", DIGEST_A), "utf8");
      writeFileSync(newPath, makeSnapBlock("bloco-x", DIGEST_B), "utf8");

      const report = diffFiles(oldPath, newPath);

      expect(report).toContain("Vencedores mudados");
      expect(report).toContain("Tipos de evento acrescentados ou removidos");
      expect(report).toContain("Delta de duracao aproximado");
      expect(report).toContain("Violacoes de ordem detectadas");
      expect(report).toContain("bloco-x: user -> rival");
      expect(report.includes(String.fromCharCode(8212))).toBe(false);
    });
  });
});
