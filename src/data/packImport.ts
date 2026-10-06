/**
 * src/data/packImport.ts
 *
 * Smart spreadsheet importer: turns a filled .xlsx (the template from packSheet.ts,
 * or the user's own macacos.xlsx) into validated PlayerVersion cards + a per-row
 * report of what was auto-corrected.
 *
 * "Smart" means: champion free-text is resolved via championResolver (typos and
 * spaced names absorbed), roles/traits are normalized (pt-BR labels and casing
 * accepted, unknown traits dropped with a warning), short champion pools are padded
 * to the fearless-Bo5 minimum of 8, and blank ids/stats are filled with sane
 * defaults (blank year stays blank, A-06). Every produced card is re-validated through PlayerVersionSchema; rows
 * that still fail are reported as errors and excluded (never poison the pack).
 *
 * Robustness: also handles the common "CSV-saved-as-xlsx" case where an entire
 * row lands in a single cell separated by ";" — such rows are split transparently.
 *
 * Pure parsing logic lives in `buildPlayersFromRows` (no ExcelJS, unit-tested).
 * `parseWorkbook` is the thin ExcelJS adapter used by the UI.
 */

import ExcelJS from "exceljs";
import {
  PlayerVersionSchema,
  RoleSchema,
  PlayerTraitSchema,
  type PlayerVersion,
  type Role,
  type PlayerTrait,
  type Mastery,
  type ChampionEntry,
  MAX_PLAYER_TRAITS,
} from "./schema";
import { TRAIT_INFO, type TraitInfo } from "./traitInfo";
import { slug } from "./slug";
import { buildChampionResolver } from "./championResolver";

const MIN_POOL = 8;
const ALL_ROLES: Role[] = RoleSchema.options;

export type RowStatus = "ok" | "fixed" | "warning" | "error";

export interface RowReport {
  /** 1-based sheet row number (best-effort). */
  row: number;
  /** Display name as read from the row. */
  name: string;
  /** Highest-severity outcome for the row. */
  status: RowStatus;
  /** pt-BR notes about normalizations, fixes, drops and errors. */
  messages: string[];
}

export interface ImportResult {
  players: PlayerVersion[];
  report: RowReport[];
  summary: { ok: number; fixed: number; warning: number; error: number; total: number };
}

/** A raw row as a list of stringified cells (no header semantics yet). */
export type RawRow = string[];

// ---------------------------------------------------------------------------
// Header matching
// ---------------------------------------------------------------------------

/** Normalize a header cell: lowercase, strip accents and every non-alphanumeric. */
function normHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const HEADER_CANDIDATES = {
  name: ["nome", "displayname", "nomedeexibicao", "jogador", "player"],
  id: ["id"],
  personId: ["personid", "pessoa"],
  year: ["ano", "year"],
  role: ["rota", "rotaprincipal", "primaryrole", "role"],
  roles: ["rotas", "roles"],
  overall: ["forca", "overall", "geral"],
  lanePhase: ["lanephase", "faserotas", "rotasoverall", "early", "inicio"],
  midGame: ["midgame", "meio", "meiojogo"],
  lateGame: ["lategame", "fim", "fimdejogo"],
  trait1: ["trait1", "traco1", "traco", "trait"],
  trait2: ["trait2", "traco2"],
  trait3: ["trait3", "traco3"],
  trait4: ["trait4", "traco4"],
  rs_top: ["rstop"],
  rs_jungle: ["rsjungle", "rsjg"],
  rs_mid: ["rsmid"],
  rs_adc: ["rsadc", "rsbot"],
  rs_support: ["rssupport", "rssup"],
} as const;

type ColKey = keyof typeof HEADER_CANDIDATES;

/** Map a normalized header set to a column index per known field. */
interface ColumnIndex {
  fields: Partial<Record<ColKey, number>>;
  /** champ id columns: index -> column position. */
  champIds: number[];
  /** champ mastery columns aligned to champIds order (NaN if absent). */
  champMasteries: number[];
}

