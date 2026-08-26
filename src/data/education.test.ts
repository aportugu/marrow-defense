import { describe, expect, it } from 'vitest';
import { GLOSSARY, REFERENCES, WAVE_TITLES } from './education';

describe('clinical glossary data', () => {
  it('labels the show-don’t-tell milestone waves for both levels', () => {
    expect(WAVE_TITLES.marrow).toEqual({
      1: 'Target Engagement', 3: 'High Disease Burden', 4: 'Antigen Escape',
      6: 'Toxicity Divergence', 8: 'Persistence', 9: 'Hyperinflammatory Shift',
      10: 'Integrated Response',
    });
    expect(WAVE_TITLES.liver).toEqual({
      1: 'Vascular Entry', 3: 'Multifocal Disease', 5: 'Sinusoidal Spread',
      7: 'Biliary Obstruction', 9: 'Extramedullary Persistence',
      10: 'Hepatic Clearance',
    });
  });

  it('provides a compact cited glossary including IEC-HS and limitations', () => {
    expect(GLOSSARY.map((entry) => entry.term)).toEqual([
      'BCMA', 'Antigen escape', 'CRS', 'ICANS', 'Persistence', 'Hematotoxicity / ICAHT', 'G-CSF support', 'IEC-HS', 'Extramedullary plasmacytoma', 'IMWG response categories', 'Simulation limitations',
    ]);
    for (const entry of GLOSSARY) {
      expect(entry.summary.length).toBeGreaterThan(40);
      for (const id of entry.references) expect(REFERENCES.some((ref) => ref.id === id)).toBe(true);
    }
    expect(REFERENCES.every((ref) => ref.url.startsWith('https://'))).toBe(true);
    expect(REFERENCES.some((ref) => ref.url.endsWith('10.1182/blood.2023020578'))).toBe(true);
    expect(REFERENCES.some((ref) => ref.url.endsWith('S1470-2045(16)30206-6'))).toBe(true);
  });
});
