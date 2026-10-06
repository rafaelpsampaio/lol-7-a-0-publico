/**
 * scripts/diff-golden.ts
 *
 * Diff estruturado de golden (Fase 23 / INST-07).
 * Executar: node scripts/diff-golden.ts               (compara a versao commitada
 *           com a arvore de trabalho, o gesto natural depois de npm run update-golden)
 *           node scripts/diff-golden.ts <antigo> <novo>  (compara dois caminhos informados)
 *
 * Invariantes nao negociaveis:
 *   - Zero import de src/: le o .snap como texto puro, sem tocar a engine
 *   - Zero import de vitest: modulo standalone, roda direto no node
 *   - Relatorio pt-BR sem o caractere travessao
 *
 * Limitacao documentada, nao contornada: GoldenDigest.events nao guarda `lane`
 * (exclusao deliberada em src/__tests__/golden/fixtures.ts, D-11, para manter o
 * digest minimo e desacoplado de UI). Violacao de ordem por tier de torre
 * (externa > interna > inibidor > nexus) dentro de uma mesma lane NAO e
 * derivavel deste snapshot. Estender o digest mudaria a ESTRUTURA do golden,
 * permitido apenas no passe deliberado unico da Fase 30 (ROADMAP.md: "golden
 * muda de valor, nunca de estrutura"). Este script cobre o que e derivavel e
 * reporta a limitacao no proprio relatorio, em vez de fingir cobertura completa.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// Formato do digest (identico a GoldenDigest em src/__tests__/golden/fixtures.ts)
// ---------------------------------------------------------------------------

export interface GoldenDigest {
  winner: string;
  finalScore: Record<string, number>;
  events: Array<{
    kind: string;
    timeSec: number;
    side: string | null;
    actors: string[];
    victims: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Parser do .snap: cada bloco vitest e `exports[\`nome\`] = \`\n"<json>"\n\`;`
// A exigencia de backtick+";" logo apos a aspa de fechamento evita que o
// parser pare cedo demais num valor de array de uma linha so (ex.: um unico
// actor/victim sem virgula), que tambem termina em aspa seguida de quebra
// de linha mas nunca e seguido de backtick+";".
// ---------------------------------------------------------------------------

// Checkouts no Windows usam CRLF; o Vitest grava LF ao regenerar o golden.
const BLOCK_RE = /exports\[`([\s\S]+?)`\] = `\r?\n"([\s\S]*?)"\r?\n`;/g;

/** Nunca lanca: um texto sem blocos (ou com JSON corrompido num bloco) devolve mapa vazio ou parcial. */
export function parseSnapFile(text: string): Map<string, GoldenDigest> {
  const out = new Map<string, GoldenDigest>();
  for (const m of text.matchAll(BLOCK_RE)) {
    const [, name, json] = m;
    try {
      out.set(name, JSON.parse(json) as GoldenDigest);
    } catch {
      // bloco com JSON corrompido: ignorado, nao interrompe os demais blocos
    }
  }
  return out;
}

function lastTimeSec(events: GoldenDigest["events"]): number {
  return events.length ? Math.max(...events.map((e) => e.timeSec)) : 0;
}

/** Spawn do Baron, em segundos (20:00). Fonte: convencao ja usada nos harnesses de calibracao. */
const BARON_SPAWN_SEC = 1200;

/**
 * Violacoes de ordem CHECAVEIS a partir do digest (sem `lane`, ver limitacao
 * no cabecalho deste arquivo e na nota impressa por formatDiffReport).
 */