function buildColumnIndex(headerCells: string[]): ColumnIndex {
  const norm = headerCells.map(normHeader);
  const fields: Partial<Record<ColKey, number>> = {};

  for (const [key, candidates] of Object.entries(HEADER_CANDIDATES) as [
    ColKey,
    readonly string[]
  ][]) {
    const idx = norm.findIndex((h) => candidates.includes(h));
    if (idx >= 0) fields[key] = idx;
  }

  // Champion columns: champ1id / champ1 / campeao1 (+ champNmastery / champNconforto)
  const champIds: number[] = [];
  const champMasteries: number[] = [];
  for (let n = 1; n <= 16; n++) {
    const idVariants = [`champ${n}id`, `champ${n}`, `campeao${n}`];
    const masteryVariants = [`champ${n}mastery`, `champ${n}conforto`, `conforto${n}`];
    const idCol = norm.findIndex((h) => idVariants.includes(h));
    if (idCol < 0) continue;
    champIds.push(idCol);
    const mCol = norm.findIndex((h) => masteryVariants.includes(h));
    champMasteries.push(mCol);
  }

  return { fields, champIds, champMasteries };
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

function cell(row: RawRow, idx: number | undefined): string {
  if (idx === undefined || idx < 0) return "";
  return (row[idx] ?? "").trim();
}

function clampInt(v: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Parse a numeric cell; empty string -> NaN (so clampInt uses its fallback). */
function num(raw: string): number {
  return raw.trim() === "" ? NaN : Number(raw);
}

function toRole(raw: string): Role | undefined {
  const r = raw.trim().toLowerCase();
  const parsed = RoleSchema.safeParse(r);
  return parsed.success ? parsed.data : undefined;
}

/** Resolve a trait cell to an enum value, accepting pt-BR labels and casing. */
const TRAIT_BY_LABEL = new Map<string, PlayerTrait>(
  (Object.entries(TRAIT_INFO) as [PlayerTrait, TraitInfo][]).flatMap(([t, info]) =>
    [info.label, ...(info.aliases ?? [])].map((label) => [normHeader(label), t] as [string, PlayerTrait])
  )
);

function toTrait(raw: string): PlayerTrait | undefined {
  const v = raw.trim().toLowerCase();
  const direct = PlayerTraitSchema.safeParse(v);
  if (direct.success) return direct.data;
  return TRAIT_BY_LABEL.get(normHeader(raw));
}

// ---------------------------------------------------------------------------
// Pure row -> players builder (testable without ExcelJS)
// ---------------------------------------------------------------------------

/**
 * Build validated players + a report from raw rows. `rows[0]` MUST be the header
 * row (caller locates it). `champions` drives champion resolution and pool padding.
 */
export function buildPlayersFromRows(
  rows: RawRow[],
  champions: ChampionEntry[]
): ImportResult {
  const resolveChamp = buildChampionResolver(champions);
  const fillIds = champions.map((c) => c.id);

  if (rows.length === 0) {
    return { players: [], report: [], summary: empty() };
  }

  const col = buildColumnIndex(rows[0]);
  const players: PlayerVersion[] = [];
  const report: RowReport[] = [];
  const usedIds = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c || !c.trim())) continue; // blank row

    const messages: string[] = [];
    let status: RowStatus = "ok";
    const bump = (s: RowStatus) => {
      const order: RowStatus[] = ["ok", "fixed", "warning", "error"];
      if (order.indexOf(s) > order.indexOf(status)) status = s;
    };

    const name = cell(row, col.fields.name);
    if (!name) {
      report.push({ row: r + 1, name: "(sem nome)", status: "error", messages: ["Linha sem nome de jogador, ignorada."] });
      continue;
    }

    // Role
    let role = toRole(cell(row, col.fields.role));
    if (!role) {
      // infer from the strongest rs_* column, else default mid
      const rs = readRoleStrength(row, col, undefined);
      const best = ALL_ROLES.reduce((a, b) => (rs[b] > rs[a] ? b : a), "mid" as Role);
      role = rs[best] > 0 ? best : "mid";
      messages.push(`Rota principal ausente, assumida "${role}".`);
      bump("fixed");
    }

    // Roles list
    let roles = cell(row, col.fields.roles)
      .split(/[|,/]/)
      .map((s) => toRole(s))
      .filter((x): x is Role => !!x);
    if (!roles.includes(role)) roles = [role, ...roles];
    roles = [...new Set(roles)];

    // Phase overalls
    const lanePhase = clampInt(num(cell(row, col.fields.lanePhase)), 1, 100, 70);
    const midGame = clampInt(num(cell(row, col.fields.midGame)), 1, 100, 65);
    const lateGame = clampInt(num(cell(row, col.fields.lateGame)), 1, 100, 60);

    // Role strength: sem rs_* nem forca geral, vale a media das 3 fases (A-07)
    const phaseMean = Math.round((lanePhase + midGame + lateGame) / 3);
    const roleStrength = readRoleStrength(row, col, role, phaseMean);

    // Traits
    const traits: PlayerTrait[] = [];
    for (const tCol of [col.fields.trait1, col.fields.trait2, col.fields.trait3, col.fields.trait4]) {
      const raw = cell(row, tCol);
      if (!raw) continue;
      const t = toTrait(raw);
      if (!t) {
        messages.push(`Traço "${raw}" não reconhecido, descartado.`);
        bump("warning");
      } else if (!traits.includes(t)) {
        traits.push(t);
      }
    }

    // Champion pool
    const pool: { championId: string; mastery: Mastery }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < col.champIds.length; i++) {
      const raw = cell(row, col.champIds[i]);
      if (!raw) continue;
      const res = resolveChamp(raw);
      if (!res.id) {
        messages.push(`Campeão "${raw}" não encontrado, ignorado.`);
        bump("warning");
        continue;
      }
      if (res.status === "fuzzy" || res.status === "normalized") {
        if (slug(raw) !== res.id) {
          messages.push(`Campeão "${raw}" entendido como "${res.name}".`);
          bump("fixed");
        }
      }
      if (seen.has(res.id)) continue;
      seen.add(res.id);
      const mIdx = col.champMasteries[i];
      const mastery = clampInt(num(cell(row, mIdx)), 1, 5, 3) as Mastery;
      pool.push({ championId: res.id, mastery });
    }

    // Pad pool to 8
    if (pool.length < MIN_POOL) {
      const before = pool.length;
      for (const id of fillIds) {
        if (pool.length >= MIN_POOL) break;
        if (seen.has(id)) continue;
        seen.add(id);
        pool.push({ championId: id, mastery: 1 as Mastery });
      }
      if (pool.length > before) {
        messages.push(`Pool com ${before} campeões, completado até ${pool.length}.`);
        bump("fixed");
      }
    }

    // Identity
    const explicitPerson = cell(row, col.fields.personId);
    const explicitId = cell(row, col.fields.id);
    const personId = explicitPerson ? slug(explicitPerson) : slug(name);
    let id = explicitId ? slug(explicitId) : `${slug(name)}-${slug(role)}`;
    let dedupe = 2;
    while (usedIds.has(id)) id = `${explicitId ? slug(explicitId) : slug(name)}-${slug(role)}-${dedupe++}`;
    usedIds.add(id);

    // Year: vazio fica vazio (A-06); preenchido e cortado em 2011-2035
    const yearRaw = num(cell(row, col.fields.year));
    const year = Number.isFinite(yearRaw) ? clampInt(yearRaw, 2011, 2035, 2011) : undefined;

    const candidate: PlayerVersion = {
      id,
      personId: personId || id,
      displayName: name,
      ...(year !== undefined ? { year } : {}),
      roles: roles.slice(0, 5),
      primaryRole: role,
      roleStrength,
      lanePhase,
      midGame,
      lateGame,
      traits: traits.slice(0, MAX_PLAYER_TRAITS),
      championPool: pool,
    };

    const parsed = PlayerVersionSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      messages.push(`Jogador inválido (${issue?.path.join(".") || "?"}: ${issue?.message || "erro"}).`);
      report.push({ row: r + 1, name, status: "error", messages });
      continue;
    }

    players.push(parsed.data);
    report.push({ row: r + 1, name, status, messages });
  }

  return { players, report, summary: summarize(report) };
}

