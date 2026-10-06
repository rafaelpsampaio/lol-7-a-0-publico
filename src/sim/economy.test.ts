import { describe, it, expect } from "vitest";
import {
  splitEvenly, creditPlayer, creditTeamSplit, killGoldFor, earnBounty, settleVictimBounty, plateGold,
  passiveGoldPerMinute, expectedPassiveGold, laningFarmFactor, objectiveBountyGold,
  KILL_GOLD, FIRST_BLOOD_GOLD, MIN_KILL_GOLD, SHUTDOWN_MIN_BOUNTY, BOUNTY_PAYOUT_CAP,
} from "./economy";
import { DEFAULT_REALISM_TUNING, resolveTuning } from "./tuning";

/**
 * `shutdownGold` e o espelho do bounty (min(700, bounty) a partir de 150, senao 0). Quem testa
 * o que acontece depois de morrer passa o valor coerente com o bounty de partida, para a
 * assercao de depois nao ser vacuamente verdadeira sobre um campo que ja comecava em zero.
 */
const bountyHolder = (bounty: number, shutdownGold = 0) => ({ bounty, shutdownGold });

function team() {
  const mk = () => ({ gold: 500 });
  return { gold: 2500, players: { top: mk(), jungle: mk(), mid: mk(), adc: mk(), support: mk() } };
}

describe("economy", () => {
  it("splitEvenly reparte sem perder ouro e com diferenca maxima de 1", () => {
    expect(splitEvenly(150, 2)).toEqual([75, 75]);
    expect(splitEvenly(250, 3)).toEqual([84, 83, 83]);
    expect(splitEvenly(0, 5)).toEqual([0, 0, 0, 0, 0]);
    expect(splitEvenly(10, 0)).toEqual([]);
  });

  it("ouro do time e sempre a soma do ouro dos jogadores", () => {
    const t = team();
    creditPlayer(t, t.players.adc, 300);
    creditTeamSplit(t, 250);
    const soma = Object.values(t.players).reduce((s, p) => s + p.gold, 0);
    expect(t.gold).toBe(soma);
    expect(t.gold).toBe(2500 + 300 + 250);
  });

  it("abate vale 300, first blood 400, e o bounty entra ate 700", () => {
    expect(killGoldFor(bountyHolder(0), false)).toBe(KILL_GOLD);
    expect(killGoldFor(bountyHolder(0), true)).toBe(FIRST_BLOOD_GOLD);
    expect(killGoldFor(bountyHolder(400), false)).toBe(700);
    expect(killGoldFor(bountyHolder(2000), false)).toBe(KILL_GOLD + BOUNTY_PAYOUT_CAP);
  });

  it("bounty negativo derruba o abate ate o piso de 100", () => {
    expect(killGoldFor(bountyHolder(-120), false)).toBe(180);
    expect(killGoldFor(bountyHolder(-200), false)).toBe(MIN_KILL_GOLD);
  });

  it("earnBounty acumula 1 a cada 4 de ouro e liga o shutdown a partir de 150", () => {
    const p = bountyHolder(0);
    earnBounty(p, 300);
    expect(p.bounty).toBe(75);
    expect(p.shutdownGold).toBe(0);
    earnBounty(p, 300);
    expect(p.bounty).toBe(150);
    expect(p.shutdownGold).toBe(SHUTDOWN_MIN_BOUNTY);
  });

  it("morrer zera o bounty positivo e o shutdown junto", () => {
    const a = bountyHolder(400, 400);
    expect(a.shutdownGold).toBe(400); // precondicao: o shutdown estava ligado
    settleVictimBounty(a, 1050);
    expect(a.bounty).toBe(0);
    expect(a.shutdownGold).toBe(0);
  });

  it("morrer com bounty de 1000 paga 700 e guarda 300, com shutdown de 300 na proxima vida", () => {
    const b = bountyHolder(1000, BOUNTY_PAYOUT_CAP);
    settleVictimBounty(b, 1500);
    expect(b.bounty).toBe(300);
    expect(b.shutdownGold).toBe(300);
  });

  it("o excedente guardado abaixo de 150 nao liga shutdown; acima de 700 o shutdown e limitado a 700", () => {
    const pouco = bountyHolder(800, BOUNTY_PAYOUT_CAP);
    settleVictimBounty(pouco, 1500);
    expect(pouco.bounty).toBe(100);
    expect(pouco.shutdownGold).toBe(0);
    const muito = bountyHolder(1700, BOUNTY_PAYOUT_CAP);
    settleVictimBounty(muito, 1500);
    expect(muito.bounty).toBe(1000);
    expect(muito.shutdownGold).toBe(BOUNTY_PAYOUT_CAP);
  });

  it("morrer sem bounty positivo reduz 1 a cada 4 de ouro entregue, com piso -200", () => {
    const p = bountyHolder(0);
    settleVictimBounty(p, 450);
    expect(p.bounty).toBe(-113);
    settleVictimBounty(p, 450);
    expect(p.bounty).toBe(-200);
  });

  it("farm passivo cresce com o tempo, com a rota ganha e com o laning", () => {
    const t = DEFAULT_REALISM_TUNING;
    const cedo = passiveGoldPerMinute("mid", 5, 75, 0, t);
    const tarde = passiveGoldPerMinute("mid", 25, 75, 0, t);
    expect(tarde).toBeGreaterThan(cedo);
    expect(passiveGoldPerMinute("mid", 10, 75, 60, t)).toBeGreaterThan(passiveGoldPerMinute("mid", 10, 75, -60, t));
    expect(passiveGoldPerMinute("adc", 10, 75, 0, t)).toBeGreaterThan(passiveGoldPerMinute("support", 10, 75, 0, t));
    expect(laningFarmFactor(75)).toBe(1);
  });

  it("ouro esperado por rota e a integral do farm passivo mais o ouro inicial", () => {
    const t = DEFAULT_REALISM_TUNING;
    expect(expectedPassiveGold("top", 0, 75, t)).toBe(500);
    const aos10 = expectedPassiveGold("top", 10, 75, t);
    const integral = t.passiveBasePerMin * 10 + (t.passiveSlopePerMin * 100) / 2;
    expect(aos10).toBe(Math.round(500 + integral));
  });

  it("resolveTuning completa o parcial com os valores padrao", () => {
    const r = resolveTuning({ passiveBasePerMin: 1 });
    expect(r.passiveBasePerMin).toBe(1);
    expect(r.passiveSlopePerMin).toBe(DEFAULT_REALISM_TUNING.passiveSlopePerMin);
    expect(resolveTuning(undefined)).toEqual(DEFAULT_REALISM_TUNING);
  });
});

