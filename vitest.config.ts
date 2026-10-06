import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin({ ssr: true })],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/*.test.ts", "server/**/*.test.ts"],
    // Convencao registrada na Fase 23 (INST-01, scripts/README.md secao 2):
    // todo config declara testTimeout. Este arquivo tinha ficado de fora.
    //
    // Sem esta linha o vitest usa o default de 5000 ms, e varios testes de
    // simulacao pesada rodam perto disso. Sob carga (por exemplo com outro
    // processo simulando em paralelo) eles estouram de forma NAO
    // DETERMINISTICA: medido em arvore limpa, 3 vermelhos numa rodada e 2 na
    // seguinte, com conjuntos diferentes, todos "Test timed out in 5000ms" e
    // nenhum por assercao. Um vermelho por tempo se confunde com um vermelho
    // por regressao, que e o modo de falha que a Fase 23 existiu para eliminar.
    //
    // 60 s e folga larga contra um piso de 17 s de suite inteira. Se algum dia
    // um teste realmente travar, 60 s ainda falha rapido.
    testTimeout: 60_000,
  },
});
