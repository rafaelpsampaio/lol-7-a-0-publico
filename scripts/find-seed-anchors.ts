/**
 * Sweep de seeds-ancora para os 8 sintomas (Fase 16 / Plano 04).
 * Executar uma vez para coletar seeds; resultado vai para docs/ENGINE-DIAGNOSIS.md.
 * NAO e parte do harness de calibracao principal.
 */

import { describe, it } from "vitest";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { simulateMatch } from "../src/sim/engine";
import { mulberry32 } from "../src/sim/rng";
import { ROLES } from "../src/sim/matchState";
import type { PlayerVersion, Role } from "../src/data/schema";

// ---------------------------------------------------------------------------
// Rosters sinteticos flat
// ---------------------------------------------------------------------------

function makePlayer(id: string, role: Role, stat: number): PlayerVersion {
  return {
    id,
    personId: id,
    displayName: `${id} 2024`,
    year: 2024,
    roles: [role],
    primaryRole: role,
    roleStrength: { top: 0, jungle: 0, mid: 0, adc: 0, support: 0, [role]: stat },
    lanePhase: stat,
    midGame: stat,
    lateGame: stat,
    traits: [],
    championPool: Array.from({ length: 8 }, (_, i) => ({
      championId: `c${i}`,
      mastery: 3 as const,
    })),
  } as unknown as PlayerVersion;
}

function roster(prefix: string, stat: number): PlayerVersion[] {
  return ROLES.map((r) => makePlayer(`${prefix}-${r}`, r as Role, stat));
}

// ---------------------------------------------------------------------------
// Rosters reais
// ---------------------------------------------------------------------------

const _rawPlayers = JSON.parse(
  readFileSync(join(process.cwd(), "public/players.json"), "utf8")
);
const allPlayers: PlayerVersion[] = _rawPlayers.players;

