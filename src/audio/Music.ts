// Adaptive, asset-free biological synthwave score. Composition data is pure and
// validated in tests; WebAudio is created only after a user gesture.
import type { Settings } from '../lib/storage';
import { INTRO_BPM } from '../lib/introTiming';

export type MusicScene =
  | 'menu'
  | 'planning'
  | 'wave'
  | 'danger'
  | 'iecHs'
  | 'paused'
  | 'victory'
  | 'loss';

export type MusicEvent =
  | 'waveStart'
  | 'waveClear'
  | 'leak'
  | 'warning'
  | 'toci'
  | 'dexa'
  | 'stemcell'
  | 'iecHsOnset'
  | 'anakinra'
  | 'gcsf'
  | 'introCollection'
  | 'introActivation'
  | 'introEngineering'
  | 'introExpansion'
  | 'introInfusion'
  | 'introBattle'
  | 'victory'
  | 'loss';

export interface MusicSnapshot {
  scene: MusicScene;
  wave: number;
  intensity: number;
  crs: number;
  neuro: number;
  hematotoxicity: number;
  fitness: number;
  leakHeat: number;
}

export type Pattern = ReadonlyArray<string | null>;
export type DrumPattern = ReadonlyArray<'x' | 'o' | null>;
export type Chord = ReadonlyArray<string>;

export interface ArrangementSection {
  name: string;
  chords: ReadonlyArray<Chord>;
  bass: Pattern;
  lead: Pattern;
  counter: Pattern;
  arp: Pattern;
  brass?: Pattern;
  kick: DrumPattern;
  snare: DrumPattern;
  hat: DrumPattern;
  texture: DrumPattern;
}

export interface SceneArrangement {
  bpm: number;
  order: ReadonlyArray<number>;
  sections: ReadonlyArray<ArrangementSection>;
  density: number;
  brightness: number;
}

export interface VoiceDefinition {
  attack: number;
  release: number;
  cutoff: number;
  resonance: number;
  gain: number;
}

type Layer = 'bass' | 'pad' | 'lead' | 'counter' | 'arp' | 'brass' | 'drums' | 'texture';

export const VOICE_LIMIT = 48;
export const DUCK_GAIN = 0.65;
export const DUCK_SECONDS = 0.35;
const STEPS_PER_BAR = 16;
const STEPS_PER_PHRASE = 32;
const LOOKAHEAD = 0.14;

const pattern = (entries: Record<number, string>): Pattern =>
  Array.from({ length: STEPS_PER_PHRASE }, (_, i) => entries[i] ?? null);
const drums = (entries: Record<number, 'x' | 'o'>): DrumPattern =>
  Array.from({ length: STEPS_PER_PHRASE }, (_, i) => entries[i] ?? null);
const chord = (...notes: string[]): Chord => notes;

const KICK = drums({ 0: 'o', 4: 'x', 8: 'o', 12: 'x', 16: 'o', 20: 'x', 24: 'o', 28: 'x' });
const SNARE = drums({ 4: 'o', 12: 'o', 20: 'o', 28: 'o' });
const HATS = drums({ 2: 'x', 6: 'x', 10: 'x', 14: 'o', 18: 'x', 22: 'x', 26: 'x', 30: 'o' });
const EMPTY_DRUMS = drums({});
const TEXTURE = drums({ 0: 'x', 8: 'x', 16: 'x', 24: 'x' });

const planningMain: ArrangementSection = {
  name: 'cellular-drift',
  chords: [
    chord('A2', 'E3', 'A3', 'B3', 'C4'), chord('F2', 'C3', 'E3', 'A3'),
    chord('C3', 'G3', 'B3', 'E4'), chord('G2', 'D3', 'E3', 'B3'),
  ],
  bass: pattern({ 0: 'A2', 8: 'F2', 16: 'C3', 24: 'G2' }),
  lead: pattern({ 3: 'A4', 6: 'C5', 9: 'E5', 12: 'B4', 18: 'G4', 21: 'A4', 25: 'C5', 29: 'E5' }),
  counter: pattern({ 7: 'E4', 15: 'C4', 23: 'B3', 31: 'D4' }),
  arp: pattern({ 2: 'E4', 5: 'A4', 10: 'C5', 13: 'E5', 18: 'G4', 21: 'B4', 26: 'D5', 29: 'G5' }),
  kick: EMPTY_DRUMS, snare: EMPTY_DRUMS, hat: EMPTY_DRUMS, texture: TEXTURE,
};

