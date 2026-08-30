// Hand-tuned waves for each level. "at" is seconds into the wave at which a spawn
// happens. "lane" picks the spawn lane (0-indexed) for multi-lane levels. Composition
// escalates in count and mixes in BCMA-low from wave 4.
import type { CnsInterface, EnemyBehavior, EnemyTypeId, HepaticEventKind } from '../game/types';

export interface WaveGroup {
  type: EnemyTypeId;
  count: number;
  gap: number;
  start: number;
  lane?: number;
  behavior?: EnemyBehavior;
}

export interface WaveEventDef {
  kind: HepaticEventKind;
  at: number;
  lane: number;
  count: number;
  enemyType?: EnemyTypeId;
}

export interface CnsBreachDef {
  interface: CnsInterface;
  at: number;
  lane: number;
  count: number;
  enemyType: EnemyTypeId;
}

export interface Wave {
  groups: WaveGroup[];
  events?: WaveEventDef[];
  cnsBreaches?: CnsBreachDef[];
}

const g = (
  type: EnemyTypeId,
  count: number,
  gap: number,
  start: number,
  lane = 0,
  behavior?: EnemyBehavior,
): WaveGroup => ({ type, count, gap, start, lane, behavior });

const surge = (at: number, lane: number, count: number): WaveEventDef => ({
  kind: 'surge', at, lane, count, enemyType: 'proliferative',
});

export const WAVES: Wave[] = [
  { groups: [g('standard', 6, 2.2, 1)] },
  { groups: [g('standard', 8, 1.8, 1), g('proliferative', 4, 1.2, 8)] },
  { groups: [g('standard', 9, 1.6, 1), g('proliferative', 6, 1.0, 9), g('highBurden', 1, 0, 20)] },
  { groups: [g('standard', 9, 1.6, 1), g('bcmaLow', 4, 2.0, 6), g('proliferative', 6, 0.9, 12)] },
  { groups: [g('bcmaLow', 5, 1.6, 1), g('standard', 10, 1.4, 4), g('proliferative', 8, 0.9, 10), g('highBurden', 1, 0, 16)] },
  { groups: [g('standard', 12, 1.2, 1), g('bcmaLow', 6, 1.4, 5), g('proliferative', 10, 0.8, 14), g('highBurden', 2, 7, 22)] },
  { groups: [g('bcmaLow', 8, 1.3, 1), g('standard', 14, 1.1, 3), g('proliferative', 12, 0.8, 10), g('highBurden', 2, 6, 18)] },
  { groups: [g('proliferative', 14, 0.7, 1), g('bcmaLow', 10, 1.2, 4), g('standard', 14, 1.0, 8), g('highBurden', 3, 5, 20)] },
  { groups: [g('bcmaLow', 12, 1.1, 1), g('standard', 16, 0.9, 2), g('proliferative', 16, 0.6, 10), g('highBurden', 4, 4.5, 22)] },
  { groups: [g('standard', 18, 0.8, 1), g('bcmaLow', 14, 1.0, 3), g('proliferative', 18, 0.6, 8), g('highBurden', 5, 3.5, 18)] },
];