function findPlayer(id: string): PlayerVersion {
  const p = allPlayers.find((p) => p.id === id);
  if (!p) throw new Error(`Player nao encontrado: ${id}`);
  return p;
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

describe("seed-anchors", () => {
  it("encontra seeds-ancora para os 8 sintomas", () => {
    const results: Record<string, { seed: number; tier: string; timeSec?: number; detail: string } | null> = {
      s1_torre_cedo: null,
      s2_quadra_cedo: null,
      s3_herald_nexus: null,
      s4_progressao_errada: null,
      s5_baron_spawn: null,
      s6_ticker_role_generica: null,
      s7_shutdown_spam: null,
      s8_gumayusi: null,
    };

    // Sintomas 1, 2, 3, 4, 5, 6, 7: sweep nos 3 tiers
    const tiers = [
      { name: "STOMP 85v55", us: 85, rs: 55 },
      { name: "GAP-LEVE 72v68", us: 72, rs: 68 },
      { name: "EQUILIBRADO 70v70", us: 70, rs: 70 },
    ];

    for (const tier of tiers) {
      for (let seed = 0; seed < 200; seed++) {
        const res = simulateMatch(roster("u", tier.us), roster("r", tier.rs), mulberry32(seed));

        for (const ev of res.timeline) {
          const t = ev.timeSec;

          // Sintoma 1: torre antes de 45s
          if (
            !results.s1_torre_cedo &&
            (ev.kind === "tower_destroyed" || ev.kind === "first_tower") &&
            t < 45
          ) {
            results.s1_torre_cedo = {
              seed,
              tier: tier.name,
              timeSec: t,
              detail: `kind=${ev.kind} t=${t}s ticker="${ev.ticker}"`,
            };
          }

          // Sintoma 2: quadra_kill antes de 8min (480s)
          if (!results.s2_quadra_cedo && ev.kind === "quadra_kill" && t < 480) {
            results.s2_quadra_cedo = {
              seed,
              tier: tier.name,
              timeSec: t,
              detail: `kind=${ev.kind} t=${t}s (${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}) ticker="${ev.ticker}"`,
            };
          }

          // Sintoma 3: herald uso + proxima estrutura cai em < 20min (proxy para nexusTurret)
          if (!results.s3_herald_nexus && ev.kind === "herald_used" && t < 1245) {
            results.s3_herald_nexus = {
              seed,
              tier: tier.name,
              timeSec: t,
              detail: `herald_used t=${t}s (${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}) ticker="${ev.ticker}"`,
            };
          }

          // Sintoma 4: primeira torre antes de 7:00 (progressao errada = plate -> tower sem chip)
          if (!results.s4_progressao_errada && t < 420 &&
            (ev.kind === "tower_destroyed" || ev.kind === "first_tower")) {
            results.s4_progressao_errada = {
              seed,
              tier: tier.name,
              timeSec: t,
              detail: `kind=${ev.kind} t=${t}s (${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}) - sem chip/plate previo na timeline`,
            };
          }

          // Sintoma 5: baron tomado exatamente no spawn (timeSec === 1200)
          if (!results.s5_baron_spawn && (ev.kind === "baron_taken" || ev.kind === "baron_steal") && t === 1200) {
            results.s5_baron_spawn = {
              seed,
              tier: tier.name,
              timeSec: t,
              detail: `kind=${ev.kind} t=${t}s (20:00 exatos) ticker="${ev.ticker}"`,
            };
          }

          // Sintoma 6: ticker contextual com role generica (ctx_*)
          const GENERIC_ROLES = ["mid", "top", "adc", "support", "jungle", "jungler", "ADC", "Support", "Top", "Mid", "Jungle"];
          if (!results.s6_ticker_role_generica && ev.kind.startsWith("ctx_")) {
            const hasGeneric = GENERIC_ROLES.some((r) => ev.ticker.includes(r));
            if (hasGeneric) {
              results.s6_ticker_role_generica = {
                seed,
                tier: tier.name,
                timeSec: t,
                detail: `kind=${ev.kind} ticker="${ev.ticker}"`,
              };
            }
          }

          // Sintoma 7: shutdown spam - detectar ao acumular; registra o primeiro caso
          // (verificado via contagem no mesmo timeSec no pos-processamento abaixo)
        }

        // Sintoma 7: contar shutdowns por (timeSec, side, lane)
        // Chavear so por timeSec conflataria shutdowns de lados/lanes diferentes no
        // mesmo segundo (dois eventos nao relacionados), nao a patologia de "varios
        // shutdowns de um unico teamfight". A chave composta isola o caso real.
        if (!results.s7_shutdown_spam) {
          const shutdownMap = new Map<string, number>();
          for (const ev of res.timeline) {
            if (ev.kind === "shutdown") {
              const key = `${ev.timeSec}|${ev.side ?? "null"}|${ev.lane ?? "null"}`;
              shutdownMap.set(key, (shutdownMap.get(key) ?? 0) + 1);
            }
          }
          for (const [key, count] of shutdownMap) {
            if (count >= 2) {
              const [tStr, side, lane] = key.split("|");
              const t = Number(tStr);
              results.s7_shutdown_spam = {
                seed,
                tier: tier.name,
                timeSec: t,
                detail: `${count} shutdown(s) no mesmo timeSec=${t}s (${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}) side=${side} lane=${lane}`,
              };
              break;
            }
          }
        }

        // Early exit: se todos os sintomas 1-7 foram encontrados, parar o sweep
        const found = Object.entries(results)
          .filter(([k]) => k !== "s8_gumayusi")
          .every(([, v]) => v !== null);
        if (found) break;
      }
      // Early exit por tier
      const found = Object.entries(results)
        .filter(([k]) => k !== "s8_gumayusi")
        .every(([, v]) => v !== null);
      if (found) break;
    }

    // Sintoma 8: Gumayusi vs Gumayusi - sweep proposital (fixture especifico do RESEARCH.md)
    try {
      const gumayusi = findPlayer("gumayusi-2022");
      const userRosterSym: PlayerVersion[] = [
        findPlayer("zeus-2022"),
        findPlayer("canyon-2021"),
        findPlayer("faker-2016"),
        gumayusi,
        findPlayer("keria-2021"),
      ];
      const rivalRosterSym: PlayerVersion[] = [
        findPlayer("bin-2021"),
        findPlayer("oner-2022"),
        findPlayer("showmaker-2020"),
        gumayusi, // MESMO CARD - reproduz o sintoma
        findPlayer("beryl-2021"),
      ];

      for (let seed = 0; seed < 20; seed++) {
        const res = simulateMatch(userRosterSym, rivalRosterSym, mulberry32(seed));
        for (const ev of res.timeline) {
          const actorBase = ev.actors[0]?.split(" ")[0];
          const victimBase = ev.victims[0]?.split(" ")[0];
          if (actorBase && victimBase && actorBase === victimBase) {
            results.s8_gumayusi = {
              seed,
              tier: "PROPOSITAL (real roster)",
              timeSec: ev.timeSec,
              detail: `kind=${ev.kind} t=${ev.timeSec}s actors=[${ev.actors[0]}] victims=[${ev.victims[0]}] ticker="${ev.ticker}"`,
            };
            break;
          }
        }
        if (results.s8_gumayusi) break;
      }
    } catch (err) {
      // Nao silenciar: registrar a causa real (ex.: id ausente em players.json).
      // results.s8_gumayusi permanece null, mas agora o motivo fica visivel.
      console.warn(`Sintoma 8 ignorado: ${(err as Error).message}`);
    }

    // Relatorio
    let report = "\n=== SEED-ANCORAS DOS 8 SINTOMAS ===\n\n";
    for (const [key, val] of Object.entries(results)) {
      if (val) {
        report += `${key}: seed=${val.seed} tier="${val.tier}" timeSec=${val.timeSec ?? "n/a"}\n`;
        report += `  detalhe: ${val.detail}\n\n`;
      } else {
        report += `${key}: NAO ENCONTRADO no sweep (fallback: evidencia por distribuicao agregada)\n\n`;
      }
    }

    mkdirSync("tmp", { recursive: true });
    writeFileSync("tmp/seed-anchors.txt", report, "utf8");
    console.log(report);

    // Nao fazer assert duro - apenas relatorio (o baseline quebrado nao falha o build)
  });
});
