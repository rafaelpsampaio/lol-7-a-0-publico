/**
 * src/room/quandoMudar.test.ts
 *
 * A suite roda o Solid em modo SSR (vitest.config.ts: solidPlugin({ ssr: true })),
 * onde createEffect nunca executa. Por isso o teste importa o nucleo reativo
 * do CLIENTE (solid-js/dist/solid.js, exportado pelo pacote) e o injeta em
 * quandoMudar -- e o unico jeito de provar que o efeito NAO dispara.
 */

import { describe, it, expect, beforeAll } from "vitest";
import type * as SolidTipos from "solid-js";
import { quandoMudar } from "./quandoMudar";

let solid: typeof SolidTipos;

beforeAll(async () => {
  const caminho = "solid-js/dist/solid.js";
  solid = (await import(/* @vite-ignore */ caminho)) as typeof SolidTipos;
});

describe("quandoMudar", () => {
  it("o efeito ingenuo (o bug) dispara a cada roomState, mesmo com a serie igual", () => {
    const vistas: string[] = [];
    let setEstado!: (v: { watching: { eu: string } }) => void;
    const dispose = solid.createRoot((d) => {
      const [estado, s] = solid.createSignal({ watching: { eu: "UB_QF_1" } });
      setEstado = s;
      solid.createEffect(() => {
        vistas.push(estado().watching.eu);
      });
      return d;
    });
    setEstado({ watching: { eu: "UB_QF_1" } });
    expect(vistas).toEqual(["UB_QF_1", "UB_QF_1"]);
    dispose();
  });

  it("nao dispara quando chega um roomState novo com a mesma serie", () => {
    const chamadas: string[] = [];
    let setEstado!: (v: { watching: { eu: string } }) => void;
    const dispose = solid.createRoot((d) => {
      const [estado, s] = solid.createSignal({ watching: { eu: "UB_QF_1" } });
      setEstado = s;
      quandoMudar(() => estado().watching.eu, (v) => chamadas.push(v), solid);
      return d;
    });
    setEstado({ watching: { eu: "UB_QF_1" } });
    setEstado({ watching: { eu: "UB_QF_1" } });
    expect(chamadas).toEqual([]);
    setEstado({ watching: { eu: "UB_SF_1" } });
    expect(chamadas).toEqual(["UB_SF_1"]);
    dispose();
  });

  it("com um objeto como chave, dispara a cada objeto novo daquele sinal (timeline reenviada)", () => {
    const chamadas: number[] = [];
    let setGames!: (v: { n: number } | null) => void;
    let setEstado!: (v: { x: number }) => void;
    const dispose = solid.createRoot((d) => {
      const [games, sg] = solid.createSignal<{ n: number } | null>({ n: 0 });
      const [, se] = solid.createSignal({ x: 0 });
      setGames = sg;
      setEstado = se;
      quandoMudar(games, (g) => chamadas.push(g?.n ?? -1), solid);
      return d;
    });
    setEstado({ x: 1 }); // outro sinal mudou: nada
    expect(chamadas).toEqual([]);
    setGames({ n: 0 }); // mesma serie reenviada = objeto novo: dispara
    expect(chamadas).toEqual([0]);
    dispose();
  });

  it("nao dispara na criacao (defer)", () => {
    const chamadas: string[] = [];
    const dispose = solid.createRoot((d) => {
      const [estado] = solid.createSignal("UB_QF_1");
      quandoMudar(estado, (v) => chamadas.push(v), solid);
      return d;
    });
    expect(chamadas).toEqual([]);
    dispose();
  });
});
