import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { IconeDeRota, Icone } from "./Icones";
import { Modal } from "./Modal";

describe("icones (E-12)", () => {
  it("cada rota desenha um svg proprio", () => {
    const top = renderToString(() => <IconeDeRota rota="top" />);
    const adc = renderToString(() => <IconeDeRota rota="adc" />);
    expect(top).toContain("<svg");
    expect(top).not.toBe(adc);
  });

  it("icone de interface respeita o tamanho", () => {
    expect(renderToString(() => <Icone nome="camera" tamanho={16} />)).toContain('width="16"');
  });
});

describe("Modal", () => {
  it("titulo, corpo e acoes", () => {
    const html = renderToString(() => (
      <Modal titulo="Sair sem salvar?" acoes={[{ rotulo: "Continuar editando", onClick: () => undefined }, { rotulo: "Sair", tipo: "perigo", onClick: () => undefined }]}>
        <p>Corpo</p>
      </Modal>
    ));
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Sair sem salvar?");
    expect(html).toContain("pk-btn--perigo");
  });
});
