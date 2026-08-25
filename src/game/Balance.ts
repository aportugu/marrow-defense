// Central game balance. Every tunable number lives in this single file so the
// game can be re-tuned in one place. See PLAN.md.
import type { EnemyTypeId, UnitTypeId, AbilityId } from './types';

export const START = {
  currency: 120,
  countdown: 12,
  meter: { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0 },
};

// Free-placement rules for CAR-T units inside the marrow.
export const PLACEMENT = {
  margin: 40,
  pathClearance: 46,
  unitGap: 30,
};

export interface EnemyDef {
  hp: number;
  speed: number;
  size: number;
  reward: number;
  crsOnKill: number;
  neuroOnKill: number;
  escapeBurden: number;
  escapeHematotoxicity: number;
  color: string;
  icon: 'cell' | 'burst' | 'mass' | 'dim';
  label: string;
}

export const ENEMY: Record<EnemyTypeId, EnemyDef> = {
  standard: {
    hp: 55, speed: 52, size: 13, reward: 10, crsOnKill: 4,
    neuroOnKill: 0.4,
    escapeBurden: 6, escapeHematotoxicity: 3,
    color: '#b043d6', icon: 'cell', label: 'Standard plasma cell',
  },
  proliferative: {
    hp: 22, speed: 86, size: 9, reward: 5, crsOnKill: 1.5,
    neuroOnKill: 0.15,
    escapeBurden: 2, escapeHematotoxicity: 1,
    color: '#e066f5', icon: 'burst', label: 'Proliferative clone',
  },
  highBurden: {
    hp: 320, speed: 30, size: 20, reward: 25, crsOnKill: 12,
    neuroOnKill: 1.5,
    escapeBurden: 15, escapeHematotoxicity: 6,
    color: '#7a1f5c', icon: 'mass', label: 'High-burden cluster',
  },
  bcmaLow: {
    hp: 95, speed: 48, size: 14, reward: 14, crsOnKill: 5,
    neuroOnKill: 0.6,
    escapeBurden: 9, escapeHematotoxicity: 4,
    color: '#9a9ac0', icon: 'dim', label: 'BCMA-low clone',
  },
};

export interface UpgradeDef {
  name: string;
  cost: number;
  desc: string;
}

export interface UnitDef {
  cost: number;
  range: number;
  damage: number;
  interval: number;
  crsFactor: number;
  color: string;
  ring: string;
  icon: 'triangle' | 'hex' | 'circle';
  label: string;
  blurb: string;
  buff?: { radius: number };
  upgrades: [UpgradeDef, UpgradeDef];
}

export const UNIT: Record<UnitTypeId, UnitDef> = {
  bcma: {
    cost: 100, range: 130, damage: 16, interval: 0.8, crsFactor: 1.0,
    color: '#22d3ee', ring: '#a5f3fc', icon: 'triangle',
    label: 'BCMA CAR-T',
    blurb: 'High single-target damage. More CRS. Weaker vs BCMA-low targets.',
    upgrades: [
      { name: 'Rapid expansion', cost: 80, desc: 'Attacks 60% faster.' },
      { name: 'Durable memory', cost: 130, desc: '40% less CRS; reduces fitness decline by 15%.' },
    ],
  },
  dual: {
    cost: 170, range: 112, damage: 13, interval: 1.0, crsFactor: 0.7,
    color: '#f5c518', ring: '#fde047', icon: 'hex',
    label: 'Dual-Target CAR-T',
    blurb: 'Handles standard and BCMA-low targets. Steadier, less CRS.',
    upgrades: [
      { name: 'Tandem recognition', cost: 110, desc: '+30 range, +15% damage.' },
      { name: 'Coordinated killing', cost: 170, desc: 'Strikes 2 targets at 75% damage each.' },
    ],
  },
  memory: {
    cost: 75, range: 120, damage: 4, interval: 1.2, crsFactor: 0.2,
    color: '#2dd4bf', ring: '#5eead4', icon: 'circle',
    label: 'Memory T Cell',
    blurb: 'Low damage. Buffs nearby CAR-T. Grows a little each wave.',
    buff: { radius: 120 },
    upgrades: [
      { name: 'Stem-like persistence', cost: 70, desc: 'Faster wave growth and stronger support.' },
      { name: 'Local support', cost: 120, desc: 'Stronger support aura for nearby CAR-T cells.' },
    ],
  },
};