export function detectOrderViolations(events: GoldenDigest["events"]): string[] {
  const violations: string[] = [];

  for (let i = 1; i < events.length; i++) {
    if (events[i].timeSec < events[i - 1].timeSec) {
      violations.push(
        `fora de ordem cronologica: ${events[i].kind}@${events[i].timeSec}s depois de ${events[i - 1].kind}@${events[i - 1].timeSec}s`
      );
    }
  }

  for (const e of events) {
    if ((e.kind === "baron_taken" || e.kind === "baron_steal") && e.timeSec < BARON_SPAWN_SEC) {
      violations.push(`Baron antes do spawn (${BARON_SPAWN_SEC}s): ${e.kind}@${e.timeSec}s`);
    }
  }

  const dragonSeenBySide = new Set<string>();
  for (const e of events) {
    if (e.kind === "dragon_taken" && e.side) dragonSeenBySide.add(e.side);
    if ((e.kind === "elder_taken" || e.kind === "elder_steal") && e.side && !dragonSeenBySide.has(e.side)) {
      violations.push(`Elder antes de qualquer dragao do mesmo lado: ${e.kind}@${e.timeSec}s side=${e.side}`);
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Diff de dois digests, nas quatro dimensoes de INST-07
// ---------------------------------------------------------------------------

export interface DigestDiff {
  winnerChanged: boolean;
  oldWinner: string;
  newWinner: string;
  kindsAdded: string[];
  kindsRemoved: string[];
  /**
   * Aproximacao: o digest nao guarda duracao explicita (D-11 exclui campos de
   * UI, incluindo duracao/playbackMs). O proxy e o timeSec do ultimo evento
   * de cada lado, que fica tipicamente a ~1 tick (15s) da duracao real.
   */
  durationDeltaSecApprox: number;
  orderViolationsOld: string[];
  orderViolationsNew: string[];
}

export function diffDigests(oldD: GoldenDigest, newD: GoldenDigest): DigestDiff {
  const oldKinds = new Set(oldD.events.map((e) => e.kind));
  const newKinds = new Set(newD.events.map((e) => e.kind));
  return {
    winnerChanged: oldD.winner !== newD.winner,
    oldWinner: oldD.winner,
    newWinner: newD.winner,
    kindsAdded: [...newKinds].filter((k) => !oldKinds.has(k)),
    kindsRemoved: [...oldKinds].filter((k) => !newKinds.has(k)),
    durationDeltaSecApprox: lastTimeSec(newD.events) - lastTimeSec(oldD.events),
    orderViolationsOld: detectOrderViolations(oldD.events),
    orderViolationsNew: detectOrderViolations(newD.events),
  };
}

// ---------------------------------------------------------------------------
// Relatorio agregado, pt-BR, quatro dimensoes + nota de limitacao
// ---------------------------------------------------------------------------

const LANE_LIMITATION_NOTE =
  "Limitacao conhecida: o digest do golden nao guarda a lane (D-11, src/__tests__/golden/fixtures.ts). " +
  "Violacao de ordem por tier de torre (externa > interna > inibidor > nexus) dentro de uma mesma lane " +
  "nao e checavel a partir deste snapshot. Estender o digest para incluir lane mudaria a estrutura do " +
  "golden, o que so e permitido no passe deliberado unico da Fase 30. Este relatorio cobre apenas o que " +
  "e derivavel do digest atual.";

export function formatDiffReport(oldMap: Map<string, GoldenDigest>, newMap: Map<string, GoldenDigest>): string {
  const oldNames = new Set(oldMap.keys());
  const newNames = new Set(newMap.keys());
  const common = [...oldNames].filter((n) => newNames.has(n)).sort();
  const onlyOld = [...oldNames].filter((n) => !newNames.has(n)).sort();
  const onlyNew = [...newNames].filter((n) => !oldNames.has(n)).sort();

  const diffs = new Map<string, DigestDiff>();
  for (const name of common) {
    diffs.set(name, diffDigests(oldMap.get(name)!, newMap.get(name)!));
  }

  const lines: string[] = [];
  let anyDiff = false;

  lines.push(
    `Diff estruturado de golden (INST-07): ${common.length} snapshot(s) comum(uns) comparado(s) ` +
      `(${oldMap.size} no lado antigo, ${newMap.size} no lado novo).`
  );
  lines.push("");

  // 1. Vencedores mudados
  const winnerChanges = common.filter((name) => diffs.get(name)!.winnerChanged);
  lines.push(`1) Vencedores mudados: ${winnerChanges.length}`);
  if (winnerChanges.length === 0) {
    lines.push("   nenhum");
  } else {
    anyDiff = true;
    for (const name of winnerChanges) {
      const d = diffs.get(name)!;
      lines.push(`   - ${name}: ${d.oldWinner} -> ${d.newWinner}`);
    }
  }
  lines.push("");

  // 2. Tipos de evento acrescentados/removidos
  const kindChanges = common.filter((name) => {
    const d = diffs.get(name)!;
    return d.kindsAdded.length > 0 || d.kindsRemoved.length > 0;
  });
  lines.push(`2) Tipos de evento acrescentados ou removidos: ${kindChanges.length} snapshot(s) afetado(s)`);
  if (kindChanges.length === 0) {
    lines.push("   nenhum");
  } else {
    anyDiff = true;
    for (const name of kindChanges) {
      const d = diffs.get(name)!;
      if (d.kindsAdded.length) lines.push(`   - ${name}: acrescentados [${d.kindsAdded.join(", ")}]`);
      if (d.kindsRemoved.length) lines.push(`   - ${name}: removidos [${d.kindsRemoved.join(", ")}]`);
    }
  }
  lines.push("");

  // 3. Delta de duracao aproximado
  const durationChanges = common.filter((name) => diffs.get(name)!.durationDeltaSecApprox !== 0);
  lines.push(`3) Delta de duracao aproximado (proxy = timeSec do ultimo evento): ${durationChanges.length} snapshot(s) afetado(s)`);
  if (durationChanges.length === 0) {
    lines.push("   nenhum");
  } else {
    anyDiff = true;
    for (const name of durationChanges) {
      const delta = diffs.get(name)!.durationDeltaSecApprox;
      const sign = delta > 0 ? "+" : "";
      lines.push(`   - ${name}: ${sign}${delta}s`);
    }
  }
  lines.push("");

  // 4. Violacoes de ordem
  const orderChanges = common.filter((name) => {
    const d = diffs.get(name)!;
    return d.orderViolationsOld.length > 0 || d.orderViolationsNew.length > 0;
  });
  lines.push(`4) Violacoes de ordem detectadas: ${orderChanges.length} snapshot(s) afetado(s)`);
  if (orderChanges.length === 0) {
    lines.push("   nenhuma");
  } else {
    anyDiff = true;
    for (const name of orderChanges) {
      const d = diffs.get(name)!;
      for (const v of d.orderViolationsOld) lines.push(`   - ${name} [lado antigo]: ${v}`);
      for (const v of d.orderViolationsNew) lines.push(`   - ${name} [lado novo]: ${v}`);
    }
  }
  lines.push("");

  // 5. Blocos so num dos lados (mudanca de estrutura, nao de valor)
  const structuralChanges = onlyOld.length + onlyNew.length;
  lines.push(`5) Blocos presentes so num dos lados (mudanca de estrutura, nao de valor): ${structuralChanges}`);
  if (structuralChanges === 0) {
    lines.push("   nenhum");
  } else {
    anyDiff = true;
    for (const name of onlyOld) lines.push(`   - removido: ${name}`);
    for (const name of onlyNew) lines.push(`   - acrescentado: ${name}`);
  }
  lines.push("");

  if (!anyDiff) {
    lines.push("Nenhuma diferenca encontrada em nenhuma das quatro dimensoes (nem em blocos): golden inalterado.");
    lines.push("");
  }

  lines.push(LANE_LIMITATION_NOTE);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI, ativo somente quando o arquivo e invocado diretamente pelo node.
// Importar este modulo (por exemplo, num teste) nunca dispara o bloco abaixo:
// a deteccao compara a URL do proprio modulo com a URL do arquivo passado
// como argumento de processo, que so coincide quando `node scripts/diff-golden.ts`
// e chamado diretamente.
// ---------------------------------------------------------------------------

const SNAP_PATH = "src/__tests__/golden/__snapshots__/golden.test.ts.snap";

/** Le a versao commitada de um arquivo via `git show HEAD:<path>`, sem shell (T-23-14). */
function readCommittedFile(relPath: string): string | null {
  try {
    return execFileSync("git", ["show", `HEAD:${relPath}`], { encoding: "utf8" });
  } catch {
    return null;
  }
}

/** Compara dois caminhos de arquivo de snapshot. Exportada para ser testada sem subir um processo. */
export function diffFiles(oldPath: string, newPath: string): string {
  const oldText = readFileSync(oldPath, "utf8");
  const newText = readFileSync(newPath, "utf8");
  return formatDiffReport(parseSnapFile(oldText), parseSnapFile(newText));
}

function runCli(argv: string[]): void {
  if (argv.length === 0) {
    const committed = readCommittedFile(SNAP_PATH);
    if (committed === null) {
      console.log(
        `Nao foi possivel ler a versao commitada de "${SNAP_PATH}" (arquivo novo, fora de um repositorio git, ` +
          `ou ainda sem nenhum commit). Nada a comparar, isso nao e uma falha.`
      );
      return;
    }
    const working = readFileSync(SNAP_PATH, "utf8");
    console.log(formatDiffReport(parseSnapFile(committed), parseSnapFile(working)));
    return;
  }

  if (argv.length === 1) {
    console.log(
      "Uso:\n" +
        "  node scripts/diff-golden.ts\n" +
        "    Compara a versao COMMITADA do snapshot golden com a versao da arvore de trabalho.\n" +
        "    E o caso de uso real: rode depois de `npm run update-golden` para ver o que mudou\n" +
        "    antes de aprovar a regeneracao.\n" +
        "  node scripts/diff-golden.ts <antigo> <novo>\n" +
        "    Compara os dois caminhos de arquivo de snapshot informados."
    );
    process.exitCode = 1;
    return;
  }

  const [oldPath, newPath] = argv;
  console.log(diffFiles(oldPath, newPath));
}

function isDirectlyInvoked(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isDirectlyInvoked()) {
  runCli(process.argv.slice(2));
}
