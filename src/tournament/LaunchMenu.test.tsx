import { describe, it, expect } from "vitest";
import { renderToString } from "solid-js/web";
import { LaunchMenu } from "./LaunchMenu";

function menu(pacoteAtivo: string) {
  return renderToString(() => (
    <LaunchMenu
      existingSave={null}
      onContinue={() => {}}
      onNewTournament={() => {}}
      pacotes={[
        { id: "pros", nome: "Pros / Mundial" },
        { id: "amigos", nome: "Amigos" },
      ]}
      pacoteAtivo={pacoteAtivo}
      onTrocarPacote={() => {}}
      canStart={true}
      blockReason=""
    />
  ));
}

describe("seletor de pacote do solo", () => {
  it("a opcao do pacote ativo sai selecionada, mesmo com a lista chegando depois", () => {
    const html = menu("amigos");
    expect(html).toMatch(/<option[^>]*value="amigos"[^>]*selected|<option[^>]*selected[^>]*value="amigos"/);
    expect(html).not.toMatch(/<option[^>]*value="pros"[^>]*selected|<option[^>]*selected[^>]*value="pros"/);
  });
});
