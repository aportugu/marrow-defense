export interface EducationReference {
  id: string;
  citation: string;
  url: string;
}

export interface GlossaryEntry {
  id: string;
  term: string;
  summary: string;
  references: string[];
}

export const WAVE_TITLES: Readonly<Partial<Record<number, string>>> = Object.freeze({
  1: 'Target Engagement',
  3: 'High Disease Burden',
  4: 'Antigen Escape',
  6: 'Toxicity Divergence',
  8: 'Persistence',
  9: 'Hyperinflammatory Shift',
  10: 'Integrated Response',
});

export const REFERENCES: EducationReference[] = [
  { id: 'astct', citation: 'Lee DW et al. ASTCT consensus grading for CRS and neurologic toxicity (2019).', url: 'https://doi.org/10.1016/j.bbmt.2018.12.758' },
  { id: 'toxicity', citation: 'Neelapu SS et al. CAR-T therapy toxicity assessment and management (2018).', url: 'https://doi.org/10.1038/nrclinonc.2017.148' },
  { id: 'bcma', citation: 'Raje N et al. Anti-BCMA CAR T-cell therapy in multiple myeloma (2019).', url: 'https://doi.org/10.1056/NEJMoa1817226' },
  { id: 'idecel', citation: 'Munshi NC et al. Idecabtagene vicleucel in multiple myeloma (2021).', url: 'https://doi.org/10.1056/NEJMoa2024850' },
  { id: 'iech', citation: 'Hines MR et al. ASTCT IEC-HS consensus framework (2023).', url: 'https://doi.org/10.1016/j.jtct.2023.03.019' },
  { id: 'icaht', citation: 'Rejeski K et al. EHA/EBMT ICAHT consensus grading and best-practice recommendations (2023).', url: 'https://doi.org/10.1182/blood.2023020578' },
];

export const GLOSSARY: GlossaryEntry[] = [
  { id: 'bcma', term: 'BCMA', summary: 'B-cell maturation antigen is expressed on many malignant plasma cells and is a major CAR-T target in multiple myeloma.', references: ['bcma', 'idecel'] },
  { id: 'escape', term: 'Antigen escape', summary: 'Low or lost target expression can reduce the activity of a single-target therapy. The game shows this as visibly sparse BCMA receptors.', references: ['bcma', 'idecel'] },
  { id: 'crs', term: 'CRS', summary: 'Cytokine release syndrome is systemic inflammation following immune activation. Its meter and treatment effects here are simplified abstractions.', references: ['astct', 'toxicity'] },
  { id: 'icans', term: 'ICANS', summary: 'Immune effector cell-associated neurotoxicity syndrome can overlap with CRS but is assessed separately. The game represents it with delayed violet interference.', references: ['astct', 'toxicity'] },
  { id: 'persistence', term: 'Persistence', summary: 'Expansion, differentiation state, exhaustion, and persistence influence cellular-therapy durability. Memory support is a strategy-game metaphor.', references: ['bcma', 'idecel'] },
  { id: 'icaht', term: 'Hematotoxicity / ICAHT', summary: 'Immune effector cell-associated hematotoxicity describes cytopenic toxicity after cellular therapy. The delayed game meter is not a blood count, risk score, or clinical grade.', references: ['icaht', 'toxicity'] },
  { id: 'gcsf', term: 'G-CSF support', summary: 'G-CSF is represented as brief, repeatable marrow support. Its threshold, timing, recovery rate, and fitness protection are gameplay abstractions—not dosing or patient-specific guidance.', references: ['icaht', 'toxicity'] },
  { id: 'iech', term: 'IEC-HS', summary: 'IEC-HS is a distinct hyperinflammatory syndrome that may emerge as CRS is resolving. The independent meter is not a diagnostic score, and ability timings are not dosing guidance.', references: ['iech', 'astct'] },
  { id: 'limits', term: 'Simulation limitations', summary: 'All biology, toxicity, timing, and treatment effects are simplified for play. This game provides no diagnostic, dosing, or patient-specific medical guidance.', references: ['astct', 'toxicity'] },
];