// Hepatic level: three converging lanes (0 portal vein, 1 hepatic artery,
// 2 biliary branch). Escalates in count and cross-lane pressure.
export const LIVER_WAVES: Wave[] = [
  { groups: [g('standard', 5, 2.0, 1, 0), g('standard', 4, 2.1, 2, 1), g('proliferative', 1, 0, 7, 2, 'surge')] },
  { groups: [g('standard', 5, 1.8, 1, 0), g('standard', 4, 1.8, 1, 1), g('standard', 3, 1.8, 1, 2), g('proliferative', 1, 0, 7, 2, 'surge')] },
  { groups: [g('standard', 4, 1.6, 1, 0), g('proliferative', 6, 1.0, 1, 1), g('standard', 3, 1.8, 3, 2), g('proliferative', 1, 0, 7, 0, 'surge')] },
  { groups: [g('standard', 5, 1.6, 1, 0), g('proliferative', 5, 1.2, 1, 1), g('highBurden', 1, 0, 12, 2), g('proliferative', 1, 0, 7, 2, 'surge')], events: [surge(9, 1, 3)] },
  { groups: [g('proliferative', 3, 1.0, 1, 0), g('proliferative', 2, 1.0, 4.2, 0, 'mitotic'), g('bcmaLow', 2, 2.0, 8, 0), g('standard', 5, 1.5, 1, 1), g('highBurden', 2, 6, 10, 2), g('proliferative', 1, 0, 7, 1, 'surge')] },
  { groups: [g('standard', 6, 1.4, 1, 0), g('proliferative', 4, 1.0, 1, 1), g('proliferative', 2, 1.0, 5.2, 1, 'mitotic'), g('bcmaLow', 3, 1.8, 8, 1), g('highBurden', 2, 6, 10, 2), g('proliferative', 3, .65, 7, 2, 'surge')], events: [surge(9, 0, 3), surge(9.6, 1, 3)] },
  { groups: [g('proliferative', 7, 0.9, 1, 0), g('standard', 6, 1.3, 1, 1), g('bcmaLow', 4, 1.6, 8, 2), g('highBurden', 1, 0, 12, 2), g('highBurden', 1, 0, 17, 2, 'obstruction'), g('proliferative', 3, .65, 7, 1, 'surge')], events: [surge(14, 2, 3)] },
  { groups: [g('standard', 6, 1.3, 1, 0), g('bcmaLow', 4, 1.5, 8, 0), g('proliferative', 6, .85, 1, 1), g('proliferative', 2, .85, 6.3, 1, 'mitotic'), g('highBurden', 1, 0, 10, 2), g('highBurden', 1, 0, 15, 2, 'obstruction'), g('proliferative', 3, .65, 7, 2, 'surge')], events: [surge(8, 0, 3), surge(15, 2, 3)] },
  { groups: [g('proliferative', 5, .8, 1, 0), g('proliferative', 3, .8, 5.2, 0, 'mitotic'), g('bcmaLow', 4, 1.4, 8, 0), g('standard', 7, 1.15, 1, 1), g('proliferative', 5, .85, 8, 1), g('highBurden', 2, 5, 10, 2), g('highBurden', 1, 0, 20.5, 2, 'obstruction'), g('proliferative', 3, .65, 7, 0, 'surge')], events: [surge(7, 0, 3), surge(14, 1, 3)] },
  { groups: [g('standard', 6, 1.1, 1, 0), g('bcmaLow', 4, 1.3, 8, 0), g('proliferative', 6, .8, 1, 1), g('proliferative', 2, .8, 6, 1, 'mitotic'), g('hepaticCore', 1, 0, 8, 2), g('highBurden', 2, 5, 14, 2), g('proliferative', 3, .65, 7, 1, 'surge')], events: [surge(15, 2, 3)] },
];

const breach = (
  interfaceName: CnsInterface,
  at: number,
  lane: number,
  count: number,
  enemyType: EnemyTypeId,
): CnsBreachDef => ({ interface: interfaceName, at, lane, count, enemyType });

