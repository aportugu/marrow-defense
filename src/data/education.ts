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

import type { LevelId } from '../game/types';

export const WAVE_TITLES: Record<LevelId, Readonly<Partial<Record<number, string>>>> = {
  marrow: {
    1: 'Target Engagement',
    3: 'High Disease Burden',
    4: 'Antigen Escape',
    6: 'Toxicity Divergence',
    8: 'Persistence',
    9: 'Hyperinflammatory Shift',
    10: 'Integrated Response',
  },
  liver: {
    1: 'Vascular Entry',
    3: 'Multifocal Disease',
    5: 'Sinusoidal Spread',
    7: 'Biliary Obstruction',
    9: 'Extramedullary Persistence',
    10: 'Hepatic Clearance',
  },
  cns: {
    1: 'Microvascular Reconnaissance',
    2: 'Choroid Plexus Entry',
    3: 'Dual-Interface Breach',
    4: 'Leptomeningeal Seeding',
    5: 'Ventricular Dissemination',
    6: 'Craniospinal Spread',
    7: 'Lumbar Sanctuary',
    8: 'Neuroaxis Cascade',
    9: 'Perivascular Invasion',
    10: 'Parenchymal Core',
  },
} as const;

export const REFERENCES: EducationReference[] = [
  { id: 'astct', citation: 'Lee DW et al. ASTCT consensus grading for CRS and neurologic toxicity (2019).', url: 'https://doi.org/10.1016/j.bbmt.2018.12.758' },
  { id: 'toxicity', citation: 'Neelapu SS et al. CAR-T therapy toxicity assessment and management (2018).', url: 'https://doi.org/10.1038/nrclinonc.2017.148' },
  { id: 'bcma', citation: 'Raje N et al. Anti-BCMA CAR T-cell therapy in multiple myeloma (2019).', url: 'https://doi.org/10.1056/NEJMoa1817226' },
  { id: 'idecel', citation: 'Munshi NC et al. Idecabtagene vicleucel in multiple myeloma (2021).', url: 'https://doi.org/10.1056/NEJMoa2024850' },
  { id: 'iech', citation: 'Hines MR et al. ASTCT IEC-HS consensus framework (2023).', url: 'https://doi.org/10.1016/j.jtct.2023.03.019' },
  { id: 'icaht', citation: 'Rejeski K et al. EHA/EBMT ICAHT consensus grading and best-practice recommendations (2023).', url: 'https://doi.org/10.1182/blood.2023020578' },
  { id: 'imwg-response', citation: 'Kumar S et al. IMWG consensus criteria for response and minimal residual disease assessment in multiple myeloma (2016).', url: 'https://doi.org/10.1016/S1470-2045(16)30206-6' },
  { id: 'cns-myeloma', citation: 'Egan PA et al. Multiple myeloma with central nervous system relapse (2020).', url: 'https://doi.org/10.3324/haematol.2020.264226' },
  { id: 'bbb', citation: 'Daneman R, Prat A. The blood–brain barrier (2015).', url: 'https://doi.org/10.1101/cshperspect.a020412' },
  { id: 'blood-csf', citation: 'Lun MP et al. The choroid plexus: roles in brain homeostasis (2015).', url: 'https://doi.org/10.1186/2045-8118-12-3' },
  { id: 'csf', citation: 'StatPearls. Neuroanatomy, Cerebrospinal Fluid.', url: 'https://www.ncbi.nlm.nih.gov/books/NBK470578/' },
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
  { id: 'extramedullary', term: 'Extramedullary plasmacytoma', summary: 'Plasma-cell tumors outside the bone marrow can arise in organs such as the liver, where disease spreads along vascular and biliary routes. The hepatic level maps that spread onto three converging lanes.', references: ['bcma', 'astct'] },
  { id: 'cns-myeloma', term: 'CNS myeloma relapse', summary: 'Malignant plasma cells may involve leptomeninges, CSF, or brain parenchyma. The Neuroaxis campaign combines these rare patterns into a simplified deterministic battlefield.', references: ['cns-myeloma'] },
  { id: 'bbb', term: 'Blood–brain barrier (BBB)', summary: 'The cerebral microvascular neurovascular unit separates circulating blood from brain parenchyma. It is distinct from the choroid-plexus blood–CSF barrier.', references: ['bbb'] },
  { id: 'blood-csf', term: 'Blood–CSF barrier', summary: 'Choroid-plexus epithelial tight junctions regulate exchange between blood and ventricular CSF. This interface is not the cerebral microvascular BBB.', references: ['blood-csf', 'csf'] },
  { id: 'leptomeninges', term: 'Leptomeningeal compartment', summary: 'The pia and arachnoid enclose cranial and spinal subarachnoid spaces. In the simulation, pial vascular entry can seed this surface compartment and the lumbar cistern.', references: ['cns-myeloma', 'csf'] },
  { id: 'imwg-response', term: 'IMWG response categories', summary: 'sCR, CR, VGPR, PR, SD, and PD describe progressively different responses to myeloma therapy. Real assessment uses laboratory, imaging, marrow, and progression criteria that this gameplay score does not model.', references: ['imwg-response'] },
  { id: 'limits', term: 'Simulation limitations', summary: 'All biology, toxicity, timing, and treatment effects are simplified for play. This game provides no diagnostic, dosing, or patient-specific medical guidance.', references: ['astct', 'toxicity'] },
];
