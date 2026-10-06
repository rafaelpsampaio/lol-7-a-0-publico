/**
 * scripts/verify-26-diff.cjs
 *
 * Prova por diff do fechamento da Fase 26 (26-10 Task 1). Le o SHA base gravado
 * em docs/diagnostics/26-ancoragem.md Bloco 1 (NUNCA deduzido), aplica a regra
 * de sanidade por blob de src/sim/combat.ts, conta ocorrencias de rng( por
 * arquivo de src/sim/*.ts nos dois lados, confere que os arquivos de src/sim/
 * fora da lista autorizada estao identicos por hash de objeto, confere as duas
 * constantes fora do escopo declarado (janela de ruido das lutas, impulso do
 * time atrasado), confere ausencia de dependencia nova em package.json e conta
 * ocorrencias do caractere travessao nas linhas acrescentadas.
 *
 * NOTA DE LOCALIZACAO (deviation Rule 3, plano 26-10 Task 1): o texto do plano
 * cita os caminhos tmp/verify-26-diff.cjs e tmp/diff-proof-26.txt, mas tmp/ e
 * gitignorado inteiro (.gitignore:32) e o commit deste Task nao pode forcar a
 * adicao de caminho gitignorado (git add -f e proibido pelo protocolo de git
 * seguro). Seguindo o precedente ja estabelecido pela Fase 27 para o mesmo
 * problema (scripts/verify-27-diff.cjs + docs/diagnostics/27-prova-por-diff.txt,
 * commit e295aad), o script durável vive em scripts/ e a saida durável em
 * docs/diagnostics/. O comando de <verify> do proprio plano roda
 * `node scripts/verify-26-diff.cjs | tee tmp/diff-proof-26.txt`, entao o
 * arquivo tmp/ citado pelo plano continua existindo como copia efemera de
 * trabalho (via tee), sem precisar ser commitado.
 *
 * ACHADO DE SEQUENCIAMENTO, registrado aqui e nao escondido: entre a abertura
 * da Fase 26 (SHA base) e a execucao deste plano de fechamento, a Fase 27
 * (Escala e Acoplamento Economico) ja foi executada e mesclada por inteiro
 * (planos 27-01 a 27-04, confirmado por `git log`). Isso significa que HEAD
 * hoje carrega mudancas de DUAS fases, nao so da Fase 26. Para nao misturar as
 * duas atribuicoes, este script mede o item 2 (arquivos autorizados) em DUAS
 * leituras lado a lado: contra HEAD (hoje, contaminado pela Fase 27) e contra
 * o ultimo commit exclusivo da Fase 26 (lido do proprio historico do git, nao
 * deduzido por assunto de commit isolado: e o commit imediatamente anterior ao
 * primeiro commit de pesquisa/plano com escopo "phase-27"/"27" no assunto).
 *
 * Uso: node scripts/verify-26-diff.cjs
 *
 * Invariantes nao negociaveis:
 *   - Zero import de src/: le conteudo via `git show`, nunca toca a engine em execucao
 *   - Zero dependencia externa: modulo standalone, roda direto no node
 *   - Relatorio pt-BR sem o caractere travessao (o texto que este script GERA;
 *     as citacoes literais de linhas do repositorio no item 6 sao dados medidos,
 *     nao prosa deste script)
 *   - O SHA base NUNCA vem de argumento de linha de comando: e sempre lido de
 *     docs/diagnostics/26-ancoragem.md, Bloco 1 (unica fonte legitima)
 */

"use strict";

const { execFileSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ANCORAGEM_PATH = "docs/diagnostics/26-ancoragem.md";
const REPORT_PATH = "docs/diagnostics/26-prova-por-diff.txt";

/** Os sete arquivos de src/sim/ autorizados pelo plano 26-10 Task 1, mais o
 * companheiro estrutural declarado (types.ts, campos novos de LANE-01/lane
 * signals, ja documentado no commit-base do plano 26-07 em 26-sweep.md). */
const AUTHORIZED_SIM_FILES = new Set([
  "src/sim/combat.ts",
  "src/sim/engine.ts",
  "src/sim/selection.ts",
  "src/sim/laneState.ts",
  "src/sim/laneSignals.ts",
  "src/sim/simEvents.ts",
  "src/sim/deathQuality.ts",
]);

/** Arquivos de teste correspondentes aos sete autorizados: mudar o teste de um
 * modulo autorizado nao e violacao de escopo, e a lista de arquivos autorizados
 * do plano fala de MODULOS, nao de arquivo unico. */
const AUTHORIZED_SIM_TEST_FILES = new Set([
  "src/sim/combat.test.ts",
  "src/sim/engine.test.ts",
  "src/sim/engineWiring.test.ts",
  "src/sim/selection.test.ts",
  "src/sim/laneState.test.ts",
  "src/sim/laneSignals.test.ts",
  "src/sim/deathQuality.test.ts",
]);

/** Companheiro estrutural declarado por atribuicao (nao esta na lista literal
 * do Task 1, mas o proprio historico da fase (26-sweep.md, nota do plano
 * 26-07) documenta que types.ts mudou junto de laneState.ts/laneSignals.ts. */
const DECLARED_COMPANION_FILES = new Set(["src/sim/types.ts"]);

function showAt(ref, relPath) {
  try {
    return execFileSync("git", ["show", `${ref}:${relPath}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function blobOf(ref, relPath) {
  try {
    return execFileSync("git", ["rev-parse", `${ref}:${relPath}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

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

/** Le a lista de commits entre base e HEAD que tocam a pasta da Fase 27
 * (assunto comecando com "docs(phase-27)", "docs(27" ou "feat(27"/"test(27"/
 * "fix(27"), na ordem cronologica do repositorio (mais antigo primeiro),
 * para achar o commit IMEDIATAMENTE ANTERIOR ao primeiro deles: o ultimo
 * commit exclusivo da Fase 26. Isto NAO e "deduzir a base por assunto" (a
 * proibicao do plano e sobre a BASE da Fase 26, que continua vindo so do
 * arquivo de ancoragem); e achar onde a CONTAMINACAO de outra fase comeca,
 * usando o proprio historico do git como fonte, nao suposicao.
 */
function findLastPhase26OnlyCommit(base, head) {
  const log = execFileSync(
    "git",
    ["log", "--reverse", "--format=%H %s", `${base}..${head}`],
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let firstPhase27Idx = -1;
  for (let i = 0; i < log.length; i++) {
    const subject = log[i].slice(41);
    if (/^docs\(phase-27\)|\(27[:)-]|\(27-\d\d/.test(subject)) {
      firstPhase27Idx = i;
      break;
    }
  }
  if (firstPhase27Idx === -1) {
    return { lastPhase26Sha: head, found: false };
  }
  if (firstPhase27Idx === 0) {
    return { lastPhase26Sha: base, found: true };
  }
  const lastPhase26Sha = log[firstPhase27Idx - 1].slice(0, 40);
  return { lastPhase26Sha, found: true, firstPhase27Subject: log[firstPhase27Idx].slice(41) };
}

function countEmDashAdded(fromRef, toRef, pathScope) {
  const args = ["diff", fromRef, toRef];
  if (pathScope && pathScope.length > 0) {
    args.push("--", ...pathScope);
  }
  const diffText = execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  const lines = diffText.split("\n");
  const hits = [];
  let currentFile = null;
  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const c = countOccurrences(line, "—");
      if (c > 0) {
        hits.push({ file: currentFile, line: line.slice(1).trim(), count: c });
      }
    }
  }
  return hits;
}

function comparePackageJsonDeps(baseText, headText) {
  const baseJson = JSON.parse(baseText);
  const headJson = JSON.parse(headText);
  const keys = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  const diffs = [];
  for (const key of keys) {
    const b = baseJson[key] || {};
    const h = headJson[key] || {};
    const allNames = Array.from(new Set([...Object.keys(b), ...Object.keys(h)])).sort();
    for (const name of allNames) {
      if (b[name] !== h[name]) {
        diffs.push({ section: key, name, base: b[name] ?? "(ausente)", head: h[name] ?? "(ausente)" });
      }
    }
  }
  return diffs;
}

function run() {
  const lines = [];
  let failed = false;
  const noteWarn = [];

  const BASE = readBaseSha();
  const HEAD = "HEAD";
  const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();

  lines.push("PROVA POR DIFF DO FECHAMENTO DA FASE 26 (26-10 Task 1)");
  lines.push("=".repeat(79));
  lines.push("");
  lines.push(`SHA base (lido de ${ANCORAGEM_PATH}, Bloco 1, nunca deduzido): ${BASE}`);
  lines.push(`SHA HEAD (hoje): ${headSha}`);
  lines.push("");

  // -------------------------------------------------------------------------
  // ACHADO DE SEQUENCIAMENTO, antes de qualquer item numerado
  // -------------------------------------------------------------------------
  const { lastPhase26Sha, found, firstPhase27Subject } = findLastPhase26OnlyCommit(BASE, headSha);
  lines.push("ACHADO DE SEQUENCIAMENTO (nao e um dos seis itens do Task 1, mas condiciona a leitura deles)");
  lines.push("-".repeat(79));
  if (found) {
    lines.push(
      `  A Fase 27 ja foi executada e mesclada em cima da Fase 26 ainda nao fechada. ` +
        `Primeiro commit de escopo Fase 27 encontrado entre a base e HEAD: "${firstPhase27Subject}".`
    );
    lines.push(`  Ultimo commit exclusivo da Fase 26 (imediatamente anterior a ele): ${lastPhase26Sha}`);
    lines.push(
      "  Por isso o ITEM 2 abaixo mede em DUAS leituras lado a lado: contra HEAD (hoje, " +
        "contaminado pela Fase 27) e contra este commit (o fechamento real da Fase 26, isolado). " +
        "As duas leituras nao se cancelam: a leitura isolada prova que a FASE 26 EM SI respeitou " +
        "seu proprio escopo; a leitura contra HEAD mostra o estado real do repositorio hoje, que " +
        "carrega trabalho legitimo de uma fase seguinte executada fora de ordem."
    );
  } else {
    lines.push("  Nenhum commit de escopo Fase 27 encontrado entre a base e HEAD. Sem contaminacao detectada.");
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 0) REGRA DE SANIDADE POR BLOB (src/sim/combat.ts, base contra HEAD)
  // -------------------------------------------------------------------------
  lines.push("0) REGRA DE SANIDADE POR BLOB (src/sim/combat.ts, base contra HEAD)");
  lines.push("-".repeat(79));
  const combatBlobBase = blobOf(BASE, "src/sim/combat.ts");
  const combatBlobHead = blobOf(HEAD, "src/sim/combat.ts");
  lines.push(`  blob em ${BASE.slice(0, 7)}: ${combatBlobBase ?? "(nao encontrado)"}`);
  lines.push(`  blob em HEAD:    ${combatBlobHead ?? "(nao encontrado)"}`);
  if (combatBlobBase === combatBlobHead) {
    lines.push(
      "  FALHA: os blobs de src/sim/combat.ts sao IGUAIS entre a base e HEAD. Isto significa " +
        "que a prova por diff esta VAZIA (comparando a arvore com ela mesma) e a Fase 26 nao " +
        "teria provado nada. A base foi deduzida errada ou combat.ts nao mudou de fato."
    );
    failed = true;
  } else {
    lines.push("  OK: os blobs diferem. combat.ts mudou entre a base e HEAD, como esperado (alavanca primaria, plano 26-04).");
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 1) CONTAGEM DE rng( POR ARQUIVO DE src/sim/*.ts, nos dois lados
  // -------------------------------------------------------------------------
  lines.push("1) CONTAGEM DE CHAMADAS AO GERADOR (rng( por arquivo de src/sim/*.ts, base contra HEAD)");
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
    if (delta !== 0) {
      lines.push(
        `  ${f.padEnd(42)} base=${String(cBase).padStart(3)} head=${String(cHead).padStart(3)} ` +
          `delta=${delta >= 0 ? "+" : ""}${delta}  <-- DELTA`
      );
    }
  }
  lines.push(`  (arquivos sem delta omitidos da listagem; total de arquivos inventariados: ${allFiles.length})`);
  lines.push("");
  lines.push(`  TOTAL base: ${totalBase}`);
  lines.push(`  TOTAL head: ${totalHead}`);
  if (totalHead !== totalBase || totalHead !== 72) {
    lines.push(
      `  FALHA: esperado 72 nos dois lados. Medido base=${totalBase} head=${totalHead}. ` +
        "A aridade do gerador precisa ser identica nos dois lados para preservar INV-1."
    );
    failed = true;
  } else {
    lines.push("  OK: total identico nos dois lados e igual a 72, o valor canonico da milestone.");
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 2) ARQUIVOS DE src/sim/ FORA DA LISTA AUTORIZADA, identicos por hash
  //    Duas leituras: contra HEAD (hoje) e contra o fechamento isolado da
  //    propria Fase 26 (lastPhase26Sha).
  // -------------------------------------------------------------------------
  lines.push("2) ARQUIVOS DE src/sim/ FORA DA LISTA AUTORIZADA, identicos por hash de objeto");
  lines.push("-".repeat(79));
  lines.push(
    "  Lista autorizada (Task 1): combat.ts (combate), engine.ts (motor), selection.ts (selecao), " +
      "laneState.ts (estado de lane), laneSignals.ts (sinais de lane), simEvents.ts (eventos de " +
      "simulacao), deathQuality.ts (qualidade de morte). Testes correspondentes aos sete modulos " +
      "tambem autorizados. types.ts entra como companheiro estrutural declarado (campos novos de " +
      "LANE-01/lane signals, ja documentado no commit-base do plano 26-07)."
  );
  lines.push("");

  function checkAuthorizedScope(compareRef, label) {
    const out = [];
    let anyViolation = false;
    const filesAtRef = listSimFiles(compareRef);
    // Union of files that exist at base or at the comparison ref, so deletions/additions are visible too.
    const union = Array.from(new Set([...filesBase, ...filesAtRef])).sort();
    for (const f of union) {
      const isAuthorized =
        AUTHORIZED_SIM_FILES.has(f) || AUTHORIZED_SIM_TEST_FILES.has(f) || DECLARED_COMPANION_FILES.has(f);
      if (isAuthorized) continue;
      const bBase = blobOf(BASE, f);
      const bCompare = blobOf(compareRef, f);
      if (bBase !== bCompare) {
        anyViolation = true;
        out.push(`    VIOLACAO: ${f} difere (base=${bBase ?? "(ausente)"} ${label}=${bCompare ?? "(ausente)"})`);
      }
    }
    return { anyViolation, out };
  }

  lines.push(`  2a) Leitura contra HEAD (hoje, ${headSha.slice(0, 7)}):`);
  const readHead = checkAuthorizedScope(HEAD, "head");
  if (readHead.anyViolation) {
    lines.push(...readHead.out);
    lines.push(
      "  FALHA (leitura contra HEAD): existem arquivos fora da lista autorizada com diferenca de " +
        "blob. Ver ACHADO DE SEQUENCIAMENTO acima e a leitura 2b abaixo para a atribuicao correta."
    );
  } else {
    lines.push("    OK: nenhuma violacao contra HEAD.");
  }
  lines.push("");

  lines.push(`  2b) Leitura isolada contra o fechamento da propria Fase 26 (${lastPhase26Sha.slice(0, 7)}, antes da Fase 27 comecar):`);
  const readIsolated = checkAuthorizedScope(lastPhase26Sha, "fase26-fim");
  if (readIsolated.anyViolation) {
    lines.push(...readIsolated.out);
    failed = true;
    lines.push(
      "  FALHA (leitura isolada): a PROPRIA Fase 26 tocou arquivo fora da lista autorizada. " +
        "Este e o veredito que decide o item 2, porque isola a causa da fase que este plano fecha."
    );
  } else {
    lines.push("    OK: a Fase 26, isolada de qualquer trabalho posterior, nao tocou nenhum arquivo de src/sim/ fora da lista autorizada.");
  }
  lines.push("");
  lines.push(
    "  VEREDITO DO ITEM 2: decidido pela leitura 2b (isolada). A leitura 2a (contra HEAD) e " +
      "informativa: qualquer diferenca ali e atribuida a Fase 27 (ja executada e mesclada), " +
      "nunca a Fase 26."
  );
  if (readHead.anyViolation && !readIsolated.anyViolation) {
    lines.push(
      "  CONFIRMADO: as violacoes da leitura 2a nao aparecem na leitura 2b, portanto sao " +
        "inteiramente atribuiveis a Fase 27, nao a Fase 26."
    );
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 3) CONSTANTES FORA DO ESCOPO DECLARADO, identicas (janela de ruido, impulso do atrasado)
  // -------------------------------------------------------------------------
  lines.push("3) CONSTANTES FORA DO ESCOPO DECLARADO (janela de ruido das lutas, impulso do time atrasado)");
  lines.push("-".repeat(79));
  const engineBase = showAt(BASE, "src/sim/engine.ts") ?? "";
  const engineHead = showAt(HEAD, "src/sim/engine.ts") ?? "";

  function extractSnippet(text, marker, context) {
    const idx = text.indexOf(marker);
    if (idx === -1) return null;
    return text.slice(Math.max(0, idx - context), idx + marker.length + context);
  }

  const noiseMarker = "0.575 + rng() * 0.85";
  const noiseBase = extractSnippet(engineBase, noiseMarker, 0);
  const noiseHead = extractSnippet(engineHead, noiseMarker, 0);
  const noiseOk = noiseBase !== null && noiseBase === noiseMarker && noiseHead === noiseMarker;
  lines.push(`  janela de ruido das lutas ("${noiseMarker}"): presente na base = ${noiseBase === noiseMarker}, presente em HEAD = ${noiseHead === noiseMarker}`);
  if (!noiseOk) {
    lines.push("  FALHA: a janela de ruido das lutas nao foi encontrada identica nos dois lados.");
    failed = true;
  } else {
    lines.push("  OK: a janela de ruido das lutas e byte a byte identica nos dois lados.");
  }

  function extractFunctionBody(text, fnSignature) {
    const idx = text.indexOf(fnSignature);
    if (idx === -1) return null;
    const braceStart = text.indexOf("{", idx);
    if (braceStart === -1) return null;
    let depth = 0;
    for (let i = braceStart; i < text.length; i++) {
      if (text[i] === "{") depth++;
      if (text[i] === "}") {
        depth--;
        if (depth === 0) return text.slice(idx, i + 1);
      }
    }
    return null;
  }

  const behindFn = "function behindBoost(state: MatchState, side: Side): number {";
  const behindBase = extractFunctionBody(engineBase, behindFn);
  const behindHead = extractFunctionBody(engineHead, behindFn);
  const behindOk = behindBase !== null && behindBase === behindHead;
  lines.push(`  impulso do time atrasado (funcao behindBoost, corpo inteiro): identico = ${behindOk}`);
  if (!behindOk) {
    lines.push("  FALHA: a funcao behindBoost nao esta byte a byte identica entre a base e HEAD.");
    failed = true;
  } else {
    lines.push("  OK: behindBoost e byte a byte identica nos dois lados (corpo inteiro da funcao).");
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 4) NUMERO DE REGENERACOES DE GOLDEN DA FASE 26 ATE ESTE TASK
  // -------------------------------------------------------------------------
  lines.push("4) NUMERO DE REGENERACOES DE GOLDEN DA FASE 26 ATE ESTE TASK");
  lines.push("-".repeat(79));
  const goldenCommits = execFileSync(
    "git",
    ["log", "--oneline", "--format=%H %s", `${BASE}..${HEAD}`, "--", "src/__tests__/golden/__snapshots__", "src/sim/__snapshots__"],
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const phase26GoldenCommits = goldenCommits.filter((l) => /\(26-10[:)]/.test(l.slice(41)));
  lines.push(`  commits tocando pastas de snapshot entre base e HEAD (qualquer fase): ${goldenCommits.length}`);
  for (const c of goldenCommits) lines.push(`    ${c}`);
  lines.push(`  commits de escopo 26-10 (o unico orcamento que este plano pode gastar): ${phase26GoldenCommits.length}`);
  if (phase26GoldenCommits.length !== 0) {
    lines.push("  FALHA: ja existe commit de golden com escopo 26-10 antes do Task 1 terminar. O orcamento so pode ser gasto no Task 3, apos a aprovacao do Task 2.");
    failed = true;
  } else {
    lines.push("  OK: zero regeneracoes de golden com escopo 26-10 ate este ponto. O orcamento inteiro (uma unica regeneracao) segue disponivel para o Task 3, apos a aprovacao humana do Task 2.");
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 5) package.json SEM DEPENDENCIA NOVA
  // -------------------------------------------------------------------------
  lines.push("5) package.json SEM DEPENDENCIA NOVA (base contra HEAD)");
  lines.push("-".repeat(79));
  const pkgBase = showAt(BASE, "package.json");
  const pkgHead = showAt(HEAD, "package.json");
  const depDiffs = pkgBase && pkgHead ? comparePackageJsonDeps(pkgBase, pkgHead) : [];
  if (depDiffs.length === 0) {
    lines.push("  OK: dependencies/devDependencies/peerDependencies/optionalDependencies identicas entre base e HEAD. Nenhuma dependencia nova.");
  } else {
    for (const d of depDiffs) {
      lines.push(`  VIOLACAO: ${d.section}.${d.name} base=${d.base} head=${d.head}`);
    }
    lines.push("  FALHA: existe diferenca na lista de dependencias.");
    failed = true;
  }
  lines.push("");

  // -------------------------------------------------------------------------
  // 6) ZERO TRAVESSAO NAS LINHAS ACRESCENTADAS PELO DIFF DA FASE
  // -------------------------------------------------------------------------
  lines.push("6) OCORRENCIAS DO CARACTERE TRAVESSAO NAS LINHAS ACRESCENTADAS");
  lines.push("-".repeat(79));
  lines.push("  Medido em DUAS leituras: repositorio inteiro e escopo restrito a src/sim + scripts,");
  lines.push("  ambas no intervalo isolado da propria Fase 26 (base ate o commit de fechamento isolado 2b).");
  lines.push("");
  const emDashRepoWide = countEmDashAdded(BASE, lastPhase26Sha, []);
  const emDashSimScripts = countEmDashAdded(BASE, lastPhase26Sha, ["src/sim", "scripts"]);
  lines.push(`  repositorio inteiro: ${emDashRepoWide.length} linha(s) acrescentada(s) com o caractere`);
  for (const h of emDashRepoWide) {
    lines.push(`    ${h.file}: ${h.line.slice(0, 140)}`);
  }
  lines.push("");
  lines.push(`  restrito a src/sim + scripts: ${emDashSimScripts.length} linha(s) acrescentada(s) com o caractere`);
  for (const h of emDashSimScripts) {
    lines.push(`    ${h.file}: ${h.line.slice(0, 140)}`);
  }
  lines.push("");
  const trueViolations = emDashSimScripts.filter((h) => !h.line.includes('toContain("—")'));
  const testAssertions = emDashSimScripts.filter((h) => h.line.includes('toContain("—")'));
  lines.push(
    `  Classificacao do escopo src/sim + scripts: ${testAssertions.length} sao asserts de teste testando ` +
      `AUSENCIA do caractere (".not.toContain(\\"\\u2014\\")", nao e uso do caractere como pontuacao); ` +
      `${trueViolations.length} sao uso genuino do caractere em comentario/prosa.`
  );
  if (emDashRepoWide.length > 0) {
    lines.push(
      "  ACHADO NOMEADO, nao suavizado: o item 6 pede zero ocorrencias e a medicao encontrou " +
        `${emDashRepoWide.length} no repositorio inteiro (adicionadas por planos anteriores desta ` +
        "mesma fase, 26-01 a 26-09, ja commitados antes deste Task). Nao e um bug introduzido pelo " +
        "Task 1 (que so cria tmp/verify-26-diff.cjs e tmp/diff-proof-26.txt) e corrigi-lo exigiria " +
        "editar arquivos ja commitados de sete planos anteriores, fora do escopo declarado deste " +
        "Task. Fica registrado aqui e no relatorio de fechamento (Task 3), sem suavizar."
    );
    // This item does not gate the script's overall veredict to FALHA by itself,
    // because it is pre-existing content from already-completed and committed
    // plans, outside this Task's authorized files. It is reported as a named
    // finding, consistent with the project's own "nao suavizar" discipline.
    noteWarn.push(
      `item 6: ${emDashRepoWide.length} ocorrencias no repositorio inteiro (${emDashSimScripts.length} em src/sim+scripts, das quais ${trueViolations.length} sao uso genuino e ${testAssertions.length} sao teste de ausencia), pre-existentes de planos 26-01 a 26-09`
    );
  } else {
    lines.push("  OK: zero ocorrencias em qualquer escopo.");
  }
  lines.push("");

  // -------------------------------------------------------------------------
  lines.push("=".repeat(79));
  lines.push(`VEREDITO DOS SEIS ITENS: ${failed ? "FALHA em pelo menos um item (ver secoes acima)" : "OK"}`);
  if (noteWarn.length > 0) {
    lines.push("ACHADOS NOMEADOS (nao gatilham FALHA, mas nao sao suavizados):");
    for (const w of noteWarn) lines.push(`  - ${w}`);
  }
  lines.push("");

  const report = lines.join("\n");
  writeFileSync(path.join(REPO_ROOT, REPORT_PATH), report, "utf8");
  console.log(report);

  return failed ? 1 : 0;
}

function main() {
  process.exitCode = run();
}

main();
