import { describe, expect, it } from 'vitest';
import { GLOSSARY, REFERENCES, WAVE_TITLES } from './education';

describe('clinical glossary data', () => {
  it('labels the seven show-don’t-tell milestone waves', () => {
    expect(WAVE_TITLES).toEqual({
      1: 'Target Engagement', 3: 'High Disease Burden', 4: 'Antigen Escape',
      6: 'Toxicity Divergence', 8: 'Persistence', 9: 'Hyperinflammatory Shift',
      10: 'Integrated Response',
    });
  });

  it('provides a compact cited glossary including IEC-HS and limitations', () => {
    expect(GLOSSARY.map((entry) => entry.term)).toEqual([
      'BCMA', 'Antigen escape', 'CRS', 'ICANS', 'Persistence', 'Hematotoxicity / ICAHT', 'G-CSF support', 'IEC-HS', 'Simulation limitations',
    ]);
    for (const entry of GLOSSARY) {
      expect(entry.summary.length).toBeGreaterThan(40);
      for (const id of entry.references) expect(REFERENCES.some((ref) => ref.id === id)).toBe(true);
    }
    expect(REFERENCES.every((ref) => ref.url.startsWith('https://'))).toBe(true);
    expect(REFERENCES.some((ref) => ref.url.endsWith('10.1182/blood.2023020578'))).toBe(true);
  });
});
