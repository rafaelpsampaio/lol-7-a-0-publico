/**
 * src/components/ChaosSlider.test.tsx
 *
 * Renderizacao SSR (renderToString, sem jsdom) do slider de caos. O foco aqui
 * e o modo controlado novo (value/onChange, Fase 6 baixa prioridade da sala:
 * docs/PLANO-EXPERIENCIA-SALA.md) -- o uso do solo (sem props, preso ao
 * chaosLevelSignal global) precisa continuar exatamente como estava.
 */

import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { ChaosSlider } from "./ChaosSlider";

describe("ChaosSlider — modo controlado (value/onChange)", () => {
  it("mostra o valor recebido via prop value, nao o signal global persistido", () => {
    const html = renderToString(() => <ChaosSlider value={() => 0.6} onChange={() => {}} />);

    expect(html).toContain("Caos: 60%");
    expect(html).toContain('value="0.6"');
  });

  it("o valor 0 (extremo baixo) aparece certo -- nao cai no signal global por engano", () => {
    const html = renderToString(() => <ChaosSlider value={() => 0} onChange={() => {}} />);

    expect(html).toContain("Caos: 0%");
  });

  it('o botao "Restaurar padrao" some quando o valor controlado ja e o padrao', () => {
    const html = renderToString(() => <ChaosSlider value={() => 0.25} onChange={() => {}} />);

    expect(html).toContain("disabled");
  });
});

describe("ChaosSlider — sem props, uso do solo preservado", () => {
  it("renderiza o rotulo e um valor numerico sem quebrar (cai no chaosLevelSignal global)", () => {
    const html = renderToString(() => <ChaosSlider />);

    expect(html).toContain("Nível de caos");
    expect(html).toMatch(/Caos: \d+%/);
  });
});
