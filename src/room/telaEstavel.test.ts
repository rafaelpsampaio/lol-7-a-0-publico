/**
 * src/room/telaEstavel.test.ts
 *
 * Mesmo motivo de quandoMudar.test.ts: a suite roda o Solid em modo SSR, onde
 * a reatividade nao e exercitada. O teste importa o nucleo reativo do CLIENTE
 * (solid-js/dist/solid.js) e o injeta em telaEstavel.
 */

import { describe, it, expect, beforeAll } from "vitest";
import type * as SolidTipos from "solid-js";
import { telaEstavel } from "./telaEstavel";

let solid: typeof SolidTipos;

beforeAll(async () => {
  const caminho = "solid-js/dist/solid.js";
  solid = (await import(/* @vite-ignore */ caminho)) as typeof SolidTipos;
});

describe("telaEstavel", () => {
  it("o jeito antigo (memo lendo o estado inteiro) redesenha a cada roomState -- o bug", () => {
    const desenhos: string[] = [];
    let setEstado!: (v: { fase: string; n: number }) => void;
    let tela!: () => string;
    const dispose = solid.createRoot((d) => {
      const [estado, s] = solid.createSignal({ fase: "lobby", n: 0 });
      setEstado = s;
      tela = solid.createMemo(() => {
        const f = estado().fase;
        desenhos.push(f);
        return f;
      });
      return d;
    });
    setEstado({ fase: "lobby", n: 1 });
    tela();
    expect(desenhos).toEqual(["lobby", "lobby"]);
    dispose();
  });

  it("so redesenha quando a chave muda, nao a cada objeto novo do estado", () => {
    const desenhos: string[] = [];
    let setEstado!: (v: { fase: string; n: number }) => void;
    let tela!: () => unknown;
    const dispose = solid.createRoot((d) => {
      const [estado, s] = solid.createSignal({ fase: "lobby", n: 0 });
      setEstado = s;
      tela = telaEstavel(
        () => estado().fase,
        (f) => {
          desenhos.push(f);
          return { f };
        },
        solid
      );
      return d;
    });
    tela();
    expect(desenhos).toEqual(["lobby"]);
    setEstado({ fase: "lobby", n: 1 });
    setEstado({ fase: "lobby", n: 2 });
    tela();
    expect(desenhos).toEqual(["lobby"]);
    setEstado({ fase: "draft", n: 3 });
    tela();
    expect(desenhos).toEqual(["lobby", "draft"]);
    dispose();
  });

  it("devolve a MESMA tela enquanto a chave nao muda", () => {
    let setEstado!: (v: { fase: string; n: number }) => void;
    let tela!: () => unknown;
    const dispose = solid.createRoot((d) => {
      const [estado, s] = solid.createSignal({ fase: "watch", n: 0 });
      setEstado = s;
      tela = telaEstavel(() => estado().fase, (f) => ({ f }), solid);
      return d;
    });
    const antes = tela();
    setEstado({ fase: "watch", n: 1 });
    expect(tela()).toBe(antes);
    dispose();
  });

  it("o que a tela le ao ser desenhada nao vira dependencia da escolha", () => {
    const desenhos: number[] = [];
    let setOutro!: (v: number) => void;
    let tela!: () => unknown;
    const dispose = solid.createRoot((d) => {
      const [outro, so] = solid.createSignal(0);
      setOutro = so;
      tela = telaEstavel(
        () => "watch",
        () => {
          desenhos.push(outro());
          return null;
        },
        solid
      );
      return d;
    });
    tela();
    setOutro(1);
    tela();
    expect(desenhos).toEqual([0]);
    dispose();
  });
});
