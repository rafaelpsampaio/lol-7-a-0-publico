/**
 * scripts/update-golden.ts
 *
 * Regeneracao DELIBERADA dos snapshots golden-seed (DET-13).
 *
 * Run: npm run update-golden
 *
 * AVISOS IMPORTANTES:
 *  - NUNCA execute como parte do `npm test` normal. O script `test` em
 *    package.json NAO pode conter --update-snapshots.
 *  - Apos rodar este script, OBRIGATORIAMENTE commitar os snapshots atualizados
 *    em um commit ISOLADO com mensagem explicita, ex:
 *      git commit -m "test(snapshot): regenerar golden-seed apos drift deliberado de modelo"
 *  - A regeneracao e um ato de decisao consciente, nao um efeito colateral.
 *    Se os snapshots divergem em `npm test`, investigate a causa do drift ANTES
 *    de regenerar.
 *
 * Por que existe este arquivo:
 *  - O npm script `update-golden` invoca o vitest diretamente (sem tsx),
 *    pois tsx nao e devDependency do projeto.
 *  - Este arquivo .ts serve como documentacao explicita do proposito e dos
 *    avisos (DET-13). Pode ser executado via `npx tsx scripts/update-golden.ts`
 *    se tsx estiver disponivel no ambiente.
 */

import { execSync } from "child_process";

console.log("=== update-golden: regeneracao DELIBERADA dos snapshots golden-seed ===");
console.log("Aviso: este ato exige commit isolado com mensagem explicita (DET-13).");
console.log("");

execSync(
  "npx vitest run src/__tests__/golden/golden.test.ts --update",
  { stdio: "inherit" }
);

console.log("");
console.log("=== update-golden concluido. Commite os snapshots atualizados isoladamente. ===");
