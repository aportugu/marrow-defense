import { describe, expect, it } from 'vitest';
import { createInitialState, startGame } from '../game/GameState';
import { ABILITY, DEXA, GCSF, IEC_HS, STEMCELL, TOCI } from '../game/Balance';
import { stepMeters } from './MeterSystem';
import { activate, canActivate, stepAbilities } from './AbilitySystem';

function fresh() {
  const s = createInitialState(1);
  startGame(s);
  return s;
}

describe('AbilitySystem', () => {
  it('TOCI drops CRS, costs funding and goes on cooldown', () => {
    const s = fresh();
    s.currency = 200;
    s.meters.crs = 80;
    expect(canActivate(s, 'toci')).toBe(true);
    activate(s, 'toci');
    expect(s.meters.crs).toBeCloseTo(80 - TOCI.crsDrop);
    expect(s.currency).toBeCloseTo(200 - ABILITY.toci.cost);
    expect(s.abilities.toci.cooldown).toBeCloseTo(ABILITY.toci.cooldown);
    expect(s.stats.tociUses).toBe(1);
    expect(canActivate(s, 'toci')).toBe(false);
    stepAbilities(s, ABILITY.toci.cooldown + 0.5);
    expect(canActivate(s, 'toci')).toBe(true);
  });

  it('DEXA cuts neurotoxicity, pauses CRS, slows attacks and costs fitness', () => {
    const s = fresh();
    s.currency = 200;
    s.meters.neuro = 90;
    const t0 = s.stats.time;
    activate(s, 'dexa');
    expect(s.meters.neuro).toBeCloseTo(90 - DEXA.neuroDrop);
    expect(s.meters.fitness).toBeCloseTo(100 - DEXA.fitnessHit);
    expect(s.crsSuppressedUntil).toBeCloseTo(t0 + DEXA.suppressFor);
    expect(s.dexaUntil).toBeCloseTo(t0 + DEXA.slowFor);
    expect(s.stats.dexaUses).toBe(1);
    expect(s.abilities.dexa.cooldown).toBeCloseTo(ABILITY.dexa.cooldown);
  });

  it('DEXA also reduces and suppresses active IEC-HS', () => {
    const s = fresh();
    s.currency = 200;
    s.iecHsActive = true;
    s.iecHsUnlocked = true;
    s.meters.hyperinflammation = 60;
    activate(s, 'dexa');
    expect(s.meters.hyperinflammation).toBe(60 - IEC_HS.dexaDrop);
    expect(s.iecHsDexaUntil).toBe(s.stats.time + IEC_HS.dexaDuration);
  });

  it('unlocks Anakinra only for IEC-HS and changes trajectory without an instant drop', () => {
    const s = fresh();
    expect(canActivate(s, 'anakinra')).toBe(false);
    s.iecHsActive = true;
    s.iecHsUnlocked = true;
    s.subPhase = 'wave';
    s.meters.hyperinflammation = 55;
    const before = s.meters.hyperinflammation;
    activate(s, 'anakinra');
    expect(s.meters.hyperinflammation).toBe(before);
    stepMeters(s, 1);
    expect(s.meters.hyperinflammation).toBeLessThan(before);
    expect(s.stats.anakinraUses).toBe(1);
  });

  it('keeps Tocilizumab specific to CRS during IEC-HS', () => {
    const s = fresh();
    s.currency = 200;
    s.iecHsActive = true;
    s.meters.crs = 80;
    s.meters.hyperinflammation = 55;
    activate(s, 'toci');
    expect(s.meters.crs).toBe(40);
    expect(s.meters.hyperinflammation).toBe(55);
  });

  it('stem-cell boost requires hematotoxicity and starts timed recovery without an instant drop', () => {
    const s = fresh();
    s.currency = 300;
    expect(canActivate(s, 'stemcell')).toBe(false);
    s.meters.hematotoxicity = 40;
    s.meters.fitness = 80;
    expect(canActivate(s, 'stemcell')).toBe(true);
    activate(s, 'stemcell');
    expect(s.abilities.stemcell.used).toBe(true);
    expect(s.meters.hematotoxicity).toBe(40);
    expect(s.meters.fitness).toBe(80);
    expect(s.stemCellRecoveryUntil).toBe(s.stats.time + STEMCELL.duration);
    stepMeters(s, 1);
    expect(s.meters.hematotoxicity).toBeLessThan(40);
    expect(canActivate(s, 'stemcell')).toBe(false);
  });

  it('abilities require their funding cost', () => {
    const s = fresh();
    s.currency = 10;
    s.meters.hematotoxicity = 40;
    expect(canActivate(s, 'toci')).toBe(false);
    expect(canActivate(s, 'dexa')).toBe(false);
    expect(canActivate(s, 'stemcell')).toBe(false);
  });

  it('Stem-Cell recovery lasts 15 seconds and does not block latent exposure', () => {
    const s = fresh();
    s.currency = 300;
    s.meters.hematotoxicity = 50;
    s.hematotoxicityLoad = 10;
    activate(s, 'stemcell');
    for (let i = 0; i < 300; i++) stepMeters(s, 0.05);
    expect(s.stats.time).toBeCloseTo(STEMCELL.duration);
    expect(s.hematotoxicityLoad).toBeGreaterThan(0);
    expect(s.meters.hematotoxicity).toBeLessThan(50);
  });

  it('G-CSF is repeatable, threshold-gated, and provides immediate plus timed recovery', () => {
    const s = fresh();
    s.currency = 300;
    s.meters.hematotoxicity = GCSF.minHematotoxicity - 1;
    expect(canActivate(s, 'gcsf')).toBe(false);
    s.meters.hematotoxicity = 50;
    s.hematotoxicityLoad = 10;
    const before = s.meters.hematotoxicity;
    activate(s, 'gcsf');
    expect(s.currency).toBe(300 - ABILITY.gcsf.cost);
    expect(s.meters.hematotoxicity).toBe(before - GCSF.hematotoxicityDrop);
    expect(s.gcsfUntil).toBe(s.stats.time + GCSF.duration);
    expect(s.abilities.gcsf.cooldown).toBe(ABILITY.gcsf.cooldown);
    expect(s.stats.gcsfUses).toBe(1);
    for (let i = 0; i < GCSF.duration * 20; i++) stepMeters(s, 0.05);
    expect(s.meters.hematotoxicity).toBeLessThan(before - GCSF.hematotoxicityDrop);
    expect(s.hematotoxicityLoad).toBeGreaterThan(0);
    expect(canActivate(s, 'gcsf')).toBe(false);
    stepAbilities(s, ABILITY.gcsf.cooldown);
    stepMeters(s, 0.1);
    s.meters.hematotoxicity = 40;
    expect(canActivate(s, 'gcsf')).toBe(true);
  });

  it('does not allow G-CSF and Stem-Cell recovery to overlap', () => {
    const stemFirst = fresh();
    stemFirst.currency = 300;
    stemFirst.meters.hematotoxicity = 50;
    activate(stemFirst, 'stemcell');
    expect(canActivate(stemFirst, 'gcsf')).toBe(false);

    const gcsfFirst = fresh();
    gcsfFirst.currency = 300;
    gcsfFirst.meters.hematotoxicity = 50;
    activate(gcsfFirst, 'gcsf');
    expect(canActivate(gcsfFirst, 'stemcell')).toBe(false);
  });

  it('stepAbilities ticks cooldowns down', () => {
    const s = fresh();
    s.currency = 500;
    activate(s, 'toci');
    activate(s, 'dexa');
    stepAbilities(s, 10);
    expect(s.abilities.toci.cooldown).toBeCloseTo(ABILITY.toci.cooldown - 10);
    expect(s.abilities.dexa.cooldown).toBeCloseTo(ABILITY.dexa.cooldown - 10);
  });

});
