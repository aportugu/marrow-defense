import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARRANGEMENTS, DUCK_GAIN, DUCK_SECONDS, Music, VOICE_LIMIT,
  nextBarStep, noteFrequency, resolveMusicScene, smoothIntensity, variationIndex,
  type MusicSnapshot,
} from './Music';
import { INTRO_BPM, INTRO_LOOP_SECONDS, INTRO_SCENE_SECONDS } from '../lib/introTiming';

const snapshot = (overrides: Partial<MusicSnapshot> = {}): MusicSnapshot => ({
  scene: 'wave', wave: 4, intensity: 0.5, crs: 20, neuro: 10,
  hematotoxicity: 20, fitness: 75, leakHeat: 0, ...overrides,
});

describe('adaptive score composition', () => {
  it('defines every scene with valid 32-step sections and orders', () => {
    expect(Object.keys(ARRANGEMENTS)).toEqual([
      'menu', 'planning', 'wave', 'danger', 'iecHs', 'paused', 'victory', 'loss',
    ]);
    for (const arrangement of Object.values(ARRANGEMENTS)) {
      expect(arrangement.bpm).toBeGreaterThan(0);
      for (const index of arrangement.order) expect(arrangement.sections[index]).toBeTruthy();
      for (const section of arrangement.sections) {
        for (const layer of ['bass', 'lead', 'counter', 'arp', 'kick', 'snare', 'hat', 'texture'] as const) {
          expect(section[layer]).toHaveLength(32);
        }
        if (section.brass) expect(section.brass).toHaveLength(32);
        for (const chord of section.chords) {
          expect(chord.length).toBeGreaterThan(0);
          for (const note of chord) expect(noteFrequency(note)).toBeGreaterThan(0);
        }
        for (const layer of ['bass', 'lead', 'counter', 'arp', 'brass'] as const) {
          if (!section[layer]) continue;
          for (const note of section[layer]) if (note) expect(noteFrequency(note)).toBeGreaterThan(0);
        }
        for (const layer of ['kick', 'snare', 'hat', 'texture'] as const) {
          for (const hit of section[layer]) expect([null, 'x', 'o']).toContain(hit);
        }
      }
    }
    expect(ARRANGEMENTS.menu.bpm).toBe(72);
    expect(ARRANGEMENTS.menu.sections).toHaveLength(3);
    expect(ARRANGEMENTS.menu.sections.every((section) => section.brass?.some(Boolean))).toBe(true);
    expect(ARRANGEMENTS.menu.sections.every((section) => section.lead.some(Boolean))).toBe(true);
    expect(ARRANGEMENTS.menu.sections.every((section) =>
      section.kick.some(Boolean) && section.snare.some(Boolean) && section.hat.some(Boolean),
    )).toBe(true);
    expect(ARRANGEMENTS.menu.order).toEqual([0, 0, 1, 0, 2]);
    expect(ARRANGEMENTS.paused.bpm).toBe(72);
    expect(ARRANGEMENTS.paused.sections).toHaveLength(3);
    expect(ARRANGEMENTS.paused.sections.every((section) =>
      !section.snare.some(Boolean) && !section.hat.some(Boolean),
    )).toBe(true);
    expect(ARRANGEMENTS.paused.density).toBeLessThan(ARRANGEMENTS.menu.density);
    expect(ARRANGEMENTS.planning.bpm).toBe(92);
    expect(ARRANGEMENTS.wave.bpm).toBe(118);
    expect(ARRANGEMENTS.danger.bpm).toBe(118);
  });

  it('keeps the title tempo absolute while adding drum and melody layers', () => {
    expect(ARRANGEMENTS.menu.bpm).toBe(INTRO_BPM);
    expect(ARRANGEMENTS.menu.order).toHaveLength(5);
    expect(INTRO_SCENE_SECONDS).toBeCloseTo(60 / 72 * 8);
    expect(INTRO_LOOP_SECONDS).toBeCloseTo(INTRO_SCENE_SECONDS * 5);
    expect(ARRANGEMENTS.menu.sections.every((section) => section.lead.filter(Boolean).length >= 8)).toBe(true);
    expect(ARRANGEMENTS.menu.sections.every((section) =>
      section.kick.some(Boolean) && section.snare.some(Boolean) && section.hat.some(Boolean),
    )).toBe(true);
  });

  it('converts notes, prioritizes scenes, and varies 32 bars deterministically', () => {
    expect(noteFrequency('A4')).toBeCloseTo(440, 6);
    expect(noteFrequency('C4')).toBeCloseTo(261.626, 2);
    expect(noteFrequency('G#3')).toBeCloseTo(207.652, 2);
    expect(noteFrequency('nope')).toBe(0);
    expect(resolveMusicScene(snapshot({ scene: 'iecHs', crs: 20 }))).toBe('iecHs');
    expect(resolveMusicScene(snapshot({ crs: 65 }))).toBe('danger');
    expect(resolveMusicScene(snapshot({ hematotoxicity: 65 }))).toBe('danger');
    expect(resolveMusicScene(snapshot({ fitness: 30 }))).toBe('danger');
    expect(resolveMusicScene(snapshot({ scene: 'planning' }))).toBe('planning');
    expect(resolveMusicScene(snapshot({ scene: 'paused', crs: 100 }))).toBe('paused');
    expect(new Set(Array.from({ length: 32 }, (_, bar) => variationIndex(bar))).size).toBe(32);
    expect(variationIndex(32)).toBe(variationIndex(0));
  });

  it('quantizes bars, smooths intensity, and uses restrained bounded mixing', () => {
    expect(nextBarStep(0)).toBe(0);
    expect(nextBarStep(1)).toBe(16);
    expect(nextBarStep(16)).toBe(16);
    expect(nextBarStep(31)).toBe(32);
    expect(DUCK_GAIN).toBe(0.65);
    expect(DUCK_SECONDS).toBe(0.35);
    expect(VOICE_LIMIT).toBeLessThanOrEqual(48);
    expect(smoothIntensity(0, 1)).toBeCloseTo(0.04);
    expect(smoothIntensity(1, -1)).toBeCloseTo(0.96);
    expect(smoothIntensity(0, 2, 2)).toBe(1);
  });
});