export interface AbilityDef {
  name: string;
  cost: number;
  cooldown: number;
  glyph: string;
  blurb: string;
  once?: boolean;
}

export const ABILITY: Record<AbilityId, AbilityDef> = {
  toci: { name: 'Tocilizumab', cost: 55, cooldown: 28, glyph: '\u272a', blurb: 'Immediately lowers CRS by 40. No effect on neurotoxicity or CAR-T damage.' },
  dexa: { name: 'Dexamethasone', cost: 75, cooldown: 40, glyph: '\u25b3', blurb: 'Cuts neurotoxicity and suppresses new CRS for 8s, but slows attacks and costs fitness.' },
  stemcell: { name: 'Stem-Cell Boost', cost: 140, cooldown: 0, glyph: '\u25cf', blurb: 'Once per run at hematotoxicity 20+, nearly resolves hematotoxicity and its latent backlog. Gameplay abstraction.', once: true },
  anakinra: { name: 'Anakinra', cost: 0, cooldown: 35, glyph: '\u2736', blurb: 'IEC-HS scenario abstraction: suppresses new hyperinflammation and accelerates recovery for 10s.' },
  gcsf: { name: 'G-CSF', cost: 45, cooldown: 24, glyph: '\u2739', blurb: 'At hematotoxicity 20+, lowers it by 10 and provides 6s of marrow support. Gameplay abstraction, not dosing guidance.' },
};

export const TOCI = { crsDrop: 40 };
export const DEXA = { neuroDrop: 45, suppressFor: 8, crsMultiplier: 0.35, slowAtk: 0.25, slowFor: 8, fitnessHit: 6 };
export const STEMCELL = {
  minHematotoxicity: 20,
  hematotoxicityDrop: 70,
  latentLoadMultiplier: 0.1,
  duration: 10,
  recoveryPerSec: 3,
};
export const GCSF = {
  minHematotoxicity: 20,
  hematotoxicityDrop: 10,
  latentLoadMultiplier: 0.85,
  duration: 6,
  recoveryPerSec: 1.5,
  fitnessDrainMultiplier: 0.4,
};
export const IEC_HS = {
  onsetWave: 9,
  baseSeverity: 25,
  peakCrsFactor: 0.25,
  burdenFactor: 0.2,
  maxInitialSeverity: 70,
  risePerSec: 0.72,
  killFactor: 0.14,
  fitnessDrainFactor: 0.002,
  anakinraDuration: 10,
  anakinraMultiplier: 0.2,
  anakinraDecay: 2.5,
  dexaDrop: 20,
  dexaDuration: 8,
  dexaMultiplier: 0.5,
};

export const METER = {
  crsDecayWave: 1.1,
  crsDecayPlanning: 3.0,
  fitnessDecline: 1.6,
  fitnessRegen: 5.0,
  burdenDecay: 0.3,
  hematotoxicityExposure: { crs: 0.42, hyperinflammation: 0.62, burden: 0.26 },
  hematotoxicityRelease: 0.18,
  hematotoxicityWarn: 45,
  hematotoxicityDanger: 65,
  hematotoxicityFitnessThreshold: 50,
  hematotoxicityFitnessDrainMax: 0.5,
  crsWarn: 60,
  neuroDrip: 0.35,
  neuroDecay: 1.5,
  neuroWarn: 60,
};

export const ECONOMY = {
  passivePerSec: 1,
  waveClearBase: 45,
  waveClearPerWave: 5,
  noSevereBonus: 20,
  memoryWaveGrowth: 0.08,
  buffRadiusGrowth: 6,
};

export const SCORING = {
  weights: {
    hematotoxicity: 220,
    burden: 120,
    fitness: 100,
    crs: 130,
    neuro: 110,
    kills: 120,
    currency: 70,
    time: 50,
    precision: 80,
  },
  caps: { kills: 287, currency: 400 },
  timeTarget: 720,
  grades: [
    [850, 'S'],
    [750, 'A'],
    [625, 'B'],
    [450, 'C'],
  ] as [number, string][],
};
