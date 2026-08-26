import { describe, expect, it } from 'vitest';
import { KineticBackground, createKineticDescriptors, healthyMoteFraction, hepaticTumorIntensity } from './KineticBackground';

describe('kinetic background data', () => {
  it('creates deterministic descriptors and caps the particle budget', () => {
    expect(createKineticDescriptors(12, 7)).toEqual(createKineticDescriptors(12, 7));
    expect(createKineticDescriptors(999)).toHaveLength(120);
  });

  it('expires visual events after their short lifetime', () => {
    const scene = new KineticBackground();
    scene.pushEvent('leak', 10);
    expect(scene.activeEvents(10.5)).toHaveLength(1);
    expect(scene.activeEvents(11.5)).toHaveLength(0);
    scene.pushEvent('iecHsOnset', 12);
    scene.pushEvent('anakinra', 12);
    scene.pushEvent('gcsf', 12);
    expect(scene.activeEvents(12.2)).toHaveLength(3);
  });

  it('reduces healthy marrow density without removing the static visual cue', () => {
    expect(healthyMoteFraction(0)).toBe(1);
    expect(healthyMoteFraction(70)).toBeLessThan(healthyMoteFraction(20));
    expect(healthyMoteFraction(100)).toBe(0.35);
    expect(healthyMoteFraction(70, true)).toBeGreaterThan(healthyMoteFraction(70));
    expect(healthyMoteFraction(0, true)).toBe(1);
  });

  it('intensifies and then clears the hepatic tumor field deterministically', () => {
    const early = hepaticTumorIntensity(0, 0, 0);
    const late = hepaticTumorIntensity(1, 70, 1);
    expect(late).toBeGreaterThan(early);
    expect(hepaticTumorIntensity(1, 100, 1, true)).toBeLessThan(early);
  });
});
