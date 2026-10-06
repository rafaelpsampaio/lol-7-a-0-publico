/**
 * scripts/calibrate-all.mjs
 *
 * Encadeador dos gates de calibracao da milestone v2.2 (Fase 23 / INST-01, DEC-01).
 * Executar: npm run calibrate:all
 *
 * Roda, em sequencia e SEM curto-circuito, os sete gates de calibracao do projeto:
 *   calibrate, calibrate:micro, calibrate:structures, calibrate:objectives,
 *   calibrate:combat, calibrate:pace, calibrate:assists.
 *
 * Por que sem curto-circuito: `npm run calibrate` termina vermelho hoje (assert
 * real em calibrate-engine.ts:157, dono Fase 28). Uma cadeia de `&&` pararia no
 * primeiro vermelho e nunca chegaria a rodar `calibrate:pace`, que e o gate novo
 * da milestone inteira (INST-03/05/08). Este runner roda todos, coleta o codigo
 * de saida de cada um e imprime um resumo pt-BR ao final, sem nunca esconder o
 * desfecho de um gate atras do vermelho de outro.
 *
 * Invariantes nao negociaveis:
 *   - Lista de nomes de script fixa neste arquivo, sem entrada externa (sem
 *     superficie de injecao de comando -- T-23-18)
 *   - Nenhum gate e pulado por causa do vermelho de outro (T-23-17)
 *   - Sai com codigo diferente de zero se qualquer gate falhou, para que o
 *     comando continue servindo de gate de fase quando a milestone fechar
 *   - Sem o caractere travessao na saida
 */

import { spawnSync } from "node:child_process";

/** Ordem fixa dos sete gates. Nenhum nome vem de argv nem de arquivo externo. */
const GATES = [
  "calibrate",
  "calibrate:micro",
  "calibrate:structures",
  "calibrate:objectives",
  "calibrate:combat",
  "calibrate:pace",
  "calibrate:assists",
];

/** @type {{ name: string, exitCode: number }[]} */
const results = [];

for (const gate of GATES) {
  console.log(`\n${"=".repeat(79)}`);
  console.log(`>>> Rodando gate: npm run ${gate}`);
  console.log("=".repeat(79));

  // shell:true e necessario no Windows para invocar npm (arquivo .cmd, nao um
  // executavel nativo reconhecido por CreateProcess sem o shell). Sem risco de
  // injecao: `gate` vem exclusivamente do array GATES fixo acima, nunca de argv
  // nem de arquivo externo (T-23-18).
  const res = spawnSync("npm", ["run", gate], {
    stdio: "inherit",
    shell: true,
  });

  // spawnSync devolve status=null quando o processo morre por sinal (nunca por
  // timeout: cada config de vitest declara testTimeout, convencao registrada em
  // scripts/README.md). Tratamos null como falha (codigo 1) para nunca deixar
  // um gate sem desfecho no resumo.
  const exitCode = res.status ?? 1;
  results.push({ name: gate, exitCode });
}

// ---------------------------------------------------------------------------
// Resumo pt-BR
// ---------------------------------------------------------------------------

console.log(`\n${"=".repeat(79)}`);
console.log("RESUMO DE calibrate:all");
console.log("=".repeat(79));

let greenCount = 0;
for (const r of results) {
  const status = r.exitCode === 0 ? "verde" : "vermelho";
  if (r.exitCode === 0) greenCount++;
  console.log(`  ${r.name.padEnd(24)} ${status.padEnd(10)} (codigo de saida: ${r.exitCode})`);
}

console.log(`\n${greenCount} de ${GATES.length} gates verdes`);

console.log(
  "\nNOTA DE LEITURA: vermelho por assercao e o estado ESPERADO ao fim da Fase 23." +
    "\ncalibrate:pace foi escrito de proposito com as bandas alvo da milestone" +
    "\ninteira (DEC-02), e o relatorio de cada banda vermelha traz a fase dona do" +
    "\nconserto. Nenhum gate deste resumo termina por estouro de tempo: cada config" +
    "\nde vitest declara testTimeout, conforme a convencao registrada em" +
    "\nscripts/README.md." +
    "\n\ncalibrate:assists e o setimo gate, da Fase 24 (AST-01 e AST-02): e o unico" +
    "\nque roda com campeoes atribuidos e reprova por elegibilidade estrutural de" +
    "\nrota. Ele TAMBEM nasce vermelho de proposito e continua vermelho ate o Plano" +
    "\n24-02 corrigir o motor: hoje quatro rotas terminam em zero absoluto de" +
    "\nassistencias no conjunto controlado de campeoes."
);

const anyFailed = results.some((r) => r.exitCode !== 0);
process.exit(anyFailed ? 1 : 0);