class FakeParam {
  value = 0;
  cancelScheduledValues = vi.fn(); setTargetAtTime = vi.fn(); setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn(); exponentialRampToValueAtTime = vi.fn();
}
class FakeNode {
  gain = new FakeParam(); frequency = new FakeParam(); detune = new FakeParam(); pan = new FakeParam();
  Q = new FakeParam(); delayTime = new FakeParam(); threshold = new FakeParam(); knee = new FakeParam();
  ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam();
  buffer: unknown = null; type = ''; onended: (() => void) | null = null;
  connect = vi.fn(() => this); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
  getChannelData(): Float32Array { return new Float32Array(8); }
}
class FakeAudioContext {
  currentTime = 1; sampleRate = 8; state = 'running'; destination = new FakeNode();
  close = vi.fn(async () => undefined); resume = vi.fn(async () => undefined);
  createGain = (): GainNode => new FakeNode() as unknown as GainNode;
  createDynamicsCompressor = (): DynamicsCompressorNode => new FakeNode() as unknown as DynamicsCompressorNode;
  createConvolver = (): ConvolverNode => new FakeNode() as unknown as ConvolverNode;
  createDelay = (): DelayNode => new FakeNode() as unknown as DelayNode;
  createBiquadFilter = (): BiquadFilterNode => new FakeNode() as unknown as BiquadFilterNode;
  createStereoPanner = (): StereoPannerNode => new FakeNode() as unknown as StereoPannerNode;
  createOscillator = (): OscillatorNode => new FakeNode() as unknown as OscillatorNode;
  createBufferSource = (): AudioBufferSourceNode => new FakeNode() as unknown as AudioBufferSourceNode;
  createBuffer = (): AudioBuffer => new FakeNode() as unknown as AudioBuffer;
}

describe('music lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'AudioContext');
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('queues normal scene changes, starts stingers, and disposes cleanly', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    music.applySettings({ sound: true, music: true, musicVolume: 0.7, sfxVolume: 0.4, speed: 1, reducedMotion: false, tutorialSeen: true });
    music.unlock();
    expect(vi.getTimerCount()).toBe(1);
    music.update(snapshot({ scene: 'wave' }));
    expect(music.queuedScene).toBe('wave');
    music.trigger('toci');
    expect(music.activeVoiceCount).toBeGreaterThan(0);
    music.trigger('introBattle');
    expect(music.activeVoiceCount).toBeGreaterThan(1);
    music.restartMenu();
    expect(music.currentScene).toBe('menu');
    expect(music.currentStep).toBe(0);
    music.dispose();
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(music.activeVoiceCount).toBe(0);
  });

  it('resumes an existing suspended context when unlocked again', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext {
        constructor() { super(); this.state = 'suspended'; contexts.push(this); }
      },
    });
    const music = new Music();
    music.unlock();
    music.unlock();
    expect(contexts[0].resume).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    music.dispose();
  });
});