function readRoleStrength(
  row: RawRow,
  col: ColumnIndex,
  primaryRole: Role | undefined,
  fallbackOverall = 70
): PlayerVersion["roleStrength"] {
  const keys: Record<Role, ColKey> = {
    top: "rs_top",
    jungle: "rs_jungle",
    mid: "rs_mid",
    adc: "rs_adc",
    support: "rs_support",
  };
  const rs: PlayerVersion["roleStrength"] = { top: 0, jungle: 0, mid: 0, adc: 0, support: 0 };
  let anyExplicit = false;
  for (const role of ALL_ROLES) {
    const raw = cell(row, col.fields[keys[role]]);
    if (raw) {
      rs[role] = clampInt(Number(raw), 0, 100, 0);
      anyExplicit = true;
    }
  }
  if (!anyExplicit && primaryRole) {
    const overall = clampInt(num(cell(row, col.fields.overall)), 0, 100, fallbackOverall);
    rs[primaryRole] = overall;
  }
  return rs;
}

function empty() {
  return { ok: 0, fixed: 0, warning: 0, error: 0, total: 0 };
}

function summarize(report: RowReport[]): ImportResult["summary"] {
  const s = empty();
  for (const r of report) {
    s[r.status]++;
    s.total++;
  }
  return s;
}

