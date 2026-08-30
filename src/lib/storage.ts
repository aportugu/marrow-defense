// LocalStorage-backed settings + progress. Guarded so the module is importable
// in non-browser (test) environments.
import type { LevelId, ResponseCategory } from '../game/types';
import { RESPONSE_META, responseForScore } from '../systems/ScoringSystem';

export interface BestResult {
  score: number;
  response: ResponseCategory;
}

export interface Progress {
  cleared: Record<LevelId, boolean>;
  best: Record<LevelId, BestResult | null>;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  musicVolume: number;
  sfxVolume: number;
  speed: number;
  reducedMotion: boolean;
  tutorialSeen: boolean;
}

const SETTINGS_KEY = 'marrow-defense:settings';
const SCORE_KEY = 'marrow-defense:highscore';
const PROGRESS_KEY = 'marrow-defense:progress';

function hasLS(): boolean {
  return typeof globalThis !== 'undefined' && typeof (globalThis as { localStorage?: Storage }).localStorage !== 'undefined';
}

export function loadSettings(): Settings {
  const prefersReduced =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const def: Settings = {
    sound: true,
    music: true,
    musicVolume: 0.6,
    sfxVolume: 0.6,
    speed: 3,
    reducedMotion: prefersReduced,
    tutorialSeen: false,
  };
  if (!hasLS()) return def;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Settings> & { volume?: number };
      const legacyVolume = typeof stored.volume === 'number' ? stored.volume : undefined;
      return {
        sound: typeof stored.sound === 'boolean' ? stored.sound : def.sound,
        music: typeof stored.music === 'boolean' ? stored.music : def.music,
        musicVolume: stored.musicVolume ?? legacyVolume ?? def.musicVolume,
        sfxVolume: stored.sfxVolume ?? legacyVolume ?? def.sfxVolume,
        speed: typeof stored.speed === 'number' ? stored.speed : def.speed,
        reducedMotion: typeof stored.reducedMotion === 'boolean' ? stored.reducedMotion : def.reducedMotion,
        tutorialSeen: typeof stored.tutorialSeen === 'boolean' ? stored.tutorialSeen : def.tutorialSeen,
      };
    }
  } catch {
    /* ignore */
  }
  return def;
}

export function saveSettings(s: Settings): void {
  if (!hasLS()) return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadHighScore(): number {
  if (!hasLS()) return 0;
  try {
    const raw = localStorage.getItem(SCORE_KEY);
    if (raw) return Number(raw) || 0;
  } catch {
    /* ignore */
  }
  return 0;
}

export function saveHighScore(n: number): number {
  const cur = loadHighScore();
  if (n > cur && hasLS()) {
    try {
      localStorage.setItem(SCORE_KEY, String(n));
    } catch {
      /* ignore */
    }
  }
  return Math.max(cur, n);
}

export function defaultProgress(): Progress {
  return {
    cleared: { marrow: false, liver: false, cns: false },
    best: { marrow: null, liver: null, cns: null },
  };
}

function isResponseCategory(value: unknown): value is ResponseCategory {
  return typeof value === 'string' && Object.hasOwn(RESPONSE_META, value);
}

function normalizeBest(value: unknown): BestResult | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const score = Math.max(0, Math.round(value));
    return { score, response: responseForScore(score).id };
  }
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<BestResult>;
  if (typeof stored.score !== 'number' || !Number.isFinite(stored.score) || stored.score < 0) return null;
  const score = Math.round(stored.score);
  return {
    score,
    response: isResponseCategory(stored.response) ? stored.response : responseForScore(score).id,
  };
}

export function isBetterResult(candidate: BestResult, current: BestResult | null): boolean {
  if (!current) return true;
  const candidateRank = RESPONSE_META[candidate.response].rank;
  const currentRank = RESPONSE_META[current.response].rank;
  return candidateRank > currentRank || (candidateRank === currentRank && candidate.score > current.score);
}

export function loadProgress(): Progress {
  const def = defaultProgress();
  if (!hasLS()) return def;
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<Progress> & { best?: Partial<Record<LevelId, unknown>> };
      const storedBest = stored.best ?? def.best;
      return {
        cleared: {
          marrow: stored.cleared?.marrow === true,
          liver: stored.cleared?.liver === true,
          cns: stored.cleared?.cns === true,
        },
        best: {
          marrow: normalizeBest(storedBest.marrow),
          liver: normalizeBest(storedBest.liver),
          cns: normalizeBest(storedBest.cns),
        },
      };
    }
  } catch {
    /* ignore */
  }
  return def;
}

export function saveProgress(p: Progress): Progress {
  const next: Progress = {
    cleared: {
      marrow: p.cleared.marrow || false,
      liver: p.cleared.liver || false,
      cns: p.cleared.cns || false,
    },
    best: {
      marrow: normalizeBest(p.best.marrow),
      liver: normalizeBest(p.best.liver),
      cns: normalizeBest(p.best.cns),
    },
  };
  if (!hasLS()) return next;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
