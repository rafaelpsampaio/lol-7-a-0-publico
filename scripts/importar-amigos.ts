/**
 * scripts/importar-amigos.ts
 *
 * Carga inicial do pack dos amigos (spec 2026-10-02-pack-amigos-design, secao
 * 6): le a aba Planilha3 do macacos.xlsx, aplica as correcoes combinadas, roda
 * o importador do jogo e grava public/packs/amigos.json.
 *
 * Depois da carga, o JSON e a fonte da verdade. Rodar de novo SOBRESCREVE o que
 * tiver sido editado direto no arquivo.
 *
 * Uso: npm run pack:amigos -- caminho/da/planilha.xlsx
 * A planilha original e local e nao acompanha o repositorio publico.
 */

import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlayersFromRows, worksheetToRows } from "../src/data/packImport";
import { ChampionCatalogueSchema, PlayerDatabaseSchema } from "../src/data/schema";
import { deckSafety, deckShortfalls } from "../src/draft/deckSafety";
import { corrigirLinhas, finalizarCartas } from "./amigos-pack";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLANILHA = resolve(ROOT, process.argv[2] ?? "macacos.xlsx");
const ABA = "Planilha3";
const SAIDA = resolve(ROOT, "public/packs/amigos.json");

if (!existsSync(PLANILHA)) {
  console.error("A planilha original nao acompanha o projeto. O pacote Amigos ja esta pronto em public/packs/amigos.json.");
  console.error("Para importar outra planilha: npm run pack:amigos -- caminho/da/planilha.xlsx");
  process.exit(1);
}

const champions = ChampionCatalogueSchema.parse(
  JSON.parse(readFileSync(resolve(ROOT, "public/champions.json"), "utf8"))
).champions;

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(PLANILHA);
const ws = wb.getWorksheet(ABA);
if (ws === undefined) throw new Error(`Aba "${ABA}" nao encontrada em ${PLANILHA}.`);

const { players, report, summary } = buildPlayersFromRows(corrigirLinhas(worksheetToRows(ws)), champions);

for (const r of report) {
  if (r.messages.length > 0) console.log(`linha ${r.row} ${r.name} [${r.status}]: ${r.messages.join(" | ")}`);
}
const ruins = report.filter((r) => r.status === "warning" || r.status === "error");
if (ruins.length > 0) {
  throw new Error(`${ruins.length} linha(s) com aviso ou erro (acima). Nada foi gravado.`);
}

const cartas = finalizarCartas(players);

const nomes = new Set(cartas.map((p) => p.displayName));
if (nomes.size !== cartas.length) throw new Error("Nomes de carta repetidos. Nada foi gravado.");

const seguranca = deckSafety(cartas);
if (!seguranca.ready) {
  throw new Error(`Base pode travar o draft: ${deckShortfalls(seguranca).join(", ")}. Nada foi gravado.`);
}

const db = PlayerDatabaseSchema.parse({ $schema: "../../.vscode/players.schema.json", name: "Amigos", players: cartas });
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(db, null, 2) + "\n", "utf8");

const pessoas = new Set(cartas.map((p) => p.personId)).size;
console.log(`\n${cartas.length} cartas de ${pessoas} pessoas gravadas em ${SAIDA}`);
console.log(`importador: ${summary.ok} ok, ${summary.fixed} corrigidas`);
console.log(`folga por rota (precisa de ${seguranca.needed}):`, seguranca.spareByRole);
