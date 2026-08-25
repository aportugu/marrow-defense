// Composite score + letter grade. Pure.
import type { GameState } from '../game/types';
import { SCORING } from '../game/Balance';
import { clamp } from '../lib/math';

export interface ScoreResult {
  score: number;
  grade: string;
  parts: Record<string, number>;
}

export function computeScore(s: GameState): ScoreResult {
  const m = s.meters;
  const st = s.stats;
  const w = SCORING.weights;
  const norm = (v: number, cap: number) => clamp(v / cap, 0, 1);

  const parts: Record<string, number> = {
    hematotoxicity: Math.round(
      norm(100 - (m.hematotoxicity * 0.6 + st.peakHematotoxicity * 0.4), 100) * w.hematotoxicity,
    ),
    burden: Math.round(norm(100 - m.burden, 100) * w.burden),
    fitness: Math.round(norm(st.lowestFitness, 100) * w.fitness),
    crs: Math.round(norm(100 - st.peakCrs, 100) * w.crs),
    neuro: Math.round(norm(100 - st.peakNeuro, 100) * w.neuro),
    kills: Math.round(norm(st.kills, SCORING.caps.kills) * w.kills),
    currency: Math.round(norm(s.currency, SCORING.caps.currency) * w.currency),
    time: Math.round(norm(SCORING.timeTarget - st.time, SCORING.timeTarget) * w.time),
    precision:
      m.fitness <= 0 || m.crs >= 100 || m.neuro >= 100 || m.hyperinflammation >= 100
        ? 0
        : Math.round(norm(10 - st.escapes, 10) * w.precision),
  };

  let score = 0;
  for (const k in parts) score += parts[k];

  let grade = 'C';
  for (const [th, g] of SCORING.grades) {
    if (score >= th) {
      grade = g;
      break;
    }
  }
  if (s.phase === 'lost' && (grade === 'S' || grade === 'A' || grade === 'B')) grade = 'C';

  return { score, grade, parts };
}
