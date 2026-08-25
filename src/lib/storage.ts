// LocalStorage-backed settings + high score. Guarded so the module is importable
// in non-browser (test) environments.
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
    speed: 1,
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
