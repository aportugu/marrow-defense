// Level definitions: identity, wave tables, and per-lane enemy modifiers. The
// marrow level is the single-lane original; the hepatic level spreads three
// converging lanes (portal vein, hepatic artery, biliary branch) and scales
// each enemy type per lane so the same units face distinct pressure per lane.
import type { EnemyTypeId, LevelId } from '../game/types';
import { WAVES, LIVER_WAVES, CNS_WAVES, type Wave } from './waves';

export interface LaneMod {
  hp: number;
  speed: number;
  reward: number;
}

export interface LaneDef {
  name: string;
  color: string;
  label: string;
  mods: Record<EnemyTypeId, LaneMod>;
}

export interface LevelDef {
  id: LevelId;
  name: string;
  difficulty: 'STANDARD' | 'ADVANCED' | 'EXPERT';
  startCurrency: number;
  scoreKillTarget: number;
  scoreTimeTarget: number;
  waves: Wave[];
  lanes: LaneDef[];
}

const NEUTRAL: Record<EnemyTypeId, LaneMod> = {
  standard: { hp: 1, speed: 1, reward: 1 },
  proliferative: { hp: 1, speed: 1, reward: 1 },
  highBurden: { hp: 1, speed: 1, reward: 1 },
  bcmaLow: { hp: 1, speed: 1, reward: 1 },
  hepaticCore: { hp: 1, speed: 1, reward: 1 },
  cnsDrifter: { hp: 1, speed: 1, reward: 1 },
  leptomeningealSeed: { hp: 1, speed: 1, reward: 1 },
  sanctuaryClone: { hp: 1, speed: 1, reward: 1 },
  sanctuaryDeposit: { hp: 1, speed: 1, reward: 1 },
  parenchymalCore: { hp: 1, speed: 1, reward: 1 },
};

const mods = (
  standard: LaneMod,
  proliferative: LaneMod,
  highBurden: LaneMod,
  bcmaLow: LaneMod,
  hepaticCore: LaneMod = { hp: 1, speed: 1, reward: 1 },
): Record<EnemyTypeId, LaneMod> => ({ ...NEUTRAL, standard, proliferative, highBurden, bcmaLow, hepaticCore });

export const LEVELS: Record<LevelId, LevelDef> = {
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    difficulty: 'STANDARD',
    startCurrency: 120,
    scoreKillTarget: 287,
    scoreTimeTarget: 720,
    waves: WAVES,
    lanes: [
      { name: 'Marrow stream', color: '#b043d6', label: 'Marrow stream', mods: NEUTRAL },
    ],
  },
  liver: {
    id: 'liver',
    name: 'Hepatic',
    difficulty: 'ADVANCED',
    startCurrency: 220,
    scoreKillTarget: 230,
    scoreTimeTarget: 660,
    waves: LIVER_WAVES,
    lanes: [
      {
        name: 'Portal vein',
        color: '#5aa7c9',
        label: 'Portal vein',
        mods: mods(
          { hp: 1.1, speed: 1.0, reward: 1.2 },
          { hp: 1.0, speed: 1.15, reward: 1.2 },
          { hp: 0.8, speed: 0.95, reward: 1.25 },
          { hp: 1.05, speed: 1.0, reward: 1.25 },
        ),
      },
      {
        name: 'Hepatic artery',
        color: '#c95a5a',
        label: 'Hepatic artery',
        mods: mods(
          { hp: 1.15, speed: 1.05, reward: 1.25 },
          { hp: 1.05, speed: 1.25, reward: 1.25 },
          { hp: 0.85, speed: 1.08, reward: 1.3 },
          { hp: 1.1, speed: 1.1, reward: 1.3 },
        ),
      },
      {
        name: 'Biliary branch',
        color: '#8bc95a',
        label: 'Biliary branch',
        mods: mods(
          { hp: 1.15, speed: 0.9, reward: 1.3 },
          { hp: 1.1, speed: 0.95, reward: 1.3 },
          { hp: 1.05, speed: 0.85, reward: 1.4 },
          { hp: 1.25, speed: 0.9, reward: 1.4 },
          { hp: 1, speed: 1, reward: 1 },
        ),
      },
    ],
  },
  cns: {
    id: 'cns',
    name: 'Neuroaxis',
    difficulty: 'EXPERT',
    startCurrency: 260,
    scoreKillTarget: 225,
    scoreTimeTarget: 720,
    waves: CNS_WAVES,
    lanes: [
      {
        name: 'Spinal microvasculature', color: '#fb7185', label: 'BSCB · spinal perivascular route',
        mods: { ...NEUTRAL, cnsDrifter: { hp: .95, speed: 1.05, reward: 1.1 }, sanctuaryClone: { hp: 1.1, speed: 1, reward: 1.15 }, parenchymalCore: { hp: 1, speed: 1, reward: 1 } },
      },
      {
        name: 'Choroid plexus', color: '#38bdf8', label: 'Blood–CSF · ventricular route',
        mods: { ...NEUTRAL, cnsDrifter: { hp: .9, speed: 1.18, reward: 1.1 }, sanctuaryClone: { hp: 1, speed: 1.05, reward: 1.15 } },
      },
      {
        name: 'Pial vessels', color: '#a78bfa', label: 'Leptomeningeal · craniospinal route',
        mods: { ...NEUTRAL, cnsDrifter: { hp: 1, speed: 1.1, reward: 1.15 }, leptomeningealSeed: { hp: 1.08, speed: .95, reward: 1.2 }, sanctuaryClone: { hp: 1.08, speed: 1, reward: 1.2 } },
      },
    ],
  },
};

export const LEVEL_ORDER: LevelId[] = ['marrow', 'liver', 'cns'];

export function wavesForLevel(level: LevelId): Wave[] {
  return LEVELS[level].waves;
}

export function lanesForLevel(level: LevelId): LaneDef[] {
  return LEVELS[level].lanes;
}