// ---------------------------------------------------------------------------
// ExcelJS adapter
// ---------------------------------------------------------------------------

/** ExcelJS cell value -> trimmed string (handles rich text, formulas, hyperlinks). */
function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return String(v.getFullYear());
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.text === "string") return o.text.trim();
    if (typeof o.result === "string" || typeof o.result === "number") return String(o.result).trim();
    if (Array.isArray(o.richText)) return o.richText.map((t) => (t as { text?: string }).text ?? "").join("").trim();
    if (typeof o.hyperlink === "string") return o.hyperlink.trim();
  }
  return "";
}

/** Read a worksheet into RawRow[], splitting ";"-packed single-cell rows. */
export function worksheetToRows(ws: ExcelJS.Worksheet): RawRow[] {
  const rows: RawRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[]; // 1-based; index 0 is empty
    const cells = values.slice(1).map(cellToString);
    // CSV-saved-as-xlsx: a single packed cell with ";" separators.
    if (cells.filter((c) => c !== "").length === 1) {
      const only = cells.find((c) => c !== "") ?? "";
      if (only.includes(";")) {
        rows.push(only.split(";").map((s) => s.trim()));
        return;
      }
    }
    rows.push(cells);
  });
  return rows;
}

/** Score how well a header row matches our schema (more known columns = better). */
function headerScore(cells: string[]): number {
  const col = buildColumnIndex(cells);
  return Object.keys(col.fields).length + col.champIds.length;
}

/**
 * Parse an uploaded .xlsx into validated players + report.
 *
 * A workbook may hold several sheets (the macacos file has a summary tab plus the
 * real roster tab). We do NOT trust sheet order or name: every worksheet is scored
 * by how well its best header row matches our schema, and the highest-scoring
 * sheet wins (a sheet literally named "jogadores" gets a small bonus). The header
 * row is then located within that sheet before delegating to the pure builder.
 */
export async function parseWorkbook(
  data: ArrayBuffer,
  champions: ChampionEntry[]
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  let bestRows: RawRow[] | null = null;
  let bestScore = -1;

  for (const ws of wb.worksheets) {
    const allRows = worksheetToRows(ws);
    if (allRows.length === 0) continue;
    // Best header row within the first few rows of this sheet.
    let headerIdx = -1;
    let sheetScore = -1;
    const limit = Math.min(allRows.length, 6);
    for (let i = 0; i < limit; i++) {
      const s = headerScore(allRows[i]);
      if (s > sheetScore) {
        sheetScore = s;
        headerIdx = i;
      }
    }
    if (normHeader(ws.name) === "jogadores") sheetScore += 2;
    if (sheetScore > bestScore && headerIdx >= 0) {
      bestScore = sheetScore;
      bestRows = allRows.slice(headerIdx);
    }
  }

  if (!bestRows || bestScore < 2) {
    return { players: [], report: [], summary: empty() };
  }

  return buildPlayersFromRows(bestRows, champions);
}
