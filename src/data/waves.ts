// Hand-tuned waves for each level. "at" is seconds into the wave at which a spawn
// happens. "lane" picks the spawn lane (0-indexed) for multi-lane levels. Composition
// escalates in count and mixes in BCMA-low from wave 4.
import type { EnemyBehavior, EnemyTypeId, HepaticEventKind } from '../game/types';

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

export interface Wave {
  groups: WaveGroup[];
  events?: WaveEventDef[];
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
  { groups: [g('standard', 6, 1.4, 1, 0), g('proliferative', 4, 1.0, 1, 1), g('proliferative', 2, 1.0, 5.2, 1, 'mitotic'), g('bcmaLow', 3, 1.8, 8, 1), g('highBurden', 2, 6, 10, 2), g('proliferative', 2, .65, 7, 2, 'surge')], events: [surge(9, 0, 3), surge(9.6, 1, 3)] },
  { groups: [g('proliferative', 7, 0.9, 1, 0), g('standard', 6, 1.3, 1, 1), g('bcmaLow', 4, 1.6, 8, 2), g('highBurden', 1, 0, 12, 2), g('highBurden', 1, 0, 17, 2, 'obstruction'), g('proliferative', 2, .65, 7, 1, 'surge')], events: [surge(14, 2, 3)] },
  { groups: [g('standard', 6, 1.3, 1, 0), g('bcmaLow', 4, 1.5, 8, 0), g('proliferative', 6, .85, 1, 1), g('proliferative', 2, .85, 6.3, 1, 'mitotic'), g('highBurden', 1, 0, 10, 2), g('highBurden', 1, 0, 15, 2, 'obstruction'), g('proliferative', 2, .65, 7, 2, 'surge')], events: [surge(8, 0, 3), surge(15, 2, 3)] },
  { groups: [g('proliferative', 5, .8, 1, 0), g('proliferative', 3, .8, 5.2, 0, 'mitotic'), g('bcmaLow', 4, 1.4, 8, 0), g('standard', 7, 1.15, 1, 1), g('proliferative', 5, .85, 8, 1), g('highBurden', 2, 5, 10, 2), g('highBurden', 1, 0, 20.5, 2, 'obstruction'), g('proliferative', 2, .65, 7, 0, 'surge')], events: [surge(7, 0, 3), surge(14, 1, 3)] },
  { groups: [g('standard', 6, 1.1, 1, 0), g('bcmaLow', 4, 1.3, 8, 0), g('proliferative', 6, .8, 1, 1), g('proliferative', 2, .8, 6, 1, 'mitotic'), g('hepaticCore', 1, 0, 8, 2), g('highBurden', 2, 5, 14, 2), g('proliferative', 2, .65, 7, 1, 'surge')], events: [surge(15, 2, 3)] },
];

export function wavePreview(w: Wave): Record<EnemyTypeId, number> {
  const out: Record<EnemyTypeId, number> = {
    standard: 0,
    proliferative: 0,
    highBurden: 0,
    bcmaLow: 0,
    hepaticCore: 0,
  };
  for (const grp of w.groups) out[grp.type] += grp.count;
  for (const event of w.events ?? []) out[event.enemyType ?? 'proliferative'] += event.count;
  return out;
}
