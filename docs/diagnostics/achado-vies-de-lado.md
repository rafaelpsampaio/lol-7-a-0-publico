# Achado: viés de lado em confronto espelhado

**Data:** 2026-07-29
**Descoberto durante:** Fase 24 (sistema de assistência), a partir da linha de sanidade de neutralidade do `scripts/calibrate-assists.ts`
**Status:** medido e confirmado, **sem dono declarado no roadmap v2.2**
**Não corrigido nesta fase, deliberadamente.** Ver "Por que não foi corrigido aqui".

---

## O sintoma

Num confronto perfeitamente espelhado (fixture flat, overall 75 dos dois lados, o mesmo mapa de campeões nos dois lados), o lado `user` vence mais do que 50%.

| Cenário | N | Win-rate do lado `user` | Desvio de 50% |
|---|---|---|---|
| Sem campeão atribuído | 4.000 | **54,7%** (IC95 ±1,5) | +6,1 sigma |
| Com campeões simétricos (carries) | 3.000 | **57,8%** (IC95 ±1,8) | +8,6 sigma |

Não é ruído amostral. Com 3.000 a 4.000 partidas o intervalo de confiança é da ordem de ±1,5 ponto percentual, e o efeito é de 5 a 8 pontos.

## A causa

O viés **não** está no poder acumulado. Medido em 4.000 partidas espelhadas, as quantidades agregadas são simétricas até quase o dígito:

```
kills             user 43,98    rival 43,74
ouro              user 46.466   rival 46.464
```

Uma diferença de ouro de 2 em 46.466 (0,004%) exclui vantagem sistemática de economia ou de combate.

O viés está em **quem chega primeiro**. Separando as partidas pelo tipo de desfecho:

| Desfecho | N | Win-rate do lado `user` |
|---|---|---|
| Terminou por nexo | 2.876 | **56,0%** (IC95 ±1,8) |
| Bateu no teto de 60 min | 1.124 (28,1%) | **51,3%** (IC95 ±2,9) |

As partidas decididas por tempo são estatisticamente neutras. Todo o viés vive nas partidas decididas por corrida ao nexo.

O mecanismo é a ordem fixa de iteração de lado:

- `src/sim/engine.ts:377`
- `src/sim/engine.ts:399`
- `src/sim/engine.ts:614`
- `src/sim/laneState.ts:254`

```typescript
for (const side of ["user", "rival"] as Side[]) {
```

O lado `user` é sempre avaliado primeiro dentro do mesmo tick. Quando os dois times ficam aptos a fechar a partida no mesmo tick, o `user` fecha. Em confronto espelhado essa corrida acontece com frequência suficiente para produzir 56% nas partidas por nexo.

A atribuição de campeões amplifica o efeito (54,7% para 57,8%) porque aumenta o volume de eventos por partida, e mais eventos significam mais oportunidades de corrida no mesmo tick.

## Por que nenhum gate pegou isso

O invariante **INV-2 (identidade em neutro)** verifica que um fixture flat produz **delta de poder zero**. Ele mede a coisa certa e passa corretamente: o delta de ouro é 2 em 46.466.

O viés não está no poder, está no desempate temporal. Nenhum gate do projeto compara o desfecho dos dois lados sob simetria total, e nenhum invariante declarado cobre ordem de resolução dentro do tick.

A linha que expôs isso é a "linha de sanidade de neutralidade" do `scripts/calibrate-assists.ts`, criada na Fase 24 por outro motivo (confirmar que os conjuntos de campeões eram simétricos).

## Por que não foi corrigido aqui

Mudar a ordem de iteração de lado altera a ordem de consumo de `rng()`, o que viola a parte de **ORDEM** do INV-1 e reescreve o golden inteiro, não apenas alguns valores. É exatamente a classe de mudança que a convenção do projeto exige que tenha fase própria, com regeneração deliberada e diff estruturado.

Corrigir junto com o sistema de assistência também contaminaria a atribuição causal da Fase 24, que é o motivo declarado de essa fase ser isolada.

## Direções possíveis para quem pegar

Nenhuma foi testada. Ordenadas por custo crescente de golden:

1. **Alternar a ordem por tick** (par/ímpar), o que zera o viés na média sem introduzir draw novo.
2. **Alternar a ordem por partida**, derivando o lado inicial de um bit da seed. Mais barato de raciocinar, mas não elimina o viés dentro de uma partida.
3. **Resolver o tick em duas fases** (coletar intenções dos dois lados, depois aplicar), que é a correção estruturalmente certa e a mais cara.

Vale medir antes qual fração dos desfechos por nexo é de fato uma corrida no mesmo tick. Se for pequena, o efeito pode vir de outro ponto da ordem de avaliação e as três direções acima erram o alvo.

## Como reproduzir

As sondas usadas ficaram em `tmp/probe-sidebias.test.ts` e `tmp/probe-sidebias2.test.ts` (diretório ignorado pelo git). Elas copiam o builder de fixture flat de `scripts/calibrate-assists.ts:71-89` e rodam com `npx vitest run -c tmp/vitest.probe.config.ts`.

A linha de sanidade permanente vive no relatório de `npm run calibrate:assists`, um bloco por conjunto:

```
win-rate lado user: 57.9% (linha de sanidade de neutralidade: conjunto simetrico deve ficar perto de 50%)
```
