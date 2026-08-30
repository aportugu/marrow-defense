import { ABILITY, DEXA, GCSF, STEMCELL, TOCI, UNIT } from '../game/Balance';

export interface TutorialItem {
  heading: string;
  text: string;
  tone?: 'standard' | 'warning' | 'treatment';
}

export interface TutorialPage {
  title: string;
  summary: string;
  items: TutorialItem[];
}

export const TUTORIAL_PAGES: readonly TutorialPage[] = [
  {
    title: 'Mission and game loop',
    summary: 'Defend the patient through 10 waves of malignant plasma cells.',
    items: [
      { heading: 'Plan', text: 'Spend funding to place CAR-T units in legal spaces away from paths and other units. Select a placed unit to buy upgrades.' },
      { heading: 'Defend', text: 'Start each wave when ready. Your units attack automatically while surviving cells move toward the patient.' },
      { heading: 'Expand', text: 'Kills and wave clears earn funding. Reinvest it in additional cells to broaden lane coverage as pressure increases.' },
      { heading: 'Adapt', text: 'Build multiple cells, but keep enough funding in reserve to match support abilities to rising toxicity.' },
    ],
  },
  {
    title: 'Build your CAR-T defense',
    summary: 'Each unit fills a different tactical role.',
    items: [
      { heading: `${UNIT.bcma.label} · 100`, text: UNIT.bcma.blurb },
      { heading: `${UNIT.dual.label} · 170`, text: UNIT.dual.blurb },
      { heading: `${UNIT.memory.label} · 75`, text: UNIT.memory.blurb },
      { heading: 'Expansion and upgrades', text: 'Add cells near lanes to expand coverage, then select placed units to improve them. Keep a treatment reserve instead of spending every point on defense.' },
    ],
  },
  {
    title: 'Match toxicity to treatment',
    summary: 'Use the correct support ability for the meter that is rising.',
    items: [
      { heading: `${ABILITY.toci.name} → CRS`, text: `Immediately lowers CRS by ${TOCI.crsDrop}. It does not lower neurotoxicity or reduce CAR-T damage.`, tone: 'treatment' },
      { heading: `${ABILITY.dexa.name} → Neurotoxicity`, text: `Lowers neurotoxicity by ${DEXA.neuroDrop} and suppresses new CRS for ${DEXA.suppressFor}s, but temporarily slows attacks and costs ${DEXA.fitnessHit} fitness.`, tone: 'treatment' },
      { heading: `${ABILITY.anakinra.name} → IEC-HS`, text: 'Available during the IEC-HS scenario; suppresses new hyperinflammation and accelerates its recovery.', tone: 'treatment' },
      { heading: `${ABILITY.gcsf.name} → Hematotoxicity`, text: `At hematotoxicity ${GCSF.minHematotoxicity}+, lowers it by ${GCSF.hematotoxicityDrop} and provides ${GCSF.duration}s of repeatable marrow support.`, tone: 'treatment' },
      { heading: `${ABILITY.stemcell.name} → Major recovery`, text: `A one-time option at hematotoxicity ${STEMCELL.minHematotoxicity}+ that clears most visible and latent hematotoxicity, followed by ${STEMCELL.duration}s of recovery.`, tone: 'treatment' },
    ],
  },
  {
    title: 'Read the battlefield',
    summary: 'Keep dangerous meters away from their failure thresholds while maintaining enough defense.',
    items: [
      { heading: 'Critical meters', text: 'CRS, neurotoxicity, or IEC-HS reaching 100 ends the run. Fitness reaching 0 also ends the run.', tone: 'warning' },
      { heading: 'Burden and hematotoxicity', text: 'Escaped cells raise burden and delayed hematotoxicity. Hematotoxicity impairs recovery and can drain fitness, so it must be actively managed.' },
      { heading: 'Marrow and hepatic campaigns', text: 'Marrow teaches single-lane defense. The advanced hepatic campaign has portal, arterial, and biliary lanes with timed surge events.' },
      { heading: 'Controls', text: 'Tap controls, or use Q/W/E to build, 1–5 for abilities, Space or Enter to start a wave, P to pause, and Escape to cancel.' },
    ],
  },
] as const;

export const TUTORIAL_DISCLAIMER = 'Treatment effects, thresholds, and timing are simplified game mechanics—not medical advice, dosing guidance, or patient-specific care.';