describe("recompensa de objetivo (comeback)", () => {
  const t = { ...DEFAULT_REALISM_TUNING, objectiveBountyMinDeficit: 1500, objectiveBountyFraction: 0.25, objectiveBountyCap: 2500 };
  it("nao paga para quem esta na frente ou atras por pouco", () => {
    expect(objectiveBountyGold(30000, 29000, 0.25, t)).toBe(0);
    expect(objectiveBountyGold(30000, 31000, 0.25, t)).toBe(0);
  });
  it("paga fracao do deficit, com teto, escalada pelo caos", () => {
    expect(objectiveBountyGold(30000, 34000, 0.25, t)).toBe(1000);
    expect(objectiveBountyGold(30000, 50000, 0.25, t)).toBe(2500);
    expect(objectiveBountyGold(30000, 34000, 0.5, t)).toBe(2000);
    expect(objectiveBountyGold(30000, 34000, 0, t)).toBe(0);
  });
});

describe("ouro de placa (patch 26)", () => {
  it("120 ate 11:00, menos 10 por minuto completo depois, piso 80 a partir de 15:00", () => {
    expect(plateGold(0)).toBe(120);
    expect(plateGold(659)).toBe(120);
    expect(plateGold(719)).toBe(120);
    expect(plateGold(720)).toBe(110);
    expect(plateGold(899)).toBe(90);
    expect(plateGold(900)).toBe(80);
    expect(plateGold(3000)).toBe(80);
  });
});
