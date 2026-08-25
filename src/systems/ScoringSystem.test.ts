import { describe, expect, it } from 'vitest';
import { createInitialState, startGame } from '../game/GameState';
import { SCORING } from '../game/Balance';
import { computeScore } from './ScoringSystem';

function fresh() {
  const s = createInitialState(1);
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
    expect(a.grade).toBe(b.grade);
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

  it('awards S for an excellent run', () => {
    const s = fresh();
    s.meters = { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0, hyperinflammation: 0 };
    s.stats.peakCrs = 0;
    s.stats.lowestFitness = 100;
    s.stats.kills = 60;
    s.stats.time = 100;
    s.currency = 400;
    const r = computeScore(s);
    expect(r.score).toBeGreaterThanOrEqual(SCORING.grades[0][0]);
    expect(r.grade).toBe('S');
  });

  it('demotes high scores to C when the run was lost', () => {
    const s = fresh();
    s.meters = { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0, hyperinflammation: 0 };
    s.stats.peakCrs = 0;
    s.stats.lowestFitness = 100;
    s.stats.kills = 60;
    s.stats.time = 100;
    s.currency = 400;
    s.phase = 'lost';
    expect(computeScore(s).grade).toBe('C');
  });

  it('scores a collapsed body at zero', () => {
    const s = fresh();
    s.meters = { burden: 100, crs: 100, neuro: 100, fitness: 0, hematotoxicity: 100, hyperinflammation: 100 };
    s.stats.peakHematotoxicity = 100;
    s.stats.peakCrs = 100;
    s.stats.peakNeuro = 100;
    s.stats.lowestFitness = 0;
    s.stats.kills = 0;
    s.stats.time = 720;
    s.currency = 0;
    const r = computeScore(s);
    expect(r.score).toBe(0);
    expect(r.grade).toBe('C');
  });
});