const planningLift: ArrangementSection = {
  ...planningMain,
  name: 'mitotic-lift',
  lead: pattern({ 0: 'A4', 3: 'C5', 6: 'E5', 10: 'A5', 13: 'E5', 16: 'G4', 19: 'A4', 22: 'C5', 26: 'E5', 30: 'B4' }),
  counter: pattern({ 4: 'E4', 12: 'A4', 20: 'G4', 28: 'D4' }),
};

// The title screen develops like a compact film cue: suspended opening,
// low orchestral pulse, heroic statement, then a luminous release.
const cinematicOpening: ArrangementSection = {
  name: 'marrow-awakening',
  chords: [
    chord('A1', 'E2', 'A2', 'B2', 'C3', 'E3'), chord('F1', 'C2', 'E2', 'A2', 'C3'),
    chord('C2', 'G2', 'B2', 'E3', 'G3'), chord('G1', 'D2', 'E2', 'B2', 'D3'),
  ],
  bass: pattern({ 0: 'A1', 16: 'C2', 24: 'G1' }),
  lead: pattern({ 2: 'A4', 6: 'C5', 10: 'E5', 14: 'B4', 18: 'A4', 22: 'C5', 26: 'E5', 30: 'G5' }),
  counter: pattern({ 12: 'E4', 20: 'G4', 28: 'D4' }),
  arp: pattern({ 5: 'E4', 13: 'B4', 21: 'G4', 29: 'D5' }),
  brass: pattern({ 0: 'A2', 16: 'C3', 24: 'G2' }),
  kick: drums({ 0: 'o', 8: 'x', 16: 'o', 24: 'x' }),
  snare: drums({ 12: 'x', 28: 'x' }),
  hat: drums({ 6: 'x', 14: 'x', 22: 'x', 30: 'o' }),
  texture: drums({ 0: 'o', 8: 'x', 16: 'o', 24: 'x' }),
};

const cinematicAscent: ArrangementSection = {
  ...cinematicOpening,
  name: 'engineered-ascent',
  bass: pattern({ 0: 'A1', 8: 'A2', 16: 'F1', 24: 'G1', 28: 'G2' }),
  lead: pattern({ 0: 'A4', 3: 'C5', 6: 'E5', 10: 'A5', 14: 'E5', 17: 'G4', 20: 'A4', 23: 'C5', 27: 'E5', 30: 'B4' }),
  counter: pattern({ 4: 'E4', 12: 'A4', 20: 'G4', 28: 'D4' }),
  arp: pattern({ 2: 'A4', 6: 'E5', 10: 'C5', 14: 'E5', 18: 'G4', 22: 'C5', 26: 'D5', 30: 'B4' }),
  brass: pattern({ 0: 'A2', 8: 'E3', 16: 'F2', 24: 'G2', 28: 'B2' }),
  kick: drums({ 0: 'o', 8: 'x', 16: 'o', 24: 'x', 30: 'x' }),
  snare: drums({ 4: 'o', 12: 'o', 20: 'o', 28: 'o' }),
  hat: drums({ 2: 'x', 6: 'x', 10: 'x', 14: 'o', 18: 'x', 22: 'x', 26: 'x', 30: 'o' }),
};

