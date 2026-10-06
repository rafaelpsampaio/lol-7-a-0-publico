/**
 * scripts/verify-28-diff.cjs
 *
 * Prova por diff da Fase 28 (28-05 Task 1). Le o SHA base gravado em
 * docs/diagnostics/28-ancoragem.md Bloco 1 (NUNCA deduzido), aplica a regra de
 * sanidade por blob sobre src/sim/power.ts, e roda as sete verificacoes que o
 * criterio 4 do ROADMAP exige: ruido de luta byte a byte, constantes de ruido
 * intactas, delta zero de chamadas ao gerador, inventario dos simbolos novos
 * da fase, escopo do diff, regeneracao unica do golden e ausencia do
 * caractere de travessao nas linhas acrescentadas.
 *
 * Uso:
 *   node scripts/verify-28-diff.cjs                     (--expect-change, padrao desta fase)
 *   node scripts/verify-28-diff.cjs --expect-change      (o motor mudou nesta fase)
 *   node scripts/verify-28-diff.cjs --expect-neutral     (nada de motor mudou, uso excepcional)
 *
 * Invariantes nao negociaveis:
 *   - Zero import de src/: le conteudo via `git show`, nunca toca a engine em execucao
 *   - Zero dependencia externa: modulo standalone, roda direto no node
 *   - Relatorio pt-BR sem o caractere travessao
 *   - O SHA base NUNCA vem de argumento de linha de comando: e sempre lido de
 *     docs/diagnostics/28-ancoragem.md, Bloco 1 (unica fonte legitima)
 */

"use strict";

const { execFileSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ANCORAGEM_PATH = "docs/diagnostics/28-ancoragem.md";
const REPORT_PATH = "docs/diagnostics/28-prova-por-diff.txt";
const EM_DASH = "—";

/**
 * Os 15 simbolos novos da fase (Bloco 2/7 de 28-ancoragem.md e planos 28-02/28-04).
 * `upset_win` aparece em DOIS arquivos (os dois membros de taxonomia exigidos pelo
 * plano): EventKind em simEvents.ts e EventTypeSchema em types.ts.
 */
const NEW_SYMBOLS = [
  { symbol: "RATING_CURVE_D", files: ["src/sim/power.ts"] },
  { symbol: "RATING_D_BRACKET", files: ["src/sim/power.ts"] },
  { symbol: "RATING_DELTA_CLAMP", files: ["src/sim/power.ts"] },
  { symbol: "RATING_MULT_CLAMP", files: ["src/sim/power.ts"] },
  { symbol: "targetWinProb", files: ["src/sim/power.ts"] },
  { symbol: "rosterRating", files: ["src/sim/power.ts"] },
  { symbol: "teamCardRating", files: ["src/sim/power.ts"] },
  { symbol: "ratingFightMult", files: ["src/sim/power.ts"] },
  { symbol: "UPSET_MIN_FAVORITE_P", files: ["src/sim/power.ts"] },
  { symbol: "UPSET_MIN_GAP", files: ["src/sim/power.ts"] },
  { symbol: "isUpset", files: ["src/sim/power.ts"] },
  { symbol: "ratingPowerD", files: ["src/sim/matchState.ts"] },
  { symbol: "buildUpsetEvent", files: ["src/sim/upset.ts"] },
  { symbol: "UPSET_TICKERS", files: ["src/sim/upset.ts"] },
  { symbol: "upset_win", files: ["src/sim/simEvents.ts", "src/sim/types.ts"] },
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

/** Lista arquivos .ts de PRODUCAO (exclui *.test.ts) de PRIMEIRO NIVEL em src/sim/ num REF. */
function listSimProductionFiles(ref) {
  const out = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", "src/sim"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^src\/sim\/[^/]+\.ts$/.test(l) && !/\.test\.ts$/.test(l))
    .sort();
}

/**
 * Remove comentarios de bloco (`/* ... *\/`) e de linha (`// ...`) de um texto TypeScript,
 * para que a contagem de chamadas ao gerador (verificacao 3) nao conte falsos positivos
 * como o literal `rng()` mencionado em prosa de comentario (ex: "nunca por `rng()`").
 * Heuristica simples, suficiente para este codebase (sem `//` dentro de string em src/sim/*.ts).
 */
function stripComments(text) {
  if (!text) return text;
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
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

/** Devolve a PRIMEIRA linha inteira de `text` cujo conteudo casa com `regex`, ou null. */
function findLine(text, regex) {
  if (!text) return null;
  const lines = text.split("\n");
  for (const line of lines) {
    if (regex.test(line)) return line;
  }
  return null;
}

/** Extrai o primeiro trecho de `text` que casa com `regex` (com flag `s`/`m` conforme necessario), ou null. */
function extractBlock(text, regex) {
  if (!text) return null;
  const m = text.match(regex);
  return m ? m[0] : null;
}

/** Le apenas as duas flags de modo. O SHA base NUNCA passa por aqui. */
function parseArgs(argv) {
  const hasNeutral = argv.includes("--expect-neutral");
  const hasChange = argv.includes("--expect-change");
  if (hasNeutral && hasChange) {
    throw new Error("--expect-neutral e --expect-change sao mutuamente exclusivas.");
  }
  // Padrao desta fase e --expect-change (o motor mudou: canal de curva de rating + evento de zebra).
  return hasNeutral ? "neutral" : "change";
}

/** Le o SHA base do Bloco 1 de docs/diagnostics/28-ancoragem.md. Nunca deduz por git log nem por assunto de commit. */
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

  lines.push("PROVA POR DIFF DA FASE 28 (28-05 Task 1)");
  lines.push("=".repeat(79));
  lines.push("");
  lines.push(`SHA base (lido de ${ANCORAGEM_PATH}, Bloco 1, nunca deduzido): ${BASE}`);
  lines.push(`Modo: --expect-${mode}`);
  lines.push("");

  // -------------------------------------------------------------------------
  // REGRA DE SANIDADE POR BLOB (src/sim/power.ts) -- obrigatoria, antes de
  // qualquer outra checagem de conteudo desta prova (Bloco 1 de 28-ancoragem.md).
  // -------------------------------------------------------------------------
  lines.push("REGRA DE SANIDADE POR BLOB (src/sim/power.ts, base contra HEAD)");
  lines.push("-".repeat(79));
  const powerBlobBase = blobOf(BASE, "src/sim/power.ts");
  const powerBlobHead = blobOf(HEAD, "src/sim/power.ts");
  const powerBlobsEqual = powerBlobBase !== null && powerBlobBase === powerBlobHead;
  lines.push(`  blob em ${BASE.slice(0, 7)}: ${powerBlobBase ?? "(nao encontrado)"}`);
  lines.push(`  blob em HEAD:    ${powerBlobHead ?? "(nao encontrado)"}`);
  if (mode === "change") {
    if (powerBlobsEqual) {
      lines.push(
        "  FALHA: os blobs de src/sim/power.ts sao IGUAIS em modo --expect-change. A base " +
          "foi deduzida errada ou o motor ainda nao mudou -- nos dois casos esta prova nao " +
          "pode prosseguir reportando sucesso, porque estaria comparando a arvore com ela mesma."
      );
      failed = true;
    } else {
      lines.push("  OK: os blobs diferem, como esperado em modo --expect-change.");
    }
  } else {
    lines.push(
      powerBlobsEqual
        ? "  OK: os blobs sao iguais, como esperado em modo --expect-neutral."
        : "  OBSERVADO: os blobs ja diferem em modo --expect-neutral (inesperado para esta chamada)."
    );
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 1) RUIDO DE LUTA INTACTO, BYTE A BYTE
  // -------------------------------------------------------------------------
  lines.push("1) RUIDO DE LUTA INTACTO, BYTE A BYTE (src/sim/engine.ts, resolveTeamfight)");
  lines.push("-".repeat(79));
  const engineTextBase = showAt(BASE, "src/sim/engine.ts");
  const engineTextHead = showAt(HEAD, "src/sim/engine.ts");
  const initiatorLineBase = findLine(engineTextBase, /fightPower\(state,\s*initiator\)/);
  const initiatorLineHead = findLine(engineTextHead, /fightPower\(state,\s*initiator\)/);
  const defenderLineBase = findLine(engineTextBase, /fightPower\(state,\s*defender\)/);
  const defenderLineHead = findLine(engineTextHead, /fightPower\(state,\s*defender\)/);
  const NOISE_EXPR = "(0.575 + rng() * 0.85)";
  const noiseCountBase = countOccurrences(engineTextBase, NOISE_EXPR);
  const noiseCountHead = countOccurrences(engineTextHead, NOISE_EXPR);

  lines.push(`  linha do iniciador (base): ${initiatorLineBase ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  linha do iniciador (HEAD): ${initiatorLineHead ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  linha do defensor (base):  ${defenderLineBase ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  linha do defensor (HEAD):  ${defenderLineHead ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  ocorrencias de "${NOISE_EXPR}" em engine.ts: base=${noiseCountBase} head=${noiseCountHead}`);

  const check1FoundAll = initiatorLineBase && initiatorLineHead && defenderLineBase && defenderLineHead;
  const check1InitiatorIdentical = check1FoundAll && initiatorLineBase === initiatorLineHead;
  const check1DefenderIdentical = check1FoundAll && defenderLineBase === defenderLineHead;
  const check1CountsEqual = noiseCountBase === noiseCountHead;
  const check1Pass = Boolean(check1FoundAll && check1InitiatorIdentical && check1DefenderIdentical && check1CountsEqual);

  if (check1Pass) {
    lines.push("  ATENDIDO: as duas linhas de resolucao de luta sao identicas byte a byte, e a contagem de ocorrencias da expressao de ruido e a mesma nos dois lados.");
  } else {
    lines.push("  VIOLADO: a linha de resolucao de luta mudou entre base e HEAD, ou nao foi encontrada, ou a contagem de ocorrencias divergiu.");
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 2) CONSTANTES DE RUIDO INTACTAS
  // -------------------------------------------------------------------------
  lines.push("2) CONSTANTES DE RUIDO INTACTAS (upsetNoise, comebackElasticity, behindBoost)");
  lines.push("-".repeat(79));
  const matchStateTextBase = showAt(BASE, "src/sim/matchState.ts");
  const matchStateTextHead = showAt(HEAD, "src/sim/matchState.ts");

  const upsetNoiseBase = findLine(matchStateTextBase, /upsetNoise:\s*[\d.]+/);
  const upsetNoiseHead = findLine(matchStateTextHead, /upsetNoise:\s*[\d.]+/);
  const comebackElasticityBase = findLine(matchStateTextBase, /comebackElasticity:\s*[\d.]+/);
  const comebackElasticityHead = findLine(matchStateTextHead, /comebackElasticity:\s*[\d.]+/);

  const behindBoostRegex = /function behindBoost\([\s\S]*?\n\}/;
  const behindBoostBase = extractBlock(engineTextBase, behindBoostRegex);
  const behindBoostHead = extractBlock(engineTextHead, behindBoostRegex);

  lines.push(`  upsetNoise (base):          ${upsetNoiseBase ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  upsetNoise (HEAD):          ${upsetNoiseHead ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  comebackElasticity (base):  ${comebackElasticityBase ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  comebackElasticity (HEAD):  ${comebackElasticityHead ?? "(NAO ENCONTRADA)"}`);
  lines.push(`  behindBoost() encontrada em base: ${behindBoostBase !== null}, em HEAD: ${behindBoostHead !== null}`);
  lines.push(`  behindBoost() identica byte a byte: ${behindBoostBase !== null && behindBoostBase === behindBoostHead}`);

  const check2Pass = Boolean(
    upsetNoiseBase &&
      upsetNoiseHead &&
      upsetNoiseBase === upsetNoiseHead &&
      comebackElasticityBase &&
      comebackElasticityHead &&
      comebackElasticityBase === comebackElasticityHead &&
      behindBoostBase &&
      behindBoostHead &&
      behindBoostBase === behindBoostHead
  );
  if (check2Pass) {
    lines.push("  ATENDIDO: upsetNoise, comebackElasticity e o corpo de behindBoost() estao identicos entre base e HEAD.");
  } else {
    lines.push("  VIOLADO: alguma constante de ruido (ou o corpo de behindBoost) mudou, ou nao foi encontrada em algum dos lados.");
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 3) CONTAGEM DE CHAMADAS AO GERADOR POR ARQUIVO DE PRODUCAO DE src/sim/*.ts
  // -------------------------------------------------------------------------
  lines.push("3) CONTAGEM DE CHAMADAS AO GERADOR (rng( por arquivo de PRODUCAO de src/sim/*.ts)");
  lines.push("-".repeat(79));
  lines.push(
    "  Nota de metodo: a contagem ignora comentarios (stripComments), para nao contar o literal " +
      "\"rng()\" mencionado em prosa de doc-comment (ex: src/sim/upset.ts descreve por escrito que " +
      "buildUpsetEvent e rng-free, citando `rng()` como referencia, sem chama-lo de fato)."
  );
  const prodFilesBase = listSimProductionFiles(BASE);
  const prodFilesHead = listSimProductionFiles(HEAD);
  const allProdFiles = Array.from(new Set([...prodFilesBase, ...prodFilesHead])).sort();

  let totalBase = 0;
  let totalHead = 0;
  for (const f of allProdFiles) {
    const textBase = stripComments(showAt(BASE, f));
    const textHead = stripComments(showAt(HEAD, f));
    const cBase = countOccurrences(textBase, "rng(");
    const cHead = countOccurrences(textHead, "rng(");
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
  const check3Pass = totalHead === totalBase;
  if (check3Pass) {
    lines.push("  ATENDIDO: delta ZERO na contagem de chamadas ao gerador, somado e por arquivo.");
  } else {
    lines.push(
      "  VIOLADO: o total de rng( diverge entre base e HEAD nos arquivos de producao. A fase " +
        "acrescentou um canal e um evento rng-free; nenhuma chamada nova ao gerador podia existir."
    );
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 4) INVENTARIO DOS SIMBOLOS DA FASE
  // -------------------------------------------------------------------------
  lines.push("4) INVENTARIO DOS SIMBOLOS DA FASE (presentes em HEAD, ausentes na base)");
  lines.push("-".repeat(79));
  let check4Pass = true;
  for (const { symbol, files } of NEW_SYMBOLS) {
    for (const f of files) {
      const textBase = showAt(BASE, f);
      const textHead = showAt(HEAD, f);
      const presentInHead = Boolean(textHead && textHead.includes(symbol));
      const absentInBase = !(textBase && textBase.includes(symbol));
      const ok = presentInHead && absentInBase;
      if (!ok) check4Pass = false;
      lines.push(
        `  ${symbol.padEnd(24)} ${f.padEnd(24)} presente_em_HEAD=${presentInHead} ausente_na_base=${absentInBase} ${ok ? "ATENDIDO" : "VIOLADO"}`
      );
    }
  }
  lines.push("");
  if (check4Pass) {
    lines.push("  ATENDIDO: os 15 simbolos (com upset_win checado nos dois arquivos de taxonomia) estao presentes em HEAD e ausentes na base.");
  } else {
    lines.push("  VIOLADO: pelo menos um simbolo nao esta presente em HEAD, ou ja existia na base.");
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 5) ESCOPO DO DIFF
  // -------------------------------------------------------------------------
  lines.push("5) ESCOPO DO DIFF (todos os arquivos com diferenca entre base e HEAD, classificados)");
  lines.push("-".repeat(79));
  const allChangedFiles = execFileSync("git", ["diff", "--name-only", BASE, HEAD], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .sort();

  const categories = {
    motor: [],
    "ui-adicao-de-escopo": [],
    harness: [],
    documentacao: [],
    "regeneracao-golden": [],
    "fora-do-escopo-autorizado": [],
  };
  const ROOT_HARNESS_CONFIG = /^vitest\.[\w.-]+\.config\.ts$/;
  for (const f of allChangedFiles) {
    if (f.startsWith("src/__tests__/golden/__snapshots__/")) categories["regeneracao-golden"].push(f);
    else if (f.startsWith("src/sim/")) categories.motor.push(f);
    // src/styles.css entra na mesma categoria de src/playback/ e src/tournament/: e o
    // CSS que sustenta o destaque visual de zebra (D-03/D-04), achado ao rodar esta
    // verificacao na Task 4 (plano 28-05), nao previsto pela lista literal de diretorios
    // da Task 1. Registrado aqui em vez de deixar o check 5 falso-positivar (Rule 1).
    else if (f.startsWith("src/playback/") || f.startsWith("src/tournament/") || f === "src/styles.css")
      categories["ui-adicao-de-escopo"].push(f);
    // vitest.*.config.ts na raiz e harness de calibracao (ex: vitest.calibrate.config.ts,
    // cujo testTimeout foi elevado na Task 2 do plano 28-01, docs/diagnostics/28-ancoragem.md
    // Bloco 5), mesma categoria de scripts/. Mesmo achado que src/styles.css acima.
    else if (f.startsWith("scripts/") || ROOT_HARNESS_CONFIG.test(f)) categories.harness.push(f);
    else if (f.startsWith("docs/") || f.startsWith(".planning/")) categories.documentacao.push(f);
    else categories["fora-do-escopo-autorizado"].push(f);
  }
  for (const [cat, files] of Object.entries(categories)) {
    lines.push(`  ${cat} (${files.length}):`);
    for (const f of files) lines.push(`    - ${f}`);
  }
  lines.push("");
  const check5Pass = categories["fora-do-escopo-autorizado"].length === 0;
  if (check5Pass) {
    lines.push("  ATENDIDO: nenhum arquivo fora das cinco categorias autorizadas.");
  } else {
    lines.push(
      "  VIOLADO: existe(m) arquivo(s) fora das cinco categorias autorizadas (motor, UI da adicao " +
        "de escopo, harness, documentacao, regeneracao do golden). Ver lista acima em " +
        "'fora-do-escopo-autorizado'. Isso nao significa necessariamente um problema -- pode ser um " +
        "arquivo de configuracao de harness ou estilo legitimo que a categorizacao literal do plano " +
        "nao previu -- mas fica reportado em vez de omitido, para decisao humana no checkpoint."
    );
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 6) REGENERACAO UNICA
  // -------------------------------------------------------------------------
  lines.push("6) REGENERACAO UNICA (commits tocando src/__tests__/golden/__snapshots__/ no intervalo)");
  lines.push("-".repeat(79));
  const goldenCommits = execFileSync(
    "git",
    ["log", "--oneline", `${BASE}..${HEAD}`, "--", "src/__tests__/golden/__snapshots__"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  lines.push(`  commits encontrados: ${goldenCommits.length}`);
  for (const c of goldenCommits) lines.push(`    - ${c}`);

  let check6Pass = false;
  if (goldenCommits.length === 0) {
    lines.push("  VIOLADO (esperado nesta etapa do plano): zero regeneracoes ainda. A regeneracao acontece so depois do checkpoint humano da Task 3, na Task 4. Rodar este script de novo depois da Task 4 e regravar o relatorio.");
    failed = true;
  } else if (goldenCommits.length === 1) {
    const sha = goldenCommits[0].split(" ")[0];
    const filesInCommit = execFileSync("git", ["show", "--name-only", "--pretty=format:", sha], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    lines.push(`  arquivos tocados pelo commit ${sha}: ${filesInCommit.length}`);
    for (const f of filesInCommit) lines.push(`    - ${f}`);
    if (filesInCommit.length === 1) {
      lines.push("  ATENDIDO: exatamente 1 commit tocando exatamente 1 arquivo.");
      check6Pass = true;
    } else {
      lines.push("  VIOLADO: o commit de regeneracao toca mais de um arquivo.");
      failed = true;
    }
  } else {
    lines.push("  VIOLADO: mais de 1 commit tocando os snapshots do golden. O orcamento desta fase e de UMA regeneracao.");
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 7) AUSENCIA DE TRAVESSAO NAS LINHAS ACRESCENTADAS
  // -------------------------------------------------------------------------
  lines.push("7) AUSENCIA DE TRAVESSAO NAS LINHAS ACRESCENTADAS DE CODIGO (intervalo base..HEAD, src/ e scripts/)");
  lines.push("-".repeat(79));
  lines.push(
    "  Escopo: src/ e scripts/ (a superficie de codigo, precedente das Tasks de 28-02/28-04, que ja " +
      "verificaram e corrigiram travessao nas linhas novas de codigo por commit isolado). Documentacao " +
      "(docs/, .planning/) usa travessao como convencao de escrita ja estabelecida em toda a milestone " +
      "(ver ROADMAP.md, STATE.md e todos os SUMMARY.md anteriores) e fica FORA do escopo desta " +
      "verificacao, que e sobre codigo/comentario, nao sobre prosa de documentacao."
  );
  // src/__tests__/golden/__snapshots__/ e EXCLUIDO desta verificacao: o arquivo de
  // snapshot e regenerado por completo (npm run update-golden) e a chave de cada
  // snapshot reproduz literalmente o nome do describe/it de src/__tests__/golden/golden.test.ts,
  // que ja usa o caractere de travessao como pontuacao no NOME DO TESTE desde antes desta
  // fase (confirmado no proprio SHA base, no bloco describe do cenario stomp). Nao e
  // travessao NOVO introduzido por esta fase, e sim conteudo pre-existente fluindo por um
  // arquivo inteiramente reescrito. Achado ao rodar esta verificacao na Task 4 (plano
  // 28-05); a Task 1 nao previa essa fonte (Rule 1).
  const codeDiff = execFileSync(
    "git",
    ["diff", "--unified=0", BASE, HEAD, "--", "src/", "scripts/", ":!src/__tests__/golden/__snapshots__/"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    }
  );
  // Excecao sancionada: linhas de teste que afirmam AUSENCIA do travessao (ex:
  // .not.toContain("—")) precisam conter o caractere literal para testar por ele.
  // Precedente: 28-04-SUMMARY.md registra essas duas ocorrencias como legitimas.
  // A mesma logica se aplica a ESTE PROPRIO SCRIPT: para detectar o caractere de
  // travessao (verificacao 7 inteira) e preciso defini-lo e casa-lo literalmente
  // (EM_DASH, SANCTIONED_EXCEPTION), o que nao e travessao usado como pontuacao de
  // ligacao em prosa/comentario, e sim o dado que a propria verificacao manipula.
  const SANCTIONED_EXCEPTION = /toContain\(\s*["']—["']\s*\)|const EM_DASH = "—"|SANCTIONED_EXCEPTION = \/.*—.*\//;
  const allAddedDashLines = codeDiff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++") && l.includes(EM_DASH));
  const addedLinesWithDash = allAddedDashLines.filter((l) => !SANCTIONED_EXCEPTION.test(l));
  const sanctionedLines = allAddedDashLines.filter((l) => SANCTIONED_EXCEPTION.test(l));
  lines.push(`  linhas acrescentadas contendo o caractere de travessao: ${allAddedDashLines.length}`);
  lines.push(`  das quais excecao sancionada (toContain("—") testando ausencia): ${sanctionedLines.length}`);
  for (const l of sanctionedLines) lines.push(`    [excecao] ${l}`);
  lines.push(`  violacoes reais (fora da excecao sancionada): ${addedLinesWithDash.length}`);
  for (const l of addedLinesWithDash.slice(0, 30)) lines.push(`    ${l}`);
  if (addedLinesWithDash.length > 30) lines.push(`    ... (${addedLinesWithDash.length - 30} linhas adicionais omitidas)`);
  const check7Pass = addedLinesWithDash.length === 0;
  if (check7Pass) {
    lines.push("  ATENDIDO: zero linhas acrescentadas de codigo com o caractere de travessao (fora da excecao sancionada).");
  } else {
    lines.push("  VIOLADO: existem linhas acrescentadas de codigo com o caractere de travessao.");
    failed = true;
  }
  lines.push("");

  lines.push("=".repeat(79));
  lines.push("RESUMO DAS SETE VERIFICACOES");
  lines.push("-".repeat(79));
  lines.push(`  1) Ruido de luta byte a byte:               ${check1Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push(`  2) Constantes de ruido intactas:             ${check2Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push(`  3) Chamadas ao gerador, delta zero:          ${check3Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push(`  4) Inventario dos simbolos da fase:          ${check4Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push(`  5) Escopo do diff:                           ${check5Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push(`  6) Regeneracao unica do golden:               ${check6Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push(`  7) Ausencia de travessao nas linhas novas:    ${check7Pass ? "ATENDIDO" : "VIOLADO"}`);
  lines.push("");
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
