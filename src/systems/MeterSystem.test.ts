import { describe, expect, it } from 'vitest';
import { createInitialState, startGame } from '../game/GameState';
import { ECONOMY, GCSF, METER } from '../game/Balance';
import { checkEnd, stepMeters } from './MeterSystem';

function fresh() {
  const s = createInitialState(1);
  startGame(s);
  return s;
}

describe('stepMeters', () => {
  it('uses the stronger delayed hematotoxicity pressure profile', () => {
    expect(METER.hematotoxicityExposure).toEqual({ crs: 0.26, hyperinflammation: 0.45, burden: 0.16 });
    expect(METER.hematotoxicityRecoveryWave).toBe(0.02);
    expect(METER.hematotoxicityRecoveryPlanning).toBe(0.25);
    expect(METER.hematotoxicityFitnessThreshold).toBe(50);
    expect(METER.hematotoxicityFitnessDrainMax).toBe(0.5);
  });
  it('accrues passive income', () => {
    const s = fresh();
    const c0 = s.currency;
    stepMeters(s, 2);
    expect(s.currency).toBeCloseTo(c0 + 2);
  });

  it('CRS decays faster during planning than during a wave', () => {
    const a = fresh();
    a.meters.crs = 50;
    stepMeters(a, 1); // planning
    expect(a.meters.crs).toBeCloseTo(47);

    const b = fresh();
    b.subPhase = 'wave';
    b.meters.crs = 50;
    stepMeters(b, 1);
    expect(b.meters.crs).toBeCloseTo(48.9);
  });

  it('neurotoxicity builds during waves and decays during planning', () => {
    const a = fresh();
    a.meters.neuro = 50;
    stepMeters(a, 1); // planning
    expect(a.meters.neuro).toBeCloseTo(48.5);

    const b = fresh();
    b.subPhase = 'wave';
    b.meters.neuro = 50;
    stepMeters(b, 1);
    expect(b.meters.neuro).toBeCloseTo(50.35);
  });

  it('tracks peak stats', () => {
    const s = fresh();
    s.meters.crs = 70;
    s.meters.fitness = 55;
    stepMeters(s, 0); // peaks sample post-decay values, so use dt 0
    expect(s.stats.peakCrs).toBeCloseTo(70);
    expect(s.stats.lowestFitness).toBeCloseTo(55);
  });

  it('releases latent injury after inflammation and allows hematotoxicity to keep rising', () => {
    const s = fresh();
    s.meters.hematotoxicity = 20;
    s.hematotoxicityLoad = 10;
    stepMeters(s, 1);
    expect(s.meters.hematotoxicity).toBeCloseTo(20 + 1.2 - METER.hematotoxicityRecoveryPlanning);
    expect(s.hematotoxicityLoad).toBeCloseTo(8.8);
  });

  it('CRS, IEC-HS, and burden accumulate latent hematotoxicity exposure', () => {
    const s = fresh();
    s.subPhase = 'wave';
    s.meters.crs = 80;
    s.meters.hyperinflammation = 60;
    s.meters.burden = 50;
    stepMeters(s, 1);
    expect(s.hematotoxicityLoad).toBeGreaterThan(0);
  });

  it('tier-two Memory cells improve planning hematotoxicity recovery with a cap', () => {
    const s = fresh();
    s.meters.hematotoxicity = 50;
    s.towers = [0, 1, 2].map((id) => ({
      id, type: 'memory' as const, x: 0, y: 0, tier: 2 as const, cd: 0,
      targetId: null, strength: 1, wavesSurvived: 0, buffPower: 0,
    }));
    stepMeters(s, 1);
    expect(s.meters.hematotoxicity).toBeCloseTo(
      50 - METER.hematotoxicityRecoveryPlanning - ECONOMY.memoryHematotoxicityCap,
    );
  });

  it('models IEC-HS independently of falling CRS and derives its trajectory', () => {
    const s = fresh();
    s.subPhase = 'wave';
    s.iecHsActive = true;
    s.meters.crs = 50;
    s.meters.hyperinflammation = 40;
    stepMeters(s, 1);
    expect(s.meters.crs).toBeLessThan(50);
    expect(s.meters.hyperinflammation).toBeGreaterThan(40);
    expect(s.hyperinflammationTrend).toBeGreaterThan(0);
    expect(s.hematotoxicityLoad).toBeGreaterThan(0);
  });

  it('high hematotoxicity impairs fitness but Stem-Cell recovery prevents that drain', () => {
    const untreated = fresh();
    const recovering = fresh();
    for (const s of [untreated, recovering]) {
      s.subPhase = 'wave';
      s.meters.hematotoxicity = 100;
      s.meters.fitness = 80;
    }
    recovering.stemCellRecoveryUntil = 10;
    stepMeters(untreated, 1);
    stepMeters(recovering, 1);
    expect(recovering.meters.fitness).toBeGreaterThan(untreated.meters.fitness);
    expect(recovering.meters.hematotoxicity).toBeLessThan(untreated.meters.hematotoxicity);
  });

  it('G-CSF provides partial fitness protection without stopping latent exposure', () => {
    const untreated = fresh();
    const supported = fresh();
    for (const s of [untreated, supported]) {
      s.subPhase = 'wave';
      s.meters.hematotoxicity = 80;
      s.meters.fitness = 80;
      s.hematotoxicityLoad = 8;
    }
    supported.gcsfUntil = GCSF.duration;
    stepMeters(untreated, 1);
    stepMeters(supported, 1);
    expect(supported.meters.fitness).toBeGreaterThan(untreated.meters.fitness);
    expect(supported.meters.fitness).toBeLessThan(80);
    expect(supported.meters.hematotoxicity).toBeLessThan(untreated.meters.hematotoxicity);
    expect(supported.hematotoxicityLoad).toBeGreaterThan(0);
  });
});

describe('checkEnd', () => {
  it('returns null for a healthy mid-game state', () => {
    expect(checkEnd(fresh())).toBeNull();
  });

  it('loses from acute toxicities or fitness, but not hematotoxicity directly', () => {
    const s = fresh();
    s.meters.crs = 100;
    expect(checkEnd(s)).toBe('lost');

    const a = fresh();
    a.meters.neuro = 100;
    expect(checkEnd(a)).toBe('lost');

    const b = fresh();
    b.meters.fitness = 0;
    expect(checkEnd(b)).toBe('lost');

    const c = fresh();
    c.meters.hematotoxicity = 100;
    expect(checkEnd(c)).toBeNull();

    const d = fresh();
    d.meters.burden = 100;
    expect(checkEnd(d)).toBeNull();

    const e = fresh();
    e.meters.hyperinflammation = 100;
    expect(checkEnd(e)).toBe('lost');
  });

  it('wins only after the final wave', () => {
    const s = fresh();
    s.wave = 11;
    expect(checkEnd(s)).toBe('won');

    const a = fresh();
    a.stats.burdenPeak = 40;
    a.meters.burden = 0;
    expect(checkEnd(a)).toBeNull();
  });
});