const cinematicResolve: ArrangementSection = {
  ...cinematicOpening,
  name: 'infusion-horizon',
  chords: [
    chord('F1', 'C2', 'F2', 'A2', 'C3', 'E3'), chord('G1', 'D2', 'G2', 'B2', 'E3'),
    chord('A1', 'E2', 'A2', 'C3', 'E3'), chord('A1', 'E2', 'B2', 'C3', 'E3'),
  ],
  bass: pattern({ 0: 'F1', 8: 'G1', 16: 'A1', 24: 'A2' }),
  lead: pattern({ 2: 'C5', 6: 'E5', 10: 'G5', 14: 'B5', 18: 'A5', 22: 'E5', 26: 'C5', 30: 'A4' }),
  counter: pattern({ 4: 'A4', 12: 'B4', 20: 'E4', 28: 'B3' }),
  brass: pattern({ 0: 'F2', 8: 'G2', 16: 'A2', 24: 'E3' }),
  kick: drums({ 0: 'o', 8: 'x', 16: 'o', 20: 'x', 24: 'o' }),
  snare: drums({ 4: 'o', 12: 'o', 20: 'o', 28: 'o' }),
  hat: drums({ 2: 'x', 6: 'x', 10: 'x', 14: 'o', 18: 'x', 22: 'x', 26: 'x', 30: 'o' }),
};

const pausedOpening: ArrangementSection = {
  ...cinematicOpening,
  lead: pattern({ 6: 'A4', 10: 'C5', 14: 'E5', 22: 'B4', 27: 'C5', 30: 'E5' }),
  kick: drums({ 0: 'o', 16: 'o' }), snare: EMPTY_DRUMS, hat: EMPTY_DRUMS,
};
const pausedAscent: ArrangementSection = {
  ...cinematicAscent,
  kick: drums({ 0: 'o', 8: 'x', 16: 'o', 24: 'x', 30: 'x' }),
  snare: EMPTY_DRUMS,
  hat: EMPTY_DRUMS,
};
const pausedResolve: ArrangementSection = {
  ...cinematicResolve,
  kick: drums({ 0: 'o', 8: 'x', 16: 'o', 20: 'x', 24: 'o' }),
  snare: EMPTY_DRUMS,
  hat: EMPTY_DRUMS,
};

const waveMain: ArrangementSection = {
  name: 'infusion-drive',
  chords: [
    chord('A2', 'E3', 'A3', 'C4'), chord('F2', 'C3', 'F3', 'A3'),
    chord('D3', 'A3', 'C4', 'F4'), chord('E2', 'B2', 'E3', 'G#3'),
  ],
  bass: pattern({ 0: 'A2', 3: 'A2', 6: 'E3', 8: 'F2', 11: 'F2', 14: 'C3', 16: 'D3', 19: 'A2', 22: 'D3', 24: 'E2', 27: 'B2', 30: 'E3' }),
  lead: pattern({ 0: 'A4', 2: 'C5', 5: 'E5', 7: 'B4', 10: 'A4', 13: 'C5', 16: 'G4', 18: 'A4', 21: 'C5', 23: 'E5', 26: 'D5', 29: 'B4', 31: 'E5' }),
  counter: pattern({ 4: 'E4', 12: 'F4', 20: 'A4', 28: 'G#4' }),
  arp: pattern({ 1: 'A4', 3: 'E5', 5: 'C5', 7: 'E5', 9: 'A4', 11: 'C5', 13: 'F5', 15: 'C5', 17: 'A4', 19: 'D5', 21: 'F5', 23: 'A5', 25: 'B4', 27: 'E5', 29: 'G#5', 31: 'B5' }),
  kick: KICK, snare: SNARE, hat: HATS, texture: TEXTURE,
};

const waveLift: ArrangementSection = {
  ...waveMain,
  name: 'clonal-pressure',
  lead: pattern({ 0: 'A5', 2: 'E5', 4: 'C5', 6: 'B4', 8: 'A4', 10: 'C5', 12: 'E5', 14: 'A5', 16: 'G5', 18: 'E5', 20: 'C5', 22: 'A4', 24: 'B4', 26: 'D5', 28: 'E5', 30: 'G#5' }),
  hat: drums({ ...Object.fromEntries(HATS.map((v, i) => v ? [i, v] : null).filter(Boolean) as [number, 'x' | 'o'][]), 1: 'x', 5: 'x', 9: 'x', 13: 'x', 17: 'x', 21: 'x', 25: 'x', 29: 'x' }),
};

