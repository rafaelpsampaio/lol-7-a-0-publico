/**
 * src/data/packSheet.ts
 *
 * Builds the fill-in .xlsx template (and the round-trip export of an existing
 * pack) consumed back by packImport.ts. Four sheets:
 *   - Jogadores : the data grid the friend fills in (dropdowns for rota, traço,
 *                 conforto; pre-filled rows when exporting an existing pack).
 *   - Exemplo   : two worked example rows.
 *   - Instrucoes: how to fill it in (ported from data-templates/GUIA-preenchimento).
 *   - Campeoes  : id + nome reference list (also the source for the champion
 *                 dropdown on the Jogadores sheet).
 *
 * Column layout matches packImport.ts's header candidates exactly so the round
 * trip is lossless. Champion cells accept a name OR an id (the importer resolves
 * either), so the dropdown lists display names for friendliness.
 */

import ExcelJS from "exceljs";
import { TRAIT_INFO } from "./traitInfo";
import type { ChampionEntry, PlayerVersion, PlayerTrait } from "./schema";

const CHAMP_SLOTS = 8;

/** Fixed leading columns (before the champN pairs). Order = importer headers. */
const BASE_HEADERS = [
  "id",
  "personId",
  "displayName",
  "year",
  "primaryRole",
  "roles",
  "lanePhase",
  "midGame",
  "lateGame",
  "Overall",
  "trait1",
  "trait2",
  "trait3",
  "trait4",
] as const;

const ROLE_OPTIONS = "top,jungle,mid,adc,support";
const TRAIT_LABELS = (Object.values(TRAIT_INFO) as { label: string }[])
  .map((t) => t.label)
  .join(",");

/** Build the full ordered header row (base + champ pairs). */
function buildHeaders(): string[] {
  const headers: string[] = [...BASE_HEADERS];
  for (let n = 1; n <= CHAMP_SLOTS; n++) {
    headers.push(`champ${n}_id`, `champ${n}_mastery`);
  }
  return headers;
}

/** Map a player's pt-BR trait labels back for display in the sheet. */
function traitLabel(t: PlayerTrait): string {
  return TRAIT_INFO[t]?.label ?? t;
}

/** A player -> ordered cell values aligned with buildHeaders(). */
function playerToRow(p: PlayerVersion): (string | number)[] {
  const row: (string | number)[] = [
    p.id,
    p.personId,
    p.displayName,
    p.year ?? "",
    p.primaryRole,
    p.roles.join("|"),
    p.lanePhase,
    p.midGame,
    p.lateGame,
    p.roleStrength[p.primaryRole] ?? "",
    traitLabel(p.traits[0] ?? ("" as PlayerTrait)),
    p.traits[1] ? traitLabel(p.traits[1]) : "",
    p.traits[2] ? traitLabel(p.traits[2]) : "",
    p.traits[3] ? traitLabel(p.traits[3]) : "",
  ];
  for (let n = 0; n < CHAMP_SLOTS; n++) {
    const cm = p.championPool[n];
    row.push(cm ? cm.championId : "", cm ? cm.mastery : "");
  }
  return row;
}

/**
 * Build the workbook. When `pack` is given, the Jogadores sheet is pre-filled
 * with its players (export / round-trip); otherwise it is an empty template.
 */
