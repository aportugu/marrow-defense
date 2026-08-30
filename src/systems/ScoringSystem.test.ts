import { describe, expect, it } from 'vitest';
import { createInitialState, startGame } from '../game/GameState';
import { SCORING } from '../game/Balance';
import { computeScore, responseForScore } from './ScoringSystem';
import { LEVELS } from '../data/levels';

function fresh() {
  const s = createInitialState('marrow', 1);
  startGame(s);
  return s;
}

describe('ScoringSystem', () => {
  it('is deterministic for identical states', () => {
    const s = fresh();
    s.stats.kills = 12;
    const a = computeScore(s);
    const b = computeScore(s);
    expect(a.score).toBe(b.score);
    expect(a.response).toEqual(b.response);
    expect(a.parts).toEqual(b.parts);
  });

  it('caps kills and currency contributions', () => {
    const s = fresh();
    s.stats.kills = 999;
    s.currency = 9999;
    const r = computeScore(s);
    expect(r.parts.kills).toBe(SCORING.weights.kills);
    expect(r.parts.currency).toBe(SCORING.weights.currency);
  });

  it('uses the hepatic level kill target instead of the marrow cap', () => {
    const s = createInitialState('liver', 1);
    startGame(s);
    s.stats.kills = LEVELS.liver.scoreKillTarget;
    expect(computeScore(s).parts.kills).toBe(SCORING.weights.kills);
  });

  it('rewards leak-free precision instead of ability usage', () => {
    const clean = fresh();
    const leaky = fresh();
    clean.stats.tociUses = 3;
    leaky.stats.escapes = 5;
    expect(computeScore(clean).parts.precision).toBeGreaterThan(computeScore(leaky).parts.precision);
  });

  it('scores hematotoxicity control from both peak and final burden', () => {
    const s = fresh();
    s.meters.hematotoxicity = 50;
    s.stats.peakHematotoxicity = 80;
    expect(computeScore(s).parts.hematotoxicity).toBe(
      Math.round((1 - (50 * 0.6 + 80 * 0.4) / 100) * SCORING.weights.hematotoxicity),
    );
  });

  it('maps every score boundary to an IMWG-inspired response category', () => {
    const cases = [
      [1000, 'sCR'], [850, 'sCR'], [849, 'CR'], [750, 'CR'],
      [749, 'VGPR'], [625, 'VGPR'], [624, 'PR'], [450, 'PR'],
      [449, 'SD'], [250, 'SD'], [249, 'PD'], [0, 'PD'],
    ] as const;
    for (const [score, response] of cases) expect(responseForScore(score).id).toBe(response);
  });

  it('awards sCR for an excellent run', () => {
    const s = fresh();
    s.meters = { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0, hyperinflammation: 0, cnsBurden: 0 };
    s.stats.peakCrs = 0;
    s.stats.lowestFitness = 100;
    s.stats.kills = 60;
    s.stats.time = 100;
    s.currency = 400;
    const r = computeScore(s);
    expect(r.score).toBeGreaterThanOrEqual(SCORING.responses[0][0]);
    expect(r.response.id).toBe('sCR');
    expect(r.response.fullName).toBe('Stringent complete response');
  });

  it('caps a high-scoring non-progression loss at SD', () => {
    const s = fresh();
    s.meters = { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0, hyperinflammation: 0, cnsBurden: 0 };
    s.stats.peakCrs = 0;
    s.stats.lowestFitness = 100;
    s.stats.kills = 60;
    s.stats.time = 100;
    s.currency = 400;
    s.phase = 'lost';
    expect(computeScore(s).response.id).toBe('SD');
  });

  it('assigns PD when the hepatic core escapes regardless of score', () => {
    const s = fresh();
    s.meters = { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0, hyperinflammation: 0, cnsBurden: 0 };
    s.stats.peakCrs = 0;
    s.stats.lowestFitness = 100;
    s.stats.kills = 999;
    s.stats.time = 100;
    s.currency = 400;
    s.phase = 'lost';
    s.bossEscaped = true;
    expect(computeScore(s).response.id).toBe('PD');
  });

  it('scores a collapsed body at zero', () => {
    const s = fresh();
    s.meters = { burden: 100, crs: 100, neuro: 100, fitness: 0, hematotoxicity: 100, hyperinflammation: 100, cnsBurden: 100 };
    s.stats.peakHematotoxicity = 100;
    s.stats.peakCrs = 100;
    s.stats.peakNeuro = 100;
    s.stats.lowestFitness = 0;
    s.stats.kills = 0;
    s.stats.time = 720;
    s.currency = 0;
    const r = computeScore(s);
    expect(r.score).toBe(0);
    expect(r.response.id).toBe('PD');
  });
});
