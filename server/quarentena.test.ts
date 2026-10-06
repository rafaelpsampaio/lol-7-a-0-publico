/**
 * server/quarentena.test.ts
 *
 * A metade pesada da quarentena (D-15/D-04), que ate a revisao final so se
 * sustentava por disciplina: `server/protocol.ts` NUNCA pode alcancar
 * `server/engine/tournament.ts` -- nem direto, nem por tres arquivos de
 * distancia.
 *
 * O motivo e concreto: o protocolo tambem roda no navegador (todo o cliente da
 * sala importa tipos e schemas dele), e a metade pesada arrasta a engine de
 * simulacao inteira -- `src/tournament/bracket`, `src/tournament/series`,
 * `src/sim/engine` e os vinte e poucos modulos de simulacao pendurados neles.
 * O `npm run build` nao da sinal nenhum: `src/sim/**` ja entra no bundle por
 * `App.tsx`, entao arrasta-lo por um segundo caminho nao quebra nada -- so
 * engorda o bundle em silencio, e o silencio e exatamente o problema.
 *
 * Cada revisor conferiu isto a mao e todos confirmaram; teste nenhum existia.
 * Este arquivo e a rede. Ele segue a cadeia de imports pelo texto-fonte (nao
 * precisa bundlar nada) e reprova se ela chegar na metade pesada ou em qualquer
 * modulo `node:` -- builtin de Node num arquivo que roda no navegador e a
 * mesma familia de erro.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const RAIZ = process.cwd();

/** A metade pesada: o portal do servidor para a engine de simulacao. */
const METADE_PESADA = "server/engine/tournament.ts";

/**
 * O que a metade pesada existe para carregar. Alcancar qualquer um destes por
 * um segundo caminho faz o MESMO estrago que alcancar o portal, entao a rede
 * cobre os dois -- senao bastaria importar `src/tournament/series` direto para
 * a regra continuar "cumprida" e o bundle crescer igual.
 */
const O_QUE_ELA_ARRASTA = ["src/tournament/bracket.ts", "src/tournament/series.ts", "src/sim/engine.ts"];

/**
 * Todo literal de caminho depois de `from` ou `import` -- estatico, dinamico
 * (`import("...")`), de tipo inline e `export ... from`. Procura o LITERAL,
 * nao a sintaxe do import, pela mesma razao da varredura de
 * src/room/contract.test.tsx: aspas simples e `import()` atravessam qualquer
 * regex que exija a palavra "from".
 */
function especificadoresDe(fonte: string): string[] {
  const saida: string[] = [];
  for (const m of fonte.matchAll(/(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g)) saida.push(m[2]!);
  return saida;
}

/** Resolve um caminho relativo como o bundler resolveria (extensao implicita). */
function resolverModulo(deDir: string, spec: string): string | null {
  const base = resolve(deDir, spec);
  for (const tentativa of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(tentativa) && statSync(tentativa).isFile()) return tentativa;
  }
  return null;
}

interface Fecho {
  /** Todo arquivo alcancavel a partir da entrada, em caminho relativo a raiz. */
  arquivos: string[];
  /** Todo especificador nao-relativo visto pelo caminho ("zod", "node:fs", ...). */
  externos: string[];
}

/** Fecho transitivo de imports a partir de um arquivo, seguindo o texto-fonte. */
function alcancadosPor(entrada: string): Fecho {
  const vistos = new Set<string>();
  const externos = new Set<string>();
  const naoResolvidos: string[] = [];

  const anda = (arquivo: string): void => {
    if (vistos.has(arquivo)) return;
    vistos.add(arquivo);
    for (const spec of especificadoresDe(readFileSync(arquivo, "utf8"))) {
      if (!spec.startsWith(".")) {
        externos.add(spec);
        continue;
      }
      const alvo = resolverModulo(dirname(arquivo), spec);
      if (alvo === null) naoResolvidos.push(`${arquivo} -> ${spec}`);
      else anda(alvo);
    }
  };
  anda(resolve(RAIZ, entrada));

  // Um import relativo que nao resolve seria um buraco na rede: a cadeia
  // simplesmente pararia ali e a varredura passaria por ignorancia.
  expect(naoResolvidos, "import relativo que a varredura nao soube seguir").toEqual([]);

  return {
    arquivos: [...vistos].map((f) => relative(RAIZ, f).split("\\").join("/")).sort(),
    externos: [...externos].sort(),
  };
}

describe("quarentena: server/protocol.ts nao alcanca a metade pesada (D-15)", () => {
  it("nem direto, nem transitivamente", () => {
    const fecho = alcancadosPor("server/protocol.ts");
    expect(fecho.arquivos).not.toContain(METADE_PESADA);
  });

  it("nem por um segundo caminho ate o que ela arrasta", () => {
    const fecho = alcancadosPor("server/protocol.ts");
    for (const pesado of O_QUE_ELA_ARRASTA) {
      expect(fecho.arquivos, `protocol.ts alcanca ${pesado}`).not.toContain(pesado);
    }
  });

  it("nem um modulo node: -- o protocolo tambem roda no navegador", () => {
    const fecho = alcancadosPor("server/protocol.ts");
    const builtins = fecho.externos.filter((e) => e.startsWith("node:"));
    expect(builtins).toEqual([]);
  });
});

describe("quarentena: o editor de pacotes nao alcanca a metade pesada (D-04)", () => {
  it("server/pacotes/handler.ts fica fora da engine de simulacao", () => {
    const fecho = alcancadosPor("server/pacotes/handler.ts");
    expect(fecho.arquivos).not.toContain(METADE_PESADA);
    for (const pesado of O_QUE_ELA_ARRASTA) {
      expect(fecho.arquivos, `handler alcanca ${pesado}`).not.toContain(pesado);
    }
  });
});

describe("a varredura acha de verdade -- contraprova, para a rede nao passar em vacuo", () => {
  // Sem estes dois, um erro na resolucao de caminhos (ou uma regex que nao
  // casa com nada) deixaria os testes acima verdes para sempre, provando
  // apenas que a varredura nao enxerga nada.
  it("partindo do hub, que PODE usar a engine, a metade pesada aparece", () => {
    const fecho = alcancadosPor("server/room/hub.ts");
    expect(fecho.arquivos).toContain(METADE_PESADA);
    // E, com ela, a engine de simulacao que o protocolo nao pode arrastar.
    expect(fecho.arquivos).toContain("src/sim/engine.ts");
  });

  it("partindo da persistencia, que PODE usar o disco, os builtins aparecem", () => {
    const fecho = alcancadosPor("server/room/persistence.ts");
    expect(fecho.externos.filter((e) => e.startsWith("node:"))).not.toEqual([]);
  });

  it("pega o caminho, nao a sintaxe do import", () => {
    expect(especificadoresDe(`import { X } from '../proibido';`)).toContain("../proibido");
    expect(especificadoresDe(`const x = await import("../proibido");`)).toContain("../proibido");
    expect(especificadoresDe(`type F = import("../proibido").Bar;`)).toContain("../proibido");
    expect(especificadoresDe(`export { X } from "../proibido";`)).toContain("../proibido");
  });
});
