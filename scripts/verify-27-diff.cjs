/**
 * scripts/verify-27-diff.cjs
 *
 * Prova por diff da Fase 27 (27-01 Task 2). Le o SHA base gravado em
 * docs/diagnostics/27-ancoragem.md Bloco 1 (NUNCA deduzido), aplica a regra de
 * sanidade por blob, conta ocorrencias de rng( por arquivo de src/sim/*.ts nos
 * dois lados, inventaria os 13 simbolos de ouro do Bloco 2 da ancoragem, lista
 * arquivos com diferenca restrita a src/sim e scripts, e guarda o escopo
 * diferido de src/sim/winprob.ts (peso de ouro na win prob, escopo da Fase 29).
 *
 * Uso:
 *   node scripts/verify-27-diff.cjs                     (modo --expect-neutral, default)
 *   node scripts/verify-27-diff.cjs --expect-neutral     (nada de motor mudou -- modo desta onda 1)
 *   node scripts/verify-27-diff.cjs --expect-change      (motor mudou -- ondas 27-02 em diante)
 *
 * Invariantes nao negociaveis:
 *   - Zero import de src/: le conteudo via `git show`, nunca toca a engine em execucao
 *   - Zero dependencia externa: modulo standalone, roda direto no node
 *   - Relatorio pt-BR sem o caractere travessao
 *   - O SHA base NUNCA vem de argumento de linha de comando: e sempre lido de
 *     docs/diagnostics/27-ancoragem.md, Bloco 1 (unica fonte legitima)
 */

"use strict";

const { execFileSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ANCORAGEM_PATH = "docs/diagnostics/27-ancoragem.md";
const REPORT_PATH = "docs/diagnostics/27-prova-por-diff.txt";

/** Os 13 simbolos de ouro do Bloco 2 de docs/diagnostics/27-ancoragem.md. */
const GOLD_SYMBOLS = [
  "BASE_KILL_GOLD",
  "ASSIST_GOLD",
  "FIRST_BLOOD_BONUS",
  "FIRST_TURRET_BONUS",
  "PLATE_GOLD_EST",
  "K_GOLD",
  "GOLD_DELTA_SCALE",
  "expectedGoldForRoleAtMinute",
  "bountyGreed",
  "isStomping",
  "recomputeBounty",
  "scaleGold",
  "unscaleGold",
];

/** Le um arquivo em um REF via `git show`, sem shell. Devolve null se o arquivo nao existir naquele REF. */
function showAt(ref, relPath) {
  try {
    return execFileSync("git", ["show", `${ref}:${relPath}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
  } catch {
    return null;
  }
}

/** Hash de blob de um arquivo num REF, via `git rev-parse`. Devolve null se nao existir naquele REF. */
function blobOf(ref, relPath) {
  try {
    return execFileSync("git", ["rev-parse", `${ref}:${relPath}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

/** Lista arquivos .ts de PRIMEIRO NIVEL em src/sim/ num REF (equivalente ao glob src/sim/*.ts). */
function listSimFiles(ref) {
  const out = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", "src/sim"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^src\/sim\/[^/]+\.ts$/.test(l))
    .sort();
}

/** Conta ocorrencias literais de `needle` em `text`. Nunca lanca: texto null devolve 0. */
function countOccurrences(text, needle) {
  if (!text) return 0;
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = text.indexOf(needle, idx);
    if (idx === -1) break;
    count++;
    idx += needle.length;
  }
  return count;
}

/** Le apenas as duas flags de modo. O SHA base NUNCA passa por aqui. */
function parseArgs(argv) {
  const hasNeutral = argv.includes("--expect-neutral");
  const hasChange = argv.includes("--expect-change");
  if (hasNeutral && hasChange) {
    throw new Error("--expect-neutral e --expect-change sao mutuamente exclusivas.");
  }
  return hasChange ? "change" : "neutral";
}

/** Le o SHA base do Bloco 1 de docs/diagnostics/27-ancoragem.md. Nunca deduz por git log nem por assunto de commit. */
function readBaseSha() {
  const text = readFileSync(path.join(REPO_ROOT, ANCORAGEM_PATH), "utf8");
  const m = text.match(/\b[0-9a-f]{40}\b/);
  if (!m) {
    throw new Error(
      `Nao foi possivel encontrar um SHA de 40 caracteres hexadecimais em ${ANCORAGEM_PATH}. ` +
        "O SHA base precisa estar gravado la (Bloco 1); este script nunca o deduz."
    );
  }
  return m[0];
}

function run(mode) {
  const lines = [];
  let failed = false;

  const BASE = readBaseSha();
  const HEAD = "HEAD";

  lines.push("PROVA POR DIFF DA FASE 27 (27-01 Task 2)");
  lines.push("=".repeat(79));
  lines.push("");
  lines.push(`SHA base (lido de ${ANCORAGEM_PATH}, Bloco 1, nunca deduzido): ${BASE}`);
  lines.push(`Modo: --expect-${mode}`);
  lines.push("");

  // -------------------------------------------------------------------------
  // 1) REGRA DE SANIDADE POR BLOB -- obrigatoria e verificada antes de
  //    qualquer outra checagem de conteudo desta prova.
  // -------------------------------------------------------------------------
  lines.push("1) REGRA DE SANIDADE POR BLOB (src/sim/engine.ts, base contra HEAD)");
  lines.push("-".repeat(79));
  const engineBlobBase = blobOf(BASE, "src/sim/engine.ts");
  const engineBlobHead = blobOf(HEAD, "src/sim/engine.ts");
  const blobsEqual = engineBlobBase !== null && engineBlobBase === engineBlobHead;
  lines.push(`  blob em ${BASE.slice(0, 7)}: ${engineBlobBase ?? "(nao encontrado)"}`);
  lines.push(`  blob em HEAD:    ${engineBlobHead ?? "(nao encontrado)"}`);
  if (mode === "change") {
    if (blobsEqual) {
      lines.push(
        "  FALHA: os blobs sao IGUAIS em modo --expect-change. A base foi deduzida " +
          "errada ou o motor ainda nao mudou -- nos dois casos esta prova nao pode " +
          "prosseguir reportando sucesso, porque estaria comparando a arvore com ela mesma."
      );
      failed = true;
    } else {
      lines.push("  OK: os blobs diferem, como esperado em modo --expect-change.");
    }
  } else {
    lines.push(
      blobsEqual
        ? "  OK: os blobs sao iguais, como esperado em modo --expect-neutral (nada de motor mudou ainda nesta onda)."
        : "  OBSERVADO: os blobs ja diferem em modo --expect-neutral (o motor mudou antes do esperado para esta onda)."
    );
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 2) CONTAGEM DE rng( POR ARQUIVO DE src/sim/*.ts, nos dois lados
  // -------------------------------------------------------------------------
  lines.push("2) CONTAGEM DE CHAMADAS AO GERADOR (rng( por arquivo de src/sim/*.ts)");
  lines.push("-".repeat(79));
  const filesBase = listSimFiles(BASE);
  const filesHead = listSimFiles(HEAD);
  const allFiles = Array.from(new Set([...filesBase, ...filesHead])).sort();

  const textsBase = new Map(allFiles.map((f) => [f, showAt(BASE, f)]));
  const textsHead = new Map(allFiles.map((f) => [f, showAt(HEAD, f)]));

  let totalBase = 0;
  let totalHead = 0;
  for (const f of allFiles) {
    const cBase = countOccurrences(textsBase.get(f), "rng(");
    const cHead = countOccurrences(textsHead.get(f), "rng(");
    totalBase += cBase;
    totalHead += cHead;
    const delta = cHead - cBase;
    const marker = delta !== 0 ? "  <-- DELTA" : "";
    lines.push(
      `  ${f.padEnd(42)} base=${String(cBase).padStart(3)} head=${String(cHead).padStart(3)} ` +
        `delta=${delta >= 0 ? "+" : ""}${delta}${marker}`
    );
  }
  lines.push("");
  lines.push(`  TOTAL base: ${totalBase}`);
  lines.push(`  TOTAL head: ${totalHead}`);
  if (totalHead !== totalBase) {
    lines.push(
      "  FALHA: o total de rng( no lado HEAD diverge do lado base. A aridade do gerador " +
        "precisa ser identica nos dois lados para preservar determinismo por seed (INV-1)."
    );
    failed = true;
  } else {
    lines.push("  OK: total identico nos dois lados.");
  }
  lines.push(
    `  OBSERVADO: o valor de referencia da milestone e 72 (ultima leitura confirmada na Fase 25C); ` +
      `medido aqui: base=${totalBase} head=${totalHead}.`
  );
  lines.push("");

  // -------------------------------------------------------------------------
  // 3) CONTAGEM POR SIMBOLO DE OURO -- informativo, NUNCA faz o script falhar
  // -------------------------------------------------------------------------
  lines.push("3) CONTAGEM POR SIMBOLO DE OURO (informativo -- Bloco 2 da ancoragem, 13 simbolos)");
  lines.push("-".repeat(79));
  for (const symbol of GOLD_SYMBOLS) {
    let cBase = 0;
    let cHead = 0;
    for (const f of allFiles) {
      cBase += countOccurrences(textsBase.get(f), symbol);
      cHead += countOccurrences(textsHead.get(f), symbol);
    }
    lines.push(`  ${symbol.padEnd(30)} base=${String(cBase).padStart(3)} head=${String(cHead).padStart(3)}`);
  }
  lines.push("");
  lines.push(
    "  Este bloco nunca faz o script falhar: ele existe para a onda seguinte provar " +
      "que nenhum ponto de acoplamento de ouro ficou de fora da varredura."
  );
  lines.push("");

  // -------------------------------------------------------------------------
  // 4) ARQUIVOS COM DIFERENCA, restrito a src/sim e scripts
  // -------------------------------------------------------------------------
  lines.push("4) ARQUIVOS COM DIFERENCA ENTRE BASE E HEAD (restrito a src/sim e scripts)");
  lines.push("-".repeat(79));
  const diffFiles = execFileSync("git", ["diff", "--name-only", BASE, HEAD, "--", "src/sim", "scripts"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (diffFiles.length === 0) {
    lines.push("  nenhum arquivo com diferenca");
  } else {
    for (const f of diffFiles) lines.push(`  - ${f}`);
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 5) GUARDA DE ESCOPO DIFERIDO: src/sim/winprob.ts (peso de ouro, Fase 29)
  // -------------------------------------------------------------------------
  lines.push("5) GUARDA DE ESCOPO DIFERIDO (src/sim/winprob.ts -- escopo da Fase 29, WPB)");
  lines.push("-".repeat(79));
  const winprobBlobBase = blobOf(BASE, "src/sim/winprob.ts");
  const winprobBlobHead = blobOf(HEAD, "src/sim/winprob.ts");
  const winprobChanged = winprobBlobBase !== winprobBlobHead;
  lines.push(`  blob em ${BASE.slice(0, 7)}: ${winprobBlobBase ?? "(nao encontrado)"}`);
  lines.push(`  blob em HEAD:    ${winprobBlobHead ?? "(nao encontrado)"}`);
  if (winprobChanged) {
    lines.push(
      "  FALHA: src/sim/winprob.ts mudou entre a base e HEAD. Qualquer diferenca ali e " +
        "VIOLACAO de escopo -- o peso de ouro da win prob e escopo da Fase 29 e deve " +
        "permanecer em 0 nesta fase."
    );
    failed = true;
  } else {
    lines.push("  OK: src/sim/winprob.ts inalterado. Escopo diferido preservado.");
  }
  lines.push("");

  lines.push("=".repeat(79));
  lines.push(failed ? "VEREDITO: FALHA (ver secoes acima)" : "VEREDITO: OK");
  lines.push("");

  const report = lines.join("\n");
  writeFileSync(path.join(REPO_ROOT, REPORT_PATH), report, "utf8");
  console.log(report);

  return failed ? 1 : 0;
}

function main() {
  let mode;
  try {
    mode = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err && err.message ? err.message : err));
    process.exitCode = 1;
    return;
  }
  process.exitCode = run(mode);
}

main();
