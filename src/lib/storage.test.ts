import { afterEach, describe, expect, it } from 'vitest';
import { defaultProgress, isBetterResult, loadProgress, loadSettings, saveProgress, saveSettings } from './storage';

class MemoryStorage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe('audio settings persistence', () => {
  afterEach(() => Reflect.deleteProperty(globalThis, 'localStorage'));

  it('defaults new players to 3x speed', () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    expect(loadSettings().speed).toBe(3);
  });

  it('migrates the legacy shared volume into independent controls', () => {
    const storage = new MemoryStorage();
    storage.setItem('marrow-defense:settings', JSON.stringify({ volume: 0.35, music: false }));
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const settings = loadSettings();
    expect(settings.musicVolume).toBe(0.35);
    expect(settings.sfxVolume).toBe(0.35);
    expect(settings.music).toBe(false);
    expect(settings).not.toHaveProperty('volume');
    expect(settings).not.toHaveProperty('learningCards');
  });

  it('saves only the new independent volume fields', () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    saveSettings({
      sound: true, music: true, musicVolume: 0.2, sfxVolume: 0.85,
      speed: 1, reducedMotion: false, tutorialSeen: true,
    });
    const raw = storage.getItem('marrow-defense:settings')!;
    expect(JSON.parse(raw)).toMatchObject({ musicVolume: 0.2, sfxVolume: 0.85 });
    expect(JSON.parse(raw)).not.toHaveProperty('volume');
  });

  it('discards obsolete learning-card storage data', () => {
    const storage = new MemoryStorage();
    storage.setItem('marrow-defense:settings', JSON.stringify({ learningCards: false, tutorialSeen: true }));
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const settings = loadSettings();
    expect(settings).not.toHaveProperty('learningCards');
    saveSettings(settings);
    expect(JSON.parse(storage.getItem('marrow-defense:settings')!)).not.toHaveProperty('learningCards');
  });
});

describe('level response persistence', () => {
  afterEach(() => Reflect.deleteProperty(globalThis, 'localStorage'));

  it('migrates numeric level bests to response records', () => {
    const storage = new MemoryStorage();
    storage.setItem('marrow-defense:progress', JSON.stringify({
      cleared: { marrow: true, liver: false, cns: false },
      best: { marrow: 760, liver: 300 },
    }));
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    expect(loadProgress()).toEqual({
      cleared: { marrow: true, liver: false, cns: false },
      best: {
        marrow: { score: 760, response: 'CR' },
        liver: { score: 300, response: 'SD' },
        cns: null,
      },
    });
  });

  it('round-trips response records and sanitizes invalid best data', () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const progress = defaultProgress();
    progress.best.marrow = { score: 684, response: 'VGPR' };
    saveProgress(progress);
    expect(loadProgress().best.marrow).toEqual({ score: 684, response: 'VGPR' });

    storage.setItem('marrow-defense:progress', JSON.stringify({ best: { marrow: 'bad', liver: { score: -2 } } }));
    expect(loadProgress().best).toEqual({ marrow: null, liver: null, cns: null });
  });

  it('ranks response before score and score within an equal response', () => {
    expect(isBetterResult({ score: 500, response: 'PR' }, { score: 800, response: 'SD' })).toBe(true);
    expect(isBetterResult({ score: 700, response: 'VGPR' }, { score: 680, response: 'VGPR' })).toBe(true);
    expect(isBetterResult({ score: 650, response: 'VGPR' }, { score: 680, response: 'VGPR' })).toBe(false);
  });
});
