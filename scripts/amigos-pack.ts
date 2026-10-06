/**
 * scripts/amigos-pack.ts
 *
 * Logica pura da carga do pack dos amigos (spec 2026-10-02-pack-amigos-design,
 * secao 6). Sem I/O: o importar-amigos.ts le a planilha e grava o JSON.
 */

import type { RawRow } from "../src/data/packImport";
import type { PlayerVersion, Role } from "../src/data/schema";

/** Nome de cada pessoa na carta (A-08). Chave = personId ja em minusculas. */
export const NOMES: Record<string, string> = {
  adabo: "Adabo",
  baguio: "Baguio",
  ber: "Ber",
  cap: "Cap",
  delqueen: "Delqueen",
  dias: "Dias",
  guga: "Guga",
  guiba: "Guiba",
  gului: "Iago Lui",
  hayashi: "Hayashi",
  iago: "Iago",
  jogi: "Jogi",
  jose: "Jose",
  junao: "Junão",
  leite: "Igor",
  louis: "Louis",
  luan50: "Luan",
  luisinho: "Luisinho",
  oadamo: "Adamo",
  paulino: "Paulino",
  pepe: "Pepe",
  pipo: "Pipo",
  quibao: "Quibao",
  rafa: "Rafa",
  raguto: "Raguto",
  raidenchups: "Igão",
  rosinha: "Rosinha",
  snow: "Snow",
  titcher: "Titcher",
  valdir: "Valdir",
  xina: "Xina",
  zbu: "Zbu",
};

const ROTA: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "Adc",
  support: "Sup",
};

/**
 * As 3 correcoes combinadas com o dono do produto, na linha crua (antes do
 * importador). Falha alto se alguma nao acontecer exatamente uma vez: sinal de
 * que a planilha mudou e a correcao precisa ser revista.
 */
export function corrigirLinhas(rows: RawRow[]): RawRow[] {
  const header = rows[0]!.map((c) => c.trim().toLowerCase());
  const col = (nome: string): number => {
    const i = header.indexOf(nome);
    if (i < 0) throw new Error(`Coluna "${nome}" nao encontrada na planilha.`);
    return i;
  };
  const ID = col("id");
  const ANO = col("year");
  const feitas = { louis: 0, rafa: 0, junao: 0 };

  const out = rows.map((r, i) => {
    if (i === 0) return r;
    const row = [...r];
    // id repetido: a linha de 2026 do Louis ganha id proprio
    if (row[ID] === "louis_sup_2017" && row[ANO] === "2026") {
      row[ID] = "louis_sup_2026";
      feitas.louis++;
    }
    // o ano 2018 e o certo; o id dizia 2019
    if (row[ID] === "rafa_top_2019") {
      row[ID] = "rafa_top_2018";
      feitas.rafa++;
    }
    // braum aparece 2x no pool do Junao Sup: o segundo vira nautilus nota 1
    if (row[ID] === "junao_sup") {
      let braums = 0;
      for (let n = 1; n <= 8; n++) {
        const c = col(`champ${n}_id`);
        if ((row[c] ?? "").trim().toLowerCase() === "braum" && ++braums === 2) {
          row[c] = "nautilus";
          row[col(`champ${n}_mastery`)] = "1";
          feitas.junao++;
        }
      }
    }
    return row;
  });

  for (const [nome, n] of Object.entries(feitas)) {
    if (n !== 1) {
      throw new Error(`Correcao "${nome}" aconteceu ${n} vez(es), esperado 1. A planilha mudou?`);
    }
  }
  return out;
}

/**
 * Nome da carta (A-08) e forca da rota principal (A-07). Falha alto em pessoa
 * sem nome na tabela e em duas cartas da mesma pessoa na mesma rota sem ano
 * (o nome sairia repetido).
 */
export function finalizarCartas(players: PlayerVersion[]): PlayerVersion[] {
  const porPessoaRota = new Map<string, number>();
  for (const p of players) {
    const k = `${p.personId}|${p.primaryRole}`;
    porPessoaRota.set(k, (porPessoaRota.get(k) ?? 0) + 1);
  }

  return players.map((p) => {
    const nome = NOMES[p.personId];
    if (nome === undefined) {
      throw new Error(`Sem nome para a pessoa "${p.personId}" (${p.id}). Acrescente em NOMES.`);
    }
    const repete = (porPessoaRota.get(`${p.personId}|${p.primaryRole}`) ?? 0) > 1;
    if (repete && p.year === undefined) {
      throw new Error(`${p.id}: a pessoa tem 2 cartas de ${p.primaryRole}, e esta nao tem ano para diferenciar o nome.`);
    }
    const displayName = repete
      ? `${nome} ${ROTA[p.primaryRole]} ${p.year}`
      : `${nome} ${ROTA[p.primaryRole]}`;

    const roleStrength = { ...p.roleStrength };
    roleStrength[p.primaryRole] = Math.round((p.lanePhase + p.midGame + p.lateGame) / 3);

    return { ...p, displayName, roleStrength };
  });
}