// Neuroaxis: lane 0 is cerebral microvascular/perivascular, lane 1 follows the
// ventricular CSF sequence, and lane 2 follows the craniospinal leptomeninges.
export const CNS_WAVES: Wave[] = [
  { groups: [g('standard', 7, 2, 1, 0)], cnsBreaches: [breach('bbb', 7, 0, 3, 'cnsDrifter')] },
  { groups: [g('standard', 6, 1.8, 1, 0), g('cnsDrifter', 4, 1.1, 5, 1)], cnsBreaches: [breach('bloodCsf', 10, 1, 4, 'cnsDrifter')] },
  { groups: [g('standard', 8, 1.5, 1, 0), g('proliferative', 6, .9, 5, 1)], cnsBreaches: [breach('bbb', 8, 0, 4, 'cnsDrifter'), breach('bloodCsf', 8, 1, 4, 'cnsDrifter')] },
  { groups: [g('standard', 8, 1.5, 1, 0), g('bcmaLow', 4, 1.8, 5, 2), g('leptomeningealSeed', 2, 6, 8, 2, 'sanctuary')], cnsBreaches: [breach('leptomeningeal', 7, 2, 4, 'cnsDrifter')] },
  { groups: [g('cnsDrifter', 8, .85, 1, 1), g('sanctuaryClone', 6, 1.3, 5, 1), g('leptomeningealSeed', 2, 7, 8, 1, 'sanctuary')], cnsBreaches: [breach('bloodCsf', 6, 1, 5, 'sanctuaryClone')] },
  { groups: [g('standard', 10, 1.25, 1, 0), g('proliferative', 8, .8, 4, 2), g('sanctuaryClone', 4, 1.4, 8, 1)], cnsBreaches: [breach('leptomeningeal', 9, 2, 5, 'cnsDrifter'), breach('bloodCsf', 15, 1, 4, 'sanctuaryClone')] },
  { groups: [g('bcmaLow', 6, 1.4, 1, 0), g('cnsDrifter', 10, .75, 3, 2), g('sanctuaryClone', 5, 1.2, 8, 2), g('leptomeningealSeed', 3, 5, 6, 2, 'sanctuary')], cnsBreaches: [breach('leptomeningeal', 7, 2, 6, 'cnsDrifter')] },
  { groups: [g('standard', 10, 1.1, 1, 0), g('proliferative', 10, .65, 5, 1), g('sanctuaryClone', 6, 1, 7, 2), g('leptomeningealSeed', 3, 5, 8, 2, 'sanctuary')], cnsBreaches: [breach('bbb', 8, 0, 5, 'cnsDrifter'), breach('bloodCsf', 8, 1, 5, 'cnsDrifter'), breach('leptomeningeal', 8, 2, 5, 'cnsDrifter')] },
  { groups: [g('bcmaLow', 8, 1.2, 1, 0), g('highBurden', 4, 4, 6, 0), g('cnsDrifter', 12, .65, 3, 2), g('sanctuaryClone', 4, 1.1, 8, 1), g('leptomeningealSeed', 3, 5, 7, 2, 'sanctuary')], cnsBreaches: [breach('bbb', 7, 0, 6, 'sanctuaryClone'), breach('leptomeningeal', 14, 2, 6, 'cnsDrifter')] },
  { groups: [g('parenchymalCore', 1, 0, 3, 0), g('standard', 10, 1, 1, 0), g('cnsDrifter', 6, .7, 7, 1), g('bcmaLow', 4, 1.2, 10, 2)], cnsBreaches: [breach('bbb', 8, 0, 5, 'sanctuaryClone'), breach('bloodCsf', 14, 1, 5, 'cnsDrifter'), breach('leptomeningeal', 20, 2, 5, 'cnsDrifter')] },
];

export function wavePreview(w: Wave): Record<EnemyTypeId, number> {
  const out: Record<EnemyTypeId, number> = {
    standard: 0,
    proliferative: 0,
    highBurden: 0,
    bcmaLow: 0,
    hepaticCore: 0,
    cnsDrifter: 0,
    leptomeningealSeed: 0,
    sanctuaryClone: 0,
    sanctuaryDeposit: 0,
    parenchymalCore: 0,
  };
  for (const grp of w.groups) out[grp.type] += grp.count;
  for (const event of w.events ?? []) out[event.enemyType ?? 'proliferative'] += event.count;
  for (const breachEvent of w.cnsBreaches ?? []) out[breachEvent.enemyType] += breachEvent.count;
  return out;
}