const danger: ArrangementSection = {
  ...waveMain,
  name: 'cytokine-threshold',
  chords: [
    chord('E2', 'B2', 'E3', 'F3'), chord('E2', 'C3', 'E3', 'A#3'),
    chord('E2', 'A2', 'D3', 'F3'), chord('E2', 'B2', 'D3', 'G#3'),
  ],
  bass: pattern({ 0: 'E2', 2: 'E2', 4: 'E2', 6: 'E2', 8: 'E2', 10: 'E2', 12: 'E2', 14: 'E2', 16: 'E2', 18: 'E2', 20: 'E2', 22: 'E2', 24: 'E2', 26: 'E2', 28: 'E2', 30: 'E2' }),
  lead: pattern({ 0: 'E5', 1: 'F5', 4: 'B4', 6: 'A#4', 8: 'E5', 9: 'F5', 12: 'D5', 14: 'E5', 16: 'E5', 17: 'F5', 20: 'A5', 22: 'A#5', 24: 'G#5', 26: 'F5', 28: 'E5', 31: 'B4' }),
  kick: drums({ 0: 'o', 3: 'x', 6: 'x', 8: 'o', 11: 'x', 14: 'x', 16: 'o', 19: 'x', 22: 'x', 24: 'o', 27: 'x', 30: 'x' }),
};

const iecHs: ArrangementSection = {
  ...danger,
  name: 'macrophage-cascade',
  chords: [
    chord('E2', 'B2', 'F3', 'A3'), chord('E2', 'C3', 'F3', 'A#3'),
    chord('E2', 'A2', 'D3', 'F3'), chord('E2', 'B2', 'D3', 'G#3'),
  ],
  lead: pattern({ 0: 'E5', 3: 'B4', 7: 'F5', 10: 'E5', 15: 'D5', 16: 'E5', 19: 'A#4', 23: 'F5', 26: 'D5', 31: 'E5' }),
  counter: pattern({ 5: 'F4', 13: 'D4', 21: 'A#4', 29: 'G#4' }),
  hat: drums({ 2: 'x', 6: 'x', 14: 'o', 18: 'x', 22: 'x', 30: 'o' }),
  texture: drums({ 0: 'o', 4: 'x', 8: 'o', 12: 'x', 16: 'o', 20: 'x', 24: 'o', 28: 'x' }),
};

const victory: ArrangementSection = {
  ...planningLift,
  name: 'marrow-recovery',
  chords: [chord('A2', 'E3', 'A3', 'C4'), chord('F2', 'C3', 'A3'), chord('C3', 'G3', 'E4'), chord('A2', 'E3', 'B3', 'C4')],
  lead: pattern({ 0: 'A4', 3: 'C5', 6: 'E5', 9: 'A5', 14: 'E5', 18: 'G5', 22: 'E5', 26: 'C5', 30: 'A5' }),
};

const loss: ArrangementSection = {
  ...planningMain,
  name: 'failed-infusion',
  chords: [chord('A2', 'C3', 'E3'), chord('F2', 'A2', 'C3'), chord('D2', 'F2', 'A2'), chord('E2', 'F2', 'B2')],
  lead: pattern({ 0: 'E5', 5: 'C5', 10: 'A4', 16: 'G4', 22: 'F4', 28: 'E4' }),
  bass: pattern({ 0: 'A2', 16: 'D3', 24: 'E2' }),
  counter: pattern({ 8: 'B3', 24: 'A3' }),
  arp: pattern({ 3: 'A4', 11: 'E5', 19: 'A4', 27: 'B4' }),
  kick: EMPTY_DRUMS,
  snare: EMPTY_DRUMS,
  hat: drums({ 7: 'x', 15: 'o', 23: 'x', 31: 'o' }),
};

