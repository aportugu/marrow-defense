// The single hand-tuned level: 10 waves. "at" is seconds into the wave at which a
// spawn happens. Composition escalates in count and mixes in BCMA-low from wave 4.
import type { EnemyTypeId } from '../game/types';

export interface WaveGroup {
  type: EnemyTypeId;
  count: number;
  gap: number;
  start: number;
}

export interface Wave {
  groups: WaveGroup[];
}

const g = (type: EnemyTypeId, count: number, gap: number, start: number): WaveGroup => ({
  type,
  count,
  gap,
  start,
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

export function wavePreview(w: Wave): Record<EnemyTypeId, number> {
  const out: Record<EnemyTypeId, number> = {
    standard: 0,
    proliferative: 0,
    highBurden: 0,
    bcmaLow: 0,
  };
  for (const grp of w.groups) out[grp.type] += grp.count;
  return out;
}