export function buildPackWorkbook(
  champions: ChampionEntry[],
  pack?: { name: string; players: PlayerVersion[] }
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LoL 7 a 0";

  const headers = buildHeaders();

  // --- Campeoes (reference + dropdown source) ---
  const refSheet = wb.addWorksheet("Campeoes");
  refSheet.addRow(["id", "nome"]);
  refSheet.getRow(1).font = { bold: true };
  const sorted = [...champions].sort((a, b) => a.name.localeCompare(b.name));
  for (const c of sorted) refSheet.addRow([c.id, c.name]);
  refSheet.getColumn(1).width = 22;
  refSheet.getColumn(2).width = 24;
  const champNameRange = `Campeoes!$B$2:$B$${sorted.length + 1}`;

  // --- Jogadores ---
  const sheet = wb.addWorksheet("Jogadores");
  sheet.addRow(headers);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Pre-fill with the pack's players (export), else leave blank rows.
  const players = pack?.players ?? [];
  for (const p of players) sheet.addRow(playerToRow(p));

  // Column widths.
  sheet.getColumn(3).width = 18; // displayName
  sheet.getColumn(5).width = 12; // primaryRole
  sheet.getColumn(11).width = 16; // trait1
  sheet.getColumn(12).width = 16; // trait2
  sheet.getColumn(13).width = 16; // trait3
  sheet.getColumn(14).width = 16; // trait4

  // Data validation on rows 2..N (N covers blanks for new entries).
  const lastRow = Math.max(players.length + 1, 60);
  const colLetter = (idx1: number) => sheet.getColumn(idx1).letter;
  const roleCol = colLetter(BASE_HEADERS.indexOf("primaryRole") + 1);
  const t1Col = colLetter(BASE_HEADERS.indexOf("trait1") + 1);
  const t2Col = colLetter(BASE_HEADERS.indexOf("trait2") + 1);
  const t3Col = colLetter(BASE_HEADERS.indexOf("trait3") + 1);
  const t4Col = colLetter(BASE_HEADERS.indexOf("trait4") + 1);

  for (let r = 2; r <= lastRow; r++) {
    sheet.getCell(`${roleCol}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${ROLE_OPTIONS}"`],
    };
    for (const tc of [t1Col, t2Col, t3Col, t4Col]) {
      sheet.getCell(`${tc}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${TRAIT_LABELS}"`],
      };
    }
    // champN_id (champion dropdown) + champN_mastery (1-5)
    for (let n = 0; n < CHAMP_SLOTS; n++) {
      const idCol = colLetter(BASE_HEADERS.length + n * 2 + 1);
      const mCol = colLetter(BASE_HEADERS.length + n * 2 + 2);
      sheet.getCell(`${idCol}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [champNameRange],
      };
      sheet.getCell(`${mCol}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"1,2,3,4,5"'],
      };
    }
  }

  // --- Exemplo ---
  const ex = wb.addWorksheet("Exemplo");
  ex.addRow(headers);
  ex.getRow(1).font = { bold: true };
  ex.addRow([
    "faker-2016", "faker", "Faker 2016", 2016, "mid", "mid",
    95, 97, 94, 96, "Clutch", "Cabeça fria", "", "",
    "leblanc", 5, "zed", 5, "ryze", 4, "orianna", 4,
    "twisted fate", 3, "cassiopeia", 3, "galio", 2, "corki", 1,
  ]);
  ex.addRow([
    "", "amigo", "Zé do Jungle", "", "jungle", "jungle|top",
    65, 60, 55, 62, "Cabeça fria", "", "", "",
    "lee sin", 5, "vi", 3, "sejuani", 3, "kha zix", 2,
    "amumu", 2, "warwick", 2, "nidalee", 1, "graves", 2,
  ]);
  ex.getColumn(3).width = 18;

  // --- Instrucoes ---
  const guide = wb.addWorksheet("Instrucoes");
  const lines: string[] = [
    "COMO PREENCHER - pacote de jogadores",
    "",
    "Preencha a aba Jogadores (uma linha por jogador). Veja a aba Exemplo.",
    "",
    "Colunas:",
    "- displayName: nome que aparece no jogo (obrigatório).",
    "- id / personId: pode deixar em branco, o sistema gera. personId agrupa as",
    "  versões da mesma pessoa (ex: faker em vários anos).",
    "- year: ano (2011-2035). Pode deixar em branco: a carta fica sem ano.",
    "- primaryRole: top | jungle | mid | adc | support (use o menu da célula).",
    "- roles: rotas jogáveis separadas por | (ex: mid|adc). Opcional.",
    "- lanePhase / midGame / lateGame: força 1-100 por fase.",
    "- Overall: força geral da rota principal. Em branco, vale a média das 3 fases.",
    "- trait1 a trait4: até 4 traços (use o menu). Traços fora da lista são",
    "  ignorados na importação, sem quebrar nada.",
    "- champ1_id..champ8_id: campeão por nome OU id. Pode escrever 'Miss Fortune',",
    "  'miss fortune' ou 'miss-fortune' - a importação entende e corrige typos.",
    "- champN_mastery: conforto 1-5.",
    "",
    "Mínimo de 8 campeões por jogador (regra do draft fearless Bo5). Se faltar,",
    "a importação completa o pool automaticamente e avisa.",
    "",
    "Para um torneio de 8 times, cada rota precisa de cartas de sobra: 8 cartas",
    "de quem só joga aquela rota bastam. A tela de pacotes mostra se está pronto.",
    "",
    "A aba Campeoes lista todos os ids e nomes válidos para referência.",
  ];
  for (const l of lines) guide.addRow([l]);
  guide.getColumn(1).width = 80;

  return wb;
}

/**
 * Trigger a browser download of a workbook. DOM-only (called from the UI).
 */
export async function downloadWorkbook(
  wb: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