export const ARRANGEMENTS: Record<MusicScene, SceneArrangement> = {
  menu: { bpm: INTRO_BPM, order: [0, 0, 1, 0, 2], sections: [cinematicOpening, cinematicAscent, cinematicResolve], density: 0.82, brightness: 0.8 },
  planning: { bpm: 92, order: [0, 1], sections: [planningMain, planningLift], density: 0.55, brightness: 0.7 },
  wave: { bpm: 118, order: [0, 0, 1, 0], sections: [waveMain, waveLift], density: 0.82, brightness: 0.78 },
  danger: { bpm: 118, order: [0], sections: [danger], density: 1, brightness: 0.92 },
  iecHs: { bpm: 118, order: [0], sections: [iecHs], density: 0.94, brightness: 0.58 },
  paused: { bpm: 72, order: [0, 1, 0, 2], sections: [pausedOpening, pausedAscent, pausedResolve], density: 0.58, brightness: 0.62 },
  victory: { bpm: 92, order: [0], sections: [victory], density: 0.62, brightness: 0.82 },
  loss: { bpm: 76, order: [0], sections: [loss], density: 0.28, brightness: 0.25 },
};

export const VOICES: Record<Exclude<Layer, 'drums' | 'texture'>, VoiceDefinition> = {
  bass: { attack: 0.012, release: 0.22, cutoff: 720, resonance: 2.5, gain: 0.17 },
  pad: { attack: 0.22, release: 0.8, cutoff: 1800, resonance: 1.2, gain: 0.045 },
  lead: { attack: 0.018, release: 0.24, cutoff: 3200, resonance: 3.2, gain: 0.085 },
  counter: { attack: 0.025, release: 0.32, cutoff: 4200, resonance: 1.4, gain: 0.055 },
  arp: { attack: 0.006, release: 0.12, cutoff: 5200, resonance: 4, gain: 0.052 },
  brass: { attack: 0.08, release: 0.65, cutoff: 2100, resonance: 2.1, gain: 0.062 },
};

export function noteFrequency(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!match) return 0;
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pitch = semitones[match[1]];
  if (match[2] === '#') pitch += 1;
  if (match[2] === 'b') pitch -= 1;
  const midi = (Number(match[3]) + 1) * 12 + pitch;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function resolveMusicScene(snapshot: MusicSnapshot): MusicScene {
  if (snapshot.scene === 'menu' || snapshot.scene === 'paused' || snapshot.scene === 'victory' || snapshot.scene === 'loss') return snapshot.scene;
  if (snapshot.scene === 'iecHs') return 'iecHs';
  if (snapshot.crs >= 65 || snapshot.neuro >= 65 || snapshot.hematotoxicity >= 65 || snapshot.fitness <= 30) return 'danger';
  return snapshot.scene === 'wave' ? 'wave' : 'planning';
}

export function nextBarStep(step: number): number {
  return Math.ceil(step / STEPS_PER_BAR) * STEPS_PER_BAR;
}

export function variationIndex(bar: number): number {
  return ((bar % 32) * 7) % 32;
}

export function smoothIntensity(current: number, target: number, amount = 0.04): number {
  const t = Math.max(0, Math.min(1, target));
  return current + (t - current) * Math.max(0, Math.min(1, amount));
}

