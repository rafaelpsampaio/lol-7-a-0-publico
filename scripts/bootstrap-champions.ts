/**
 * scripts/bootstrap-champions.ts
 *
 * One-time offline script: fetches Riot Data Dragon champion.json, derives
 * champion traits via the deterministic D-02 rule, and writes
 * public/champions.json (committed to repo — no runtime network calls, INTG-02).
 *
 * Run: node --experimental-strip-types scripts/bootstrap-champions.ts
 *
 * The committed public/champions.json is the runtime asset. Network access is
 * only required at dev/bootstrap time. Trait derivation is fully deterministic
 * from each champion's Data Dragon `tags` + `info`, per RESEARCH.md
 * "Data Dragon → Champion Trait Derivation".
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA_DRAGON_URL =
  "https://ddragon.leagueoflegends.com/cdn/16.13.1/data/en_US/champion.json";

/** The five champion-trait values (mirror of ChampionTraitSchema in src/data/schema.ts). */
type ChampionTrait =
  | "high_first_blood"
  | "objective_control"
  | "late_scaling"
  | "early_dominant"
  | "teamfight";

/**
 * Deterministic trait derivation (D-02). Rules are applied in priority order;
 * duplicates are removed and the result is capped at 2 traits by rule priority.
 *
 * Rule 1: Assassin                                  → high_first_blood
 * Rule 2: Tank OR (Fighter AND defense >= 6)        → objective_control
 * Rule 3: (Marksman|Mage) AND (attack>=7 OR magic>=7) → late_scaling
 * Rule 4: attack >= 8 AND NOT Assassin              → early_dominant
 * Rule 5: Fighter AND defense >= 5 AND attack >= 6  → teamfight
 * Rule 6: Support AND defense >= 5                  → objective_control
 */
function deriveTraits(
  tags: string[],
  info: Record<string, number>
): ChampionTrait[] {
  const has = (tag: string) => tags.includes(tag);
  const attack = info.attack ?? 0;
  const defense = info.defense ?? 0;
  const magic = info.magic ?? 0;

  const ordered: ChampionTrait[] = [];

  // Rule 1
  if (has("Assassin")) ordered.push("high_first_blood");
  // Rule 2
  if (has("Tank") || (has("Fighter") && defense >= 6))
    ordered.push("objective_control");
  // Rule 3
  if ((has("Marksman") || has("Mage")) && (attack >= 7 || magic >= 7))
    ordered.push("late_scaling");
  // Rule 4
  if (attack >= 8 && !has("Assassin")) ordered.push("early_dominant");
  // Rule 5
  if (has("Fighter") && defense >= 5 && attack >= 6) ordered.push("teamfight");
  // Rule 6
  if (has("Support") && defense >= 5) ordered.push("objective_control");

  // De-duplicate (preserve priority order) then cap at 2.
  const deduped = [...new Set(ordered)];
  return deduped.slice(0, 2);
}

/**
 * Normalize a Data Dragon PascalCase id (e.g. "LeeSin", "JarvanIV",
 * "MonkeyKing") to lowercase-kebab-case so IDs align with the existing
 * players.json championId format (RESEARCH open-question 1, Pitfall 7).
 *
 * Examples: "Aatrox" → "aatrox", "LeeSin" → "lee-sin",
 *           "JarvanIV" → "jarvan-iv", "MonkeyKing" → "monkey-king",
 *           "KSante" → "k-sante".
 */
function normalizeId(ddId: string): string {
  return ddId
    // insert a hyphen between a lowercase/digit and an uppercase letter
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    // insert a hyphen between consecutive uppercase letters followed by lowercase
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const DATA_DRAGON_IMG_BASE =
  "https://ddragon.leagueoflegends.com/cdn/16.13.1/img/champion";

interface DataDragonChampion {
  id: string;
  name: string;
  tags: string[];
  info: Record<string, number>;
  image: { full: string };
}

async function main(): Promise<void> {
  const resp = await fetch(DATA_DRAGON_URL);
  if (!resp.ok) {
    throw new Error(`Data Dragon fetch failed: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as { data: Record<string, DataDragonChampion> };

  const champions = Object.values(data.data).map((champ) => ({
    id: normalizeId(champ.id),
    name: champ.name,
    traits: deriveTraits(champ.tags, champ.info),
    image: champ.image.full,
  }));

  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const outputPath = join(rootDir, "public/champions.json");
  writeFileSync(outputPath, JSON.stringify({ champions }, null, 2) + "\n");
  console.log(`Wrote ${champions.length} champions to public/champions.json`);

  // Download square PNGs into public/champions/ (dev-time only; INTG-02).
  const championsDir = join(rootDir, "public/champions");
  mkdirSync(championsDir, { recursive: true });
  console.log(`Downloading ${champions.length} champion square images…`);
  let downloaded = 0;
  let failed = 0;
  for (const champ of champions) {
    const url = `${DATA_DRAGON_IMG_BASE}/${champ.image}`;
    const destPath = join(championsDir, champ.image);
    try {
      const imgResp = await fetch(url);
      if (!imgResp.ok) {
        console.warn(`  SKIP ${champ.image}: HTTP ${imgResp.status}`);
        failed++;
        continue;
      }
      const bytes = await imgResp.arrayBuffer();
      writeFileSync(destPath, Buffer.from(bytes));
      downloaded++;
    } catch (err) {
      // WR-06: narrow the caught value safely — a thrown non-Error (string,
      // DOMException from an aborted fetch, etc.) would otherwise log
      // "undefined". Mirrors the App.tsx pattern.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  SKIP ${champ.image}: ${msg}`);
      failed++;
    }
  }
  console.log(
    `Downloaded ${downloaded} images to public/champions/ (${failed} failed/skipped).`
  );

  // WR-06: a degraded bootstrap (many missing PNGs) must fail loudly rather
  // than exit 0 and surface later as missing runtime portraits. Allow a small
  // tolerance (5%) for transient single-image hiccups.
  if (champions.length > 0 && failed > champions.length * 0.05) {
    console.error(
      `Too many image failures (${failed}/${champions.length}). Bootstrap considered degraded.`
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
