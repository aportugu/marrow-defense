// Composite game score + explicitly simulated IMWG-inspired response. Pure.
import type { GameState, ResponseCategory } from '../game/types';
import { SCORING } from '../game/Balance';
import { LEVELS } from '../data/levels';
import { clamp } from '../lib/math';

export interface ScoreResult {
  score: number;
  response: ResponseDefinition;
  parts: Record<string, number>;
}

export interface ResponseDefinition {
  id: ResponseCategory;
  fullName: string;
  rank: number;
  description: string;
  style: 'scr' | 'cr' | 'vgpr' | 'pr' | 'sd' | 'pd';
}

export const RESPONSE_META: Record<ResponseCategory, ResponseDefinition> = {
  sCR: { id: 'sCR', fullName: 'Stringent complete response', rank: 5, description: 'Exceptional disease control and treatment management.', style: 'scr' },
  CR: { id: 'CR', fullName: 'Complete response', rank: 4, description: 'Excellent disease control with strong treatment management.', style: 'cr' },
  VGPR: { id: 'VGPR', fullName: 'Very good partial response', rank: 3, description: 'Deep disease reduction with manageable treatment effects.', style: 'vgpr' },
  PR: { id: 'PR', fullName: 'Partial response', rank: 2, description: 'Meaningful disease reduction with room to improve control.', style: 'pr' },
  SD: { id: 'SD', fullName: 'Stable disease', rank: 1, description: 'Disease was contained without a deeper simulated response.', style: 'sd' },
  PD: { id: 'PD', fullName: 'Progressive disease', rank: 0, description: 'Disease control was not sustained.', style: 'pd' },
};

export function responseForScore(score: number): ResponseDefinition {
  const category = SCORING.responses.find(([threshold]) => score >= threshold)?.[1] ?? 'PD';
  return RESPONSE_META[category];
}

export function computeScore(s: GameState): ScoreResult {
  const m = s.meters;
  const st = s.stats;
  const w = SCORING.weights;
  const level = LEVELS[s.level];
  const norm = (v: number, cap: number) => clamp(v / cap, 0, 1);
  const diseaseBurden = s.level === 'cns' ? m.burden * .45 + m.cnsBurden * .55 : m.burden;

  const parts: Record<string, number> = {
    hematotoxicity: Math.round(
      norm(100 - (m.hematotoxicity * 0.6 + st.peakHematotoxicity * 0.4), 100) * w.hematotoxicity,
    ),
    burden: Math.round(norm(100 - diseaseBurden, 100) * w.burden),
    fitness: Math.round(norm(st.lowestFitness, 100) * w.fitness),
    crs: Math.round(norm(100 - st.peakCrs, 100) * w.crs),
    neuro: Math.round(norm(100 - st.peakNeuro, 100) * w.neuro),
    kills: Math.round(norm(st.kills, level.scoreKillTarget) * w.kills),
    currency: Math.round(norm(s.currency, SCORING.caps.currency) * w.currency),
    time: Math.round(norm(level.scoreTimeTarget - st.time, level.scoreTimeTarget) * w.time),
    precision:
      m.fitness <= 0 || m.crs >= 100 || m.neuro >= 100 || m.hyperinflammation >= 100 || m.cnsBurden >= 100
        ? 0
        : Math.round(norm(10 - st.escapes, 10) * w.precision),
  };

  let score = 0;
  for (const k in parts) score += parts[k];

  let response = responseForScore(score);
  if (s.bossEscaped) response = RESPONSE_META.PD;
  else if (s.phase === 'lost' && response.rank > RESPONSE_META.SD.rank) response = RESPONSE_META.SD;

  return { score, response, parts };
}