function safeStop(node: AudioScheduledSourceNode, at: number): void {
  try { node.stop(at); } catch { /* source may already be stopped */ }
}

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private layerBuses: Partial<Record<Layer, GainNode>> = {};
  private noiseBuffer: AudioBuffer | null = null;
  private impulseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private volume = 0.6;
  private scene: MusicScene = 'menu';
  private pendingScene: MusicScene | null = null;
  private intensity = 0.3;
  private step = 0;
  private nextTime = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private activeVoices = 0;
  private lastLeadFrequency = 0;

  unlock(): void {
    this.ensure();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    this.startScheduler();
  }

  applySettings(settings: Settings): void {
    const wasEnabled = this.enabled;
    this.enabled = settings.music;
    this.volume = settings.musicVolume;
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.42 : 0.0001, now, 0.04);
    }
    if (!this.enabled) this.stopScheduler();
    else if (!wasEnabled && this.ctx) this.startScheduler();
  }

  update(snapshot: MusicSnapshot): void {
    this.intensity = smoothIntensity(this.intensity, snapshot.intensity);
    const next = resolveMusicScene(snapshot);
    if (next === this.scene || next === this.pendingScene) return;
    if (next === 'victory' || next === 'loss' || !this.interval) {
      this.scene = next;
      this.pendingScene = null;
      this.step = 0;
      if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
      this.syncDelay();
    } else {
      this.pendingScene = next;
    }
  }

  trigger(event: MusicEvent): void {
    this.ensure();
    if (!this.ctx || !this.duck || !this.enabled) return;
    const now = this.ctx.currentTime + 0.01;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(1, now);
    this.duck.gain.linearRampToValueAtTime(DUCK_GAIN, now + 0.025);
    this.duck.gain.setTargetAtTime(1, now + DUCK_SECONDS, 0.08);
    const notes: Record<MusicEvent, string[]> = {
      waveStart: ['A3', 'E4', 'A4'], waveClear: ['A4', 'C5', 'E5'],
      leak: ['F3', 'E3'], warning: ['E3', 'F3', 'A#3'],
      toci: ['E5', 'A5'], dexa: ['D4', 'A4'], stemcell: ['C4', 'E4', 'A4'],
      victory: ['A4', 'C5', 'E5', 'A5'],
      iecHsOnset: ['E3', 'F3', 'A#3', 'E4'], anakinra: ['A3', 'D4', 'A4'],
      gcsf: ['G4', 'C5', 'E5'],
      introCollection: ['A3', 'E4'],
      introActivation: ['C4', 'E4', 'A4'],
      introEngineering: ['A3', 'E4', 'A4', 'C5'],
      introExpansion: ['C4', 'E4', 'G4', 'A4'],
      introInfusion: ['A3', 'E4', 'A4', 'E5'],
      introBattle: ['A2', 'E3', 'A3', 'C4', 'E4'],
      loss: ['E4', 'C4', 'A3'],
    };
    notes[event].forEach((note, i) => {
      this.tone('counter', noteFrequency(note), now + i * 0.055, 0.28 + i * 0.04, i % 2 ? 0.35 : -0.35, 1.15);
    });
  }

  restartMenu(): void {
    this.scene = 'menu';
    this.pendingScene = null;
    this.step = 0;
    if (this.ctx) {
      this.nextTime = this.ctx.currentTime + 0.04;
      this.syncDelay();
    }
  }

  leak(): void { this.trigger('leak'); }
  warning(): void { this.trigger('warning'); }

  dispose(): void {
    this.stopScheduler();
    this.layerBuses = {};
    this.noiseBuffer = null;
    this.impulseBuffer = null;
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.duck = null;
    this.compressor = null;
    this.reverb = null;
    this.delay = null;
    this.activeVoices = 0;
  }

  get activeVoiceCount(): number { return this.activeVoices; }
  get currentScene(): MusicScene { return this.scene; }
  get queuedScene(): MusicScene | null { return this.pendingScene; }
  get currentStep(): number { return this.step; }

  private ensure(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AC = window.AudioContext ?? w.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume * 0.42 : 0.0001;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.22;
    this.duck = ctx.createGain();
    this.duck.gain.value = 1;
    this.duck.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(ctx.destination);

    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    dry.connect(this.duck);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse();
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.18;
    this.reverb.connect(reverbReturn);
    reverbReturn.connect(this.duck);
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 60 / ARRANGEMENTS[this.scene].bpm * 0.75;
    const delayReturn = ctx.createGain();
    delayReturn.gain.value = 0.13;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    this.delay.connect(delayReturn);
    delayReturn.connect(this.duck);
    this.delay.connect(feedback);
    feedback.connect(this.delay);

    const levels: Record<Layer, number> = {
      bass: 1, pad: 1, lead: 1, counter: 1, arp: 1, brass: 1,
      drums: 0.8, texture: 0.55,
    };
    for (const layer of Object.keys(levels) as Layer[]) {
      const bus = ctx.createGain();
      bus.gain.value = levels[layer];
      bus.connect(dry);
      if (layer !== 'bass' && layer !== 'drums') bus.connect(this.reverb);
      if (layer === 'lead' || layer === 'counter' || layer === 'arp') bus.connect(this.delay);
      this.layerBuses[layer] = bus;
    }
    this.nextTime = ctx.currentTime + 0.06;
    if (ctx.state === 'suspended') void ctx.resume();
  }

  private startScheduler(): void {
    if (!this.ctx || !this.enabled || this.interval) return;
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.04);
    this.interval = setInterval(() => this.pump(), 25);
  }

  private stopScheduler(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  private pump(): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      if (this.step % STEPS_PER_BAR === 0 && this.pendingScene) {
        this.scene = this.pendingScene;
        this.pendingScene = null;
        this.syncDelay();
      }
      const arrangement = ARRANGEMENTS[this.scene];
      const stepDuration = 60 / arrangement.bpm / 4;
      this.schedule(arrangement, this.step, this.nextTime, stepDuration);
      this.step += 1;
      this.nextTime += stepDuration;
    }
  }

  private schedule(arrangement: SceneArrangement, step: number, time: number, stepDuration: number): void {
    const phrase = Math.floor(step / STEPS_PER_PHRASE);
    const sectionIndex = arrangement.order[phrase % arrangement.order.length];
    const section = arrangement.sections[sectionIndex];
    const index = step % STEPS_PER_PHRASE;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const variation = variationIndex(bar);
    const density = Math.min(1, arrangement.density * (0.72 + this.intensity * 0.38));
    const chordNotes = section.chords[Math.floor(index / 8) % section.chords.length];

    if (index % 8 === 0) {
      chordNotes.forEach((note, i) => this.tone('pad', noteFrequency(note), time, stepDuration * 8.4, -0.7 + i * 0.35, arrangement.brightness));
    }
    const bass = section.bass[index];
    if (bass) this.tone('bass', noteFrequency(bass), time, stepDuration * 2.6, -0.12, Math.max(0.62, arrangement.brightness));

    const lead = section.lead[index];
    if (lead && density >= 0.36 && (this.scene === 'menu' || (variation + index) % 13 !== 0)) {
      const octave = this.scene === 'menu' ? 1 : variation % 8 === 7 ? 2 : 1;
      this.tone('lead', noteFrequency(lead) * octave, time, stepDuration * 1.65, Math.sin(bar * 0.7) * 0.38, this.scene === 'menu' ? 1.22 : 1.05);
    }
    const counter = section.counter[index];
    if (counter && density >= 0.48) this.tone('counter', noteFrequency(counter), time, stepDuration * 2.1, 0.48, 0.9);
    const arp = section.arp[index];
    if (arp && density >= 0.62) this.tone('arp', noteFrequency(arp), time, stepDuration * 0.8, index % 4 < 2 ? -0.52 : 0.52, 0.9);
    const brass = section.brass?.[index];
    if (brass && density >= 0.58) this.tone('brass', noteFrequency(brass), time, stepDuration * 7.5, index % 16 ? 0.2 : -0.2, 0.95);

    if (density >= 0.55 && section.kick[index]) this.kick(time, section.kick[index] === 'o');
    if (density >= 0.62 && section.snare[index]) this.snare(time, section.snare[index] === 'o');
    if (density >= 0.72 && section.hat[index]) this.hat(time, section.hat[index] === 'o');
    if (section.texture[index]) this.texture(time, stepDuration * 7, arrangement.brightness);
  }

  private tone(layer: Exclude<Layer, 'drums' | 'texture'>, frequency: number, time: number, duration: number, pan: number, velocity: number): void {
    const ctx = this.ctx;
    const bus = this.layerBuses[layer];
    if (!ctx || !bus || frequency <= 0 || this.activeVoices >= VOICE_LIMIT) return;
    const def = VOICES[layer];
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.75, Math.min(0.75, pan));
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(def.cutoff * Math.max(0.55, velocity), time);
    filter.Q.value = def.resonance;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(def.gain * velocity, time + def.attack);
    gain.gain.setTargetAtTime(0.0001, Math.max(time + def.attack, time + duration - def.release), Math.max(0.015, def.release / 4));
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(bus);

    const waves: Partial<Record<typeof layer, OscillatorType[]>> = {
      bass: ['triangle', 'sawtooth'], pad: ['sine', 'triangle'],
      lead: ['sawtooth', 'square'], counter: ['sine', 'triangle'], arp: ['triangle', 'square'],
      brass: ['sawtooth', 'triangle'],
    };
    const glideFrom = layer === 'lead' ? this.lastLeadFrequency : 0;
    const oscillators = (waves[layer] ?? ['sine']).map((wave, i) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(glideFrom || frequency, time);
      if (glideFrom) oscillator.frequency.exponentialRampToValueAtTime(frequency, time + 0.045);
      oscillator.detune.value = i === 0 ? -5 : 5;
      oscillator.connect(filter);
      oscillator.start(time);
      safeStop(oscillator, time + duration + def.release + 0.08);
      return oscillator;
    });
    if (layer === 'lead') this.lastLeadFrequency = frequency;
    const modulationNodes: AudioNode[] = [];
    if (layer === 'lead') {
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.value = 5.2;
      vibratoGain.gain.value = 7;
      vibrato.connect(vibratoGain);
      for (const oscillator of oscillators) vibratoGain.connect(oscillator.detune);
      vibrato.start(time);
      safeStop(vibrato, time + duration + def.release);
      modulationNodes.push(vibrato, vibratoGain);
    }
    this.activeVoices += 1;
    const cleanup = (): void => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (const node of [...oscillators, ...modulationNodes, filter, gain, panner]) node.disconnect();
    };
    oscillators[0].onended = cleanup;
  }

  private kick(time: number, strong: boolean): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(strong ? 145 : 110, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.13);
    gain.gain.setValueAtTime(strong ? 0.34 : 0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    oscillator.connect(gain); gain.connect(bus);
    oscillator.start(time); safeStop(oscillator, time + 0.2);
    this.activeVoices += 1;
    oscillator.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); oscillator.disconnect(); gain.disconnect(); };
  }

  private snare(time: number, strong: boolean): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise();
    filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 0.7;
    gain.gain.setValueAtTime(strong ? 0.18 : 0.11, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    source.connect(filter); filter.connect(gain); gain.connect(bus);
    source.start(time); safeStop(source, time + 0.18);
    this.trackTransient(source, source, filter, gain);
  }

  private hat(time: number, open: boolean): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise();
    filter.type = 'highpass'; filter.frequency.value = open ? 5200 : 7200;
    const duration = open ? 0.18 : 0.055;
    gain.gain.setValueAtTime(open ? 0.09 : 0.055, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(bus);
    source.start(time); safeStop(source, time + duration + 0.02);
    this.trackTransient(source, source, filter, gain);
  }

  private texture(time: number, duration: number, brightness: number): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.texture;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise();
    filter.type = 'bandpass'; filter.frequency.value = 500 + brightness * 900; filter.Q.value = 8;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.018, time + 0.18);
    gain.gain.setTargetAtTime(0.0001, time + duration * 0.65, 0.24);
    source.connect(filter); filter.connect(gain); gain.connect(bus);
    source.start(time); safeStop(source, time + duration);
    this.trackTransient(source, source, filter, gain);
  }

  private trackTransient(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    this.activeVoices += 1;
    source.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (const node of nodes) node.disconnect();
    };
  }

  private syncDelay(): void {
    if (!this.ctx || !this.delay) return;
    const now = this.ctx.currentTime;
    this.delay.delayTime.cancelScheduledValues(now);
    this.delay.delayTime.setTargetAtTime(60 / ARRANGEMENTS[this.scene].bpm * 0.75, now, 0.04);
  }

  private noise(): AudioBuffer {
    if (!this.noiseBuffer && this.ctx) {
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let seed = 0x12345678;
      for (let i = 0; i < length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 0xffffffff) * 2 - 1;
      }
    }
    return this.noiseBuffer ?? this.ctx!.createBuffer(1, 1, this.ctx!.sampleRate);
  }

  private impulse(): AudioBuffer {
    if (!this.impulseBuffer && this.ctx) {
      const length = Math.floor(this.ctx.sampleRate * 1.4);
      this.impulseBuffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = this.impulseBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const pseudo = Math.sin((i + 1) * (channel + 1) * 12.9898) * 43758.5453;
          data[i] = ((pseudo - Math.floor(pseudo)) * 2 - 1) * (1 - i / length) ** 2.8;
        }
      }
    }
    return this.impulseBuffer ?? this.ctx!.createBuffer(1, 1, this.ctx!.sampleRate);
  }
}
