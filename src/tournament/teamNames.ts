/**
 * src/tournament/teamNames.ts
 *
 * Fictional org-style team names + short broadcast tags. Assigned deterministically
 * from the tournament seed so every team in a tournament gets a distinct identity.
 */

import { mulberry32 } from "../sim/rng";

export interface TeamIdentity {
  name: string;
  tag: string;
}

export const TEAM_NAMES: TeamIdentity[] = [
  { name: "Dragões de Cristal", tag: "DRC" },
  { name: "Fúria Carmesim", tag: "FRC" },
  { name: "Lobos do Nexus", tag: "LOB" },
  { name: "Ordem Hextech", tag: "HEX" },
  { name: "Vanguarda Celeste", tag: "VGC" },
  { name: "Sentinelas do Vazio", tag: "SDV" },
  { name: "Chamas Imortais", tag: "CHI" },
  { name: "Coroa de Ferro", tag: "CDF" },
  { name: "Tempestade Azul", tag: "TPA" },
  { name: "Legião Rúnica", tag: "LGR" },
  { name: "Presságio Negro", tag: "PSN" },
  { name: "Titãs do Abismo", tag: "TTA" },
  { name: "Garras de Jade", tag: "GDJ" },
  { name: "Eclipse Escarlate", tag: "ECE" },
  { name: "Bravura Dourada", tag: "BVD" },
  { name: "Espectros do Rift", tag: "ESR" },
];

/**
 * Deterministic distinct identities for `count` teams from a seed (Fisher–Yates
 * over a copy of TEAM_NAMES). Index 0 is conventionally the user's team.
 */
export function assignTeamIdentities(seed: number, count: number): TeamIdentity[] {
  const pool = [...TEAM_NAMES];
  const rng = mulberry32(seed >>> 0);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out: TeamIdentity[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

/** A short broadcast tag for an arbitrary display name (fallback for the user team). */
export function tagFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^(de|do|da|dos|das|e)$/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0] + (words[1][1] ?? "")).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

/**
 * Tags unicas pra um conjunto de nomes, na mesma ordem. `tagFromName` sozinha
 * pode colidir (dois nomes que comecam com as mesmas duas palavras, achado
 * do teste de sala 2026-08-27: "Time Host Final" e "Time Host Reclaim" caem
 * os dois em "THO") -- aqui, a segunda ocorrencia de uma sigla ja usada
 * troca o ultimo caractere por um contador (2, 3, ...) ate achar uma livre.
 */
export function tagsUnicos(nomes: string[]): string[] {
  const usadas = new Set<string>();
  return nomes.map((nome) => {
    const base = tagFromName(nome);
    if (!usadas.has(base)) {
      usadas.add(base);
      return base;
    }
    let n = 2;
    let alternativa = `${base.slice(0, 2)}${n}`;
    while (usadas.has(alternativa)) {
      n++;
      alternativa = `${base.slice(0, 2)}${n}`;
    }
    usadas.add(alternativa);
    return alternativa;
  });
}
