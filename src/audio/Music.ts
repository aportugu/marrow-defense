// Adaptive, asset-free biological synthwave score. Composition data is pure and
// validated in tests; WebAudio is created only after a user gesture.
import type { Settings } from '../lib/storage';
import type { LevelId } from '../game/types';
import { INTRO_BPM } from '../lib/introTiming';

export type MusicScene =
  | 'menu'
  | 'planning'
  | 'wave'
  | 'boss'
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
  | 'loss'
  | 'hepaticSelect'
  | 'cnsSelect'
  | 'flareWarn'
  | 'flareImpact'
  | 'division'
  | 'obstruction'
  | 'shieldBreak'
  | 'bossPhase2'
  | 'bossPhase3';

export interface MusicSnapshot {
  level: LevelId;
  scene: MusicScene;
  wave: number;
  intensity: number;
  crs: number;
  neuro: number;
  hematotoxicity: number;
  fitness: number;
  leakHeat: number;
  bossPhase: number;
  hepaticEventPressure: number;
}

export type Pattern = ReadonlyArray<string | null>;
export type DrumPattern = ReadonlyArray<'x' | 'o' | null>;
export type Chord = ReadonlyArray<string>;

export interface MelodicEvent {
  step: number;
  note: string;
  length: number;
  velocity: number;
}

export interface ArrangementSection {
  name: string;
  chords: ReadonlyArray<Chord>;
  bass: Pattern;
  lead: Pattern;
  counter: Pattern;
  arp: Pattern;
  brass?: Pattern;
  strings?: Pattern;
  melody?: ReadonlyArray<MelodicEvent>;
  leadDouble?: ReadonlyArray<MelodicEvent>;
  solo?: ReadonlyArray<MelodicEvent>;
  kick: DrumPattern;
  snare: DrumPattern;
  hat: DrumPattern;
  texture: DrumPattern;
  tom?: DrumPattern;
  stepsPerChord?: number;
  filterScale?: number;
  layerLevels?: Partial<Record<Layer, number>>;
}

export interface SceneArrangement {
  bpm: number;
  order: ReadonlyArray<number>;
  sections: ReadonlyArray<ArrangementSection>;
  density: number;
  brightness: number;
  bossPhaseOrders?: Partial<Record<1 | 2 | 3, ReadonlyArray<number>>>;
  waveTierOrders?: Partial<Record<1 | 2 | 3, ReadonlyArray<number>>>;
}

export interface MusicCueOptions {
  pan?: number;
}

export interface VoiceDefinition {
  attack: number;
  release: number;
  cutoff: number;
  resonance: number;
  gain: number;
}

export type Layer = 'bass' | 'pad' | 'lead' | 'counter' | 'arp' | 'brass' | 'strings' | 'solo' | 'drums' | 'texture';

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
const melody = (...events: Array<[number, string, number, number]>): ReadonlyArray<MelodicEvent> =>
  events.map(([step, note, length, velocity]) => ({ step, note, length, velocity }));

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

export const ARRANGEMENTS: Record<Exclude<MusicScene, 'boss'>, SceneArrangement> = {
  menu: { bpm: INTRO_BPM, order: [0, 0, 1, 0, 2], sections: [cinematicOpening, cinematicAscent, cinematicResolve], density: 0.82, brightness: 0.8 },
  planning: { bpm: 92, order: [0, 1], sections: [planningMain, planningLift], density: 0.55, brightness: 0.7 },
  wave: { bpm: 118, order: [0, 0, 1, 0], sections: [waveMain, waveLift], density: 0.82, brightness: 0.78 },
  danger: { bpm: 118, order: [0], sections: [danger], density: 1, brightness: 0.92 },
  iecHs: { bpm: 118, order: [0], sections: [iecHs], density: 0.94, brightness: 0.58 },
  paused: { bpm: 72, order: [0, 1, 0, 2], sections: [pausedOpening, pausedAscent, pausedResolve], density: 0.58, brightness: 0.62 },
  victory: { bpm: 92, order: [0], sections: [victory], density: 0.62, brightness: 0.82 },
  loss: { bpm: 76, order: [0], sections: [loss], density: 0.28, brightness: 0.25 },
};

// Hepatic Drive: one authored 80-bar synthwave form in F# natural minor.
// Every two-bar section owns one chord per bar; pairing tonic and answer
// sections preserves F#m | E | D | E for the entire loop.
export const HEPATIC_LEITMOTIF = ['F#4', 'A4', 'B4', 'C#5', 'E5', 'G#5', 'F#5', 'E5'] as const;
export const HEPATIC_ANSWER = ['D5', 'F#5', 'E5', 'D5', 'E5', 'G#5', 'A5', 'B5', 'G#5'] as const;
export const HEPATIC_SCALE = ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'] as const;

export const HEPATIC_CHORDS = {
  tonic: chord('F#2', 'C#3', 'F#3', 'A3', 'C#4'),
  subtonic: chord('E2', 'B2', 'E3', 'G#3', 'B3'),
  submediant: chord('D2', 'A2', 'D3', 'F#3', 'A3'),
} as const;

const M = melody(
  [0, 'F#4', 4, .9], [8, 'A4', 2, .92], [10, 'B4', 2, .86], [12, 'C#5', 4, .94],
  [16, 'E5', 4, .9], [20, 'G#5', 2, .94], [22, 'F#5', 2, .88], [24, 'E5', 8, .92],
);
const M_VARIATION = melody(
  [0, 'F#4', 4, .9], [8, 'A4', 2, .92], [10, 'B4', 2, .86], [12, 'C#5', 4, .94],
  [16, 'E5', 4, .9], [20, 'G#5', 2, .94], [22, 'F#5', 2, .88], [24, 'B4', 4, .9], [28, 'E5', 4, .94],
);
const Q = melody(
  [0, 'D5', 4, .9], [8, 'F#5', 2, .94], [10, 'E5', 2, .86], [12, 'D5', 4, .9],
  [16, 'E5', 4, .9], [20, 'G#5', 2, .94], [22, 'A5', 2, .88], [24, 'B5', 4, .96], [28, 'G#5', 4, .92],
);
const Q_CADENCE = melody(
  [0, 'D5', 4, .9], [8, 'F#5', 2, .94], [10, 'E5', 2, .86], [12, 'D5', 4, .9],
  [16, 'E5', 4, .9], [20, 'G#5', 2, .94], [22, 'F#5', 2, .88], [24, 'E5', 8, .94],
);
const D1 = melody(
  [0, 'C#5', 4, .9], [8, 'A4', 2, .9], [10, 'B4', 2, .86], [12, 'C#5', 4, .92],
  [16, 'B4', 4, .9], [20, 'E5', 2, .9], [22, 'F#5', 2, .86], [24, 'G#5', 4, .94], [28, 'E5', 4, .9],
);
const D2 = melody(
  [0, 'A4', 4, .9], [8, 'F#4', 2, .88], [10, 'G#4', 2, .84], [12, 'A4', 4, .92],
  [16, 'B4', 4, .9], [20, 'G#4', 2, .9], [22, 'A4', 2, .86], [24, 'B4', 4, .92], [28, 'E5', 4, .94],
);

const INTRO_TEASERS = [
  melody([0, 'F#4', 8, .52], [12, 'C#5', 4, .56], [16, 'E5', 8, .54]),
  melody([0, 'D5', 8, .54], [8, 'F#5', 4, .56], [16, 'E5', 4, .54], [24, 'B5', 8, .58]),
  melody([0, 'F#4', 4, .58], [8, 'A4', 2, .6], [10, 'B4', 2, .56], [12, 'C#5', 4, .62], [16, 'E5', 8, .6]),
  melody([0, 'D5', 4, .6], [8, 'F#5', 2, .62], [10, 'E5', 2, .56], [12, 'D5', 4, .6], [16, 'E5', 8, .62]),
] as const;
const OUTRO_FRAGMENTS = [
  melody([0, 'F#4', 4, .7], [12, 'C#5', 4, .72], [16, 'E5', 8, .7]),
  melody([0, 'D5', 8, .68], [8, 'F#5', 4, .7], [16, 'E5', 4, .68], [24, 'B5', 8, .7]),
  melody([0, 'F#4', 8, .64], [12, 'C#5', 4, .66], [16, 'E5', 8, .64]),
  melody([0, 'D5', 8, .58], [12, 'A4', 4, .6], [16, 'E5', 12, .62]),
] as const;

type HepaticPhrase = 'M' | 'Q' | 'M\'' | 'Qcad' | 'D1' | 'D2';
const PHRASES: Record<HepaticPhrase, ReadonlyArray<MelodicEvent>> = {
  M, Q, "M'": M_VARIATION, Qcad: Q_CADENCE, D1, D2,
};
export const HEPATIC_A_SEQUENCE: ReadonlyArray<HepaticPhrase> = ['M', 'Q', 'M', 'Qcad', 'M', 'Q', "M'", 'Qcad'];
export const HEPATIC_B_SEQUENCE: ReadonlyArray<HepaticPhrase> = ['D1', 'D2', 'D1', 'Qcad', "M'", 'D2', 'M', 'Qcad'];

const EMPTY_PATTERN = pattern({});
const SYNTHWAVE_KICK = drums({ 0: 'o', 4: 'x', 8: 'x', 12: 'x', 16: 'o', 20: 'x', 24: 'x', 28: 'x' });
const SYNTHWAVE_KICK_STRONG = drums({ 0: 'o', 4: 'o', 8: 'x', 12: 'o', 16: 'o', 20: 'o', 24: 'x', 28: 'o' });
const SYNTHWAVE_SNARE = drums({ 4: 'o', 12: 'o', 20: 'o', 28: 'o' });
const SYNTHWAVE_HAT = drums({ 2: 'x', 6: 'x', 10: 'x', 14: 'o', 18: 'x', 22: 'x', 26: 'x', 30: 'o' });
const SYNTHWAVE_PEAK_HAT = drums({ 0: 'x', 2: 'x', 4: 'x', 6: 'x', 8: 'x', 10: 'x', 12: 'x', 14: 'o', 16: 'x', 18: 'x', 20: 'x', 22: 'x', 24: 'x', 26: 'x', 28: 'x', 30: 'o' });
const SYNTHWAVE_FILL = drums({ 25: 'x', 27: 'x', 29: 'o', 31: 'o' });

const phraseHarmony = (index: number): ReadonlyArray<Chord> => index % 2 === 0
  ? [HEPATIC_CHORDS.tonic, HEPATIC_CHORDS.subtonic]
  : [HEPATIC_CHORDS.submediant, HEPATIC_CHORDS.subtonic];
const arpBar = (notes: readonly string[]): string[] =>
  Array.from({ length: 16 }, (_, step) => notes[step % notes.length]);
const hepaticArp = (index: number): Pattern => [
  ...arpBar(index % 2 === 0 ? ['F#4', 'C#5', 'A4', 'C#5'] : ['D4', 'A4', 'F#4', 'A4']),
  ...arpBar(['E4', 'B4', 'G#4', 'B4']),
];
const bassBar = (root: string, fifth: string, octave: string): Pattern => {
  const notes = [root, root, fifth, root, octave, root, fifth, root];
  return Array.from({ length: 16 }, (_, step) => step % 2 === 0 ? notes[step / 2] : null);
};
const hepaticBass = (index: number): Pattern => [
  ...bassBar(...(index % 2 === 0 ? ['F#2', 'C#3', 'F#3'] : ['D2', 'A2', 'D3']) as [string, string, string]),
  ...bassBar('E2', 'B2', 'E3'),
];
const upperDoubling = (events: ReadonlyArray<MelodicEvent>): ReadonlyArray<MelodicEvent> =>
  events.filter((event) => event.step < 16).map((event) => ({
    ...event,
    note: ({ 'F#4': 'F#5', A4: 'A5', B4: 'B5', 'C#5': 'C#6' } as Record<string, string>)[event.note] ?? event.note,
    velocity: event.velocity * .55,
  }));

interface HepaticSectionOptions {
  melody: ReadonlyArray<MelodicEvent>;
  drums?: 'none' | 'drive' | 'peak';
  bass?: boolean;
  double?: boolean;
  fill?: boolean;
  filterScale: number;
  arpLevel?: number;
}

const hepaticSection = (index: number, name: string, options: HepaticSectionOptions): ArrangementSection => {
  const drumMode = options.drums ?? 'drive';
  return {
    name,
    chords: phraseHarmony(index),
    stepsPerChord: 16,
    filterScale: options.filterScale,
    layerLevels: { arp: options.arpLevel ?? .62, pad: .92, lead: 1.12, bass: 1.04, drums: drumMode === 'peak' ? 1.12 : 1 },
    bass: options.bass === false ? EMPTY_PATTERN : hepaticBass(index),
    lead: EMPTY_PATTERN,
    melody: options.melody,
    leadDouble: options.double ? upperDoubling(options.melody) : undefined,
    counter: EMPTY_PATTERN,
    arp: hepaticArp(index),
    brass: EMPTY_PATTERN,
    strings: EMPTY_PATTERN,
    kick: drumMode === 'none' ? EMPTY_DRUMS : drumMode === 'peak' ? SYNTHWAVE_KICK_STRONG : SYNTHWAVE_KICK,
    snare: drumMode === 'none' ? EMPTY_DRUMS : SYNTHWAVE_SNARE,
    hat: drumMode === 'none' ? EMPTY_DRUMS : drumMode === 'peak' ? SYNTHWAVE_PEAK_HAT : SYNTHWAVE_HAT,
    texture: drums({ 0: 'x', 16: 'x' }),
    tom: options.fill ? SYNTHWAVE_FILL : EMPTY_DRUMS,
  };
};

const hepaticSections: ArrangementSection[] = [];
INTRO_TEASERS.forEach((events, index) => hepaticSections.push(hepaticSection(index, `intro-${index + 1}`, {
  melody: events, drums: 'none', bass: false, filterScale: .5 + index * .09, arpLevel: .42 + index * .05,
})));
const appendSequence = (
  label: string,
  sequence: ReadonlyArray<HepaticPhrase>,
  options: { double: boolean; filterScale: number; peak?: boolean },
): void => {
  sequence.forEach((phrase, phraseIndex) => {
    const sectionIndex = hepaticSections.length;
    const endBar = (sectionIndex + 1) * 2;
    hepaticSections.push(hepaticSection(sectionIndex, `${label}-${phraseIndex + 1}-${phrase}`, {
      melody: PHRASES[phrase],
      double: options.double && sectionIndex % 2 === 0,
      drums: options.peak ? 'peak' : 'drive',
      fill: [24, 40, 56, 72].includes(endBar),
      filterScale: options.filterScale,
      arpLevel: options.peak ? .7 : .58,
    }));
  });
};
appendSequence('a', HEPATIC_A_SEQUENCE, { double: false, filterScale: .82 });
appendSequence('a-prime', HEPATIC_A_SEQUENCE, { double: true, filterScale: .98, peak: true });
appendSequence('b', HEPATIC_B_SEQUENCE, { double: false, filterScale: .88 });
appendSequence('a-return', HEPATIC_A_SEQUENCE, { double: true, filterScale: 1.12, peak: true });
OUTRO_FRAGMENTS.forEach((events, index) => {
  const sectionIndex = hepaticSections.length;
  hepaticSections.push(hepaticSection(sectionIndex, `outro-${index + 1}`, {
    melody: events,
    drums: index >= 2 ? 'none' : 'drive',
    bass: index < 3,
    filterScale: .78 - index * .1,
    arpLevel: .5 - index * .08,
  }));
});

export const HEPATIC_FORM_SECTIONS: ReadonlyArray<ArrangementSection> = hepaticSections;
export const HEPATIC_FORM_ORDER: ReadonlyArray<number> = hepaticSections.map((_, index) => index);

const hepaticVictorySections = [
  hepaticSection(0, 'victory-motif', { melody: M, double: true, filterScale: 1, drums: 'drive' }),
  hepaticSection(1, 'victory-answer', { melody: Q_CADENCE, double: false, filterScale: 1.05, drums: 'drive' }),
];
const hepaticLossSections = [
  hepaticSection(0, 'loss-motif', { melody: INTRO_TEASERS[0], filterScale: .55, drums: 'none' }),
  hepaticSection(1, 'loss-answer', { melody: OUTRO_FRAGMENTS[3], filterScale: .45, drums: 'none', bass: false }),
];

const hepaticContinuous = (brightness: number): SceneArrangement => ({
  bpm: 114,
  order: HEPATIC_FORM_ORDER,
  sections: HEPATIC_FORM_SECTIONS,
  density: 1,
  brightness,
});

export const HEPATIC_ARRANGEMENTS: Partial<Record<MusicScene, SceneArrangement>> = {
  planning: hepaticContinuous(.78),
  wave: hepaticContinuous(.86),
  danger: hepaticContinuous(.86),
  iecHs: hepaticContinuous(.86),
  boss: hepaticContinuous(.86),
  paused: hepaticContinuous(.68),
  victory: { bpm: 114, order: [0, 1], sections: hepaticVictorySections, density: 1, brightness: .88 },
  loss: { bpm: 114, order: [0, 1], sections: hepaticLossSections, density: 1, brightness: .48 },
};

// Neuroaxis: a deterministic 96-bar form (48 two-bar sections) in E natural
// minor. Cold 3+3+2 pulses distinguish it from the hepatic synthwave score.
export const CNS_SCALE = ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] as const;
export const CNS_CHORDS = {
  tonic: chord('E1', 'B1', 'E2', 'G2', 'B2'),
  submediant: chord('C2', 'G2', 'C3', 'E3', 'G3'),
  mediant: chord('G1', 'D2', 'G2', 'B2', 'D3'),
  subtonic: chord('D2', 'A2', 'D3', 'F#3', 'A3'),
} as const;

const CNS_MOTIF = melody(
  [0, 'E4', 3, .92], [6, 'G4', 3, .88], [12, 'B4', 4, .96],
  [16, 'D5', 3, .9], [22, 'B4', 3, .86], [28, 'G4', 4, .92],
);
const CNS_ANSWER = melody(
  [0, 'G4', 3, .88], [6, 'B4', 3, .92], [12, 'D5', 4, .96],
  [16, 'F#5', 3, .9], [22, 'E5', 3, .88], [28, 'D5', 4, .92],
);
const CNS_RISE = melody(
  [0, 'B4', 3, .9], [6, 'D5', 3, .9], [12, 'E5', 4, .98],
  [16, 'D5', 3, .9], [22, 'F#5', 3, .92], [28, 'G5', 4, .98],
);
const CNS_RETURN = melody(
  [0, 'E5', 3, .94], [6, 'D5', 3, .88], [12, 'B4', 4, .92],
  [16, 'A4', 3, .86], [22, 'F#4', 3, .84], [28, 'E4', 4, .94],
);
export const CNS_LEITMOTIF = ['E4', 'G4', 'B4', 'D5', 'B4', 'G4'] as const;

const CNS_KICK = drums({ 0: 'o', 6: 'x', 12: 'x', 16: 'o', 22: 'x', 28: 'x' });
const CNS_SNARE = drums({ 4: 'o', 12: 'o', 20: 'o', 28: 'o' });
const CNS_HATS = drums({ 0: 'x', 2: 'x', 4: 'x', 6: 'o', 8: 'x', 10: 'x', 12: 'o', 14: 'x', 16: 'x', 18: 'x', 20: 'x', 22: 'o', 24: 'x', 26: 'x', 28: 'o', 30: 'x' });
const cnsHarmony = (index: number): ReadonlyArray<Chord> => index % 2 === 0
  ? [CNS_CHORDS.tonic, CNS_CHORDS.submediant]
  : [CNS_CHORDS.mediant, CNS_CHORDS.subtonic];
const cnsArpBar = (notes: readonly string[]): string[] => Array.from({ length: 16 }, (_, step) => notes[step % 4]);
const cnsArp = (index: number): Pattern => index % 2 === 0
  ? [...cnsArpBar(['E4', 'B4', 'G4', 'B4']), ...cnsArpBar(['C4', 'G4', 'E4', 'G4'])]
  : [...cnsArpBar(['G3', 'D4', 'B3', 'D4']), ...cnsArpBar(['D4', 'A4', 'F#4', 'A4'])];
const cnsBassBar = (root: string, fifth: string, octave: string): Pattern => Array.from({ length: 16 }, (_, step) => {
  if (step % 2 !== 0) return null;
  return [root, root, fifth, root, octave, root, fifth, root][step / 2];
});
const cnsBass = (index: number): Pattern => index % 2 === 0
  ? [...cnsBassBar('E1', 'B1', 'E2'), ...cnsBassBar('C2', 'G2', 'C3')]
  : [...cnsBassBar('G1', 'D2', 'G2'), ...cnsBassBar('D2', 'A2', 'D3')];
const CNS_PHRASES = [CNS_MOTIF, CNS_ANSWER, CNS_RISE, CNS_RETURN] as const;

const cnsSection = (index: number, intensity: number, sparse = false): ArrangementSection => ({
  name: `neuroaxis-${String(index + 1).padStart(2, '0')}`,
  chords: cnsHarmony(index), stepsPerChord: 16,
  bass: sparse ? pattern({ 0: index % 2 === 0 ? 'E1' : 'G1', 16: index % 2 === 0 ? 'C2' : 'D2' }) : cnsBass(index),
  lead: EMPTY_PATTERN,
  melody: sparse ? CNS_PHRASES[index % 4].filter((event) => event.step === 0 || event.step === 12 || event.step === 28) : CNS_PHRASES[index % 4],
  leadDouble: intensity >= .92 ? upperDoubling(CNS_PHRASES[index % 4]) : undefined,
  counter: pattern(index % 3 === 0 ? { 3: 'E5', 9: 'B4', 19: 'G5', 25: 'D5' } : index % 3 === 1 ? { 1: 'B3', 7: 'E4', 17: 'G4', 23: 'C5' } : { 5: 'D4', 11: 'A4', 21: 'E4', 27: 'B4' }),
  arp: cnsArp(index), brass: EMPTY_PATTERN, strings: EMPTY_PATTERN,
  kick: sparse ? EMPTY_DRUMS : CNS_KICK, snare: sparse ? EMPTY_DRUMS : CNS_SNARE,
  hat: sparse ? drums({ 6: 'x', 14: 'x', 22: 'x', 30: 'x' }) : CNS_HATS,
  texture: drums({ 0: 'x', 6: 'x', 12: 'x', 16: 'x', 22: 'x', 28: 'x' }),
  tom: !sparse && (index + 1) % 8 === 0 ? SYNTHWAVE_FILL : EMPTY_DRUMS,
  filterScale: .68 + intensity * .46,
  layerLevels: { pad: .76, bass: .96 + intensity * .12, arp: .36 + intensity * .16, lead: 1.1, counter: .42, drums: .82 + intensity * .18, texture: .58 },
});

const cnsSections = Array.from({ length: 48 }, (_, index) => {
  const sparse = index < 4 || index >= 46;
  const intensity = index < 4 ? .22 + index * .1 : index < 16 ? .58 : index < 28 ? .74 : index < 40 ? .9 : 1;
  return cnsSection(index, intensity, sparse);
});
export const CNS_FORM_SECTIONS: ReadonlyArray<ArrangementSection> = cnsSections;
export const CNS_FORM_ORDER: ReadonlyArray<number> = cnsSections.map((_, index) => index);
const cnsContinuous = (brightness: number): SceneArrangement => ({ bpm: 118, order: CNS_FORM_ORDER, sections: CNS_FORM_SECTIONS, density: 1, brightness });
export const CNS_ARRANGEMENTS: Partial<Record<MusicScene, SceneArrangement>> = {
  planning: cnsContinuous(.68), wave: cnsContinuous(.8), danger: cnsContinuous(.9),
  iecHs: cnsContinuous(.7), boss: cnsContinuous(.92), paused: cnsContinuous(.58),
  victory: { bpm: 118, order: [0, 1], sections: [cnsSection(40, 1), cnsSection(41, 1)], density: 1, brightness: .95 },
  loss: { bpm: 118, order: [0, 1], sections: [cnsSection(46, .3, true), cnsSection(47, .2, true)], density: 1, brightness: .36 },
};

const HEPATIC_STINGER_CHORDS = [
  { low: ['F#2', 'C#3', 'A3'], high: ['F#4', 'A4', 'C#5'] },
  { low: ['E2', 'B2', 'G#3'], high: ['E4', 'G#4', 'B4'] },
  { low: ['D2', 'A2', 'F#3'], high: ['D4', 'F#4', 'A4'] },
  { low: ['E2', 'B2', 'G#3'], high: ['E4', 'G#4', 'B4'] },
] as const;

export function hepaticStinger(event: MusicEvent, bar: number): ReadonlyArray<string> | undefined {
  if (event === 'hepaticSelect') return ['F#2', 'C#3', 'A3', 'F#3'];
  const tones = HEPATIC_STINGER_CHORDS[((bar % 4) + 4) % 4];
  const shapes: Partial<Record<MusicEvent, ReadonlyArray<string>>> = {
    waveStart: [tones.high[0], tones.high[1], tones.high[2]],
    waveClear: [tones.high[2], tones.high[1], tones.high[0]],
    leak: [tones.low[1], tones.low[0]],
    warning: [tones.low[0], tones.low[1], tones.low[2], tones.low[0]],
    toci: [tones.high[0], tones.high[1]], dexa: [tones.high[2], tones.high[0]],
    stemcell: [tones.low[0], tones.low[2], tones.high[0]],
    victory: [tones.high[0], tones.high[2], tones.high[1], tones.high[0]],
    loss: [tones.high[1], tones.high[2], tones.high[0]],
    iecHsOnset: [tones.low[0], tones.low[1], tones.low[2], tones.high[0]],
    anakinra: [tones.low[2], tones.high[0], tones.high[1]], gcsf: [tones.high[0], tones.high[2], tones.high[1]],
    flareWarn: [tones.high[0], tones.high[1], tones.high[2], tones.high[0]],
    flareImpact: [tones.low[0], tones.low[1], tones.low[0]],
    division: [tones.high[0], tones.high[2], tones.high[1], tones.high[0]],
    obstruction: [tones.low[1], tones.low[2], tones.low[0]],
    shieldBreak: [tones.low[0], tones.low[2], tones.high[0], tones.high[1]],
    bossPhase2: [tones.low[0], tones.low[2], tones.low[1], tones.high[0]],
    bossPhase3: [tones.high[0], tones.high[2], tones.high[1], tones.high[0]],
  };
  return shapes[event];
}

const CNS_STINGER_CHORDS = [
  ['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3'], ['D3', 'F#3', 'A3'],
] as const;

export function cnsStinger(event: MusicEvent, bar: number): ReadonlyArray<string> | undefined {
  if (event === 'cnsSelect') return ['E2', 'B2', 'G3', 'E3'];
  const tones = CNS_STINGER_CHORDS[((bar % 4) + 4) % 4];
  const shapes: Partial<Record<MusicEvent, ReadonlyArray<string>>> = {
    waveStart: [tones[0], tones[1], tones[2]], waveClear: [tones[2], tones[1], tones[0]],
    leak: [tones[2], tones[0]], warning: [tones[0], tones[1], tones[2]],
    toci: [tones[1], tones[2]], dexa: [tones[2], tones[0]], stemcell: [tones[0], tones[2]],
    iecHsOnset: [tones[0], tones[1], tones[2], tones[0]], anakinra: [tones[1], tones[0]],
    gcsf: [tones[0], tones[2], tones[1]], victory: [tones[0], tones[1], tones[2], 'E4'],
    loss: [tones[2], tones[1], tones[0]], bossPhase2: [tones[0], tones[2], tones[1]],
    bossPhase3: [tones[0], tones[1], tones[2], 'E4'], shieldBreak: [tones[0], tones[2], 'E4'],
  };
  return shapes[event];
}

export function hepaticWaveTier(wave: number): 1 | 2 | 3 {
  if (wave >= 7) return 3;
  if (wave >= 4) return 2;
  return 1;
}

export type HepaticWavePhase = 'planning' | 'combat';

export interface HepaticWaveProfile {
  wave: number;
  phase: HepaticWavePhase;
  tier: 1 | 2 | 3 | 4;
  filter: number;
  bass: number;
  arp: number;
  drums: number;
  lead: number;
  doubling: number;
  fullerHats: boolean;
}

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export function hepaticWaveProfile(
  wave: number,
  phase: HepaticWavePhase,
  bossPhase: number,
): HepaticWaveProfile {
  const boundedWave = Math.max(1, Math.min(10, Math.round(wave)));
  const energy = (boundedWave - 1) / 9;
  const tier: HepaticWaveProfile['tier'] = boundedWave >= 10 || bossPhase > 0
    ? 4
    : boundedWave >= 7 ? 3 : boundedWave >= 4 ? 2 : 1;
  if (phase === 'planning') {
    return {
      wave: boundedWave,
      phase,
      tier,
      filter: lerp(.68, .76, energy),
      bass: lerp(.5, .6, energy),
      arp: lerp(.48, .56, energy),
      drums: 0,
      lead: .78,
      doubling: 0,
      fullerHats: false,
    };
  }
  return {
    wave: boundedWave,
    phase,
    tier,
    filter: lerp(.82, 1.1, energy),
    bass: lerp(.88, 1.1, energy),
    arp: lerp(.76, 1, energy),
    drums: lerp(.82, 1.1, energy),
    lead: lerp(.96, 1.08, energy),
    doubling: Math.max(0, Math.min(1, (boundedWave - 3) / 7)),
    fullerHats: boundedWave >= 7,
  };
}

function sameHepaticProfile(a: HepaticWaveProfile, b: HepaticWaveProfile): boolean {
  return a.wave === b.wave && a.phase === b.phase && a.tier === b.tier
    && a.filter === b.filter && a.bass === b.bass && a.arp === b.arp
    && a.drums === b.drums && a.lead === b.lead && a.doubling === b.doubling
    && a.fullerHats === b.fullerHats;
}

export function arrangementFor(level: LevelId, scene: MusicScene): SceneArrangement {
  if (level === 'liver') return HEPATIC_ARRANGEMENTS[scene] ?? ARRANGEMENTS[scene === 'boss' ? 'wave' : scene];
  if (level === 'cns') return CNS_ARRANGEMENTS[scene] ?? ARRANGEMENTS[scene === 'boss' ? 'wave' : scene];
  return ARRANGEMENTS[scene === 'boss' ? 'wave' : scene];
}

export const VOICES: Record<Exclude<Layer, 'drums' | 'texture'>, VoiceDefinition> = {
  bass: { attack: 0.012, release: 0.22, cutoff: 720, resonance: 2.5, gain: 0.17 },
  pad: { attack: 0.22, release: 0.8, cutoff: 1800, resonance: 1.2, gain: 0.045 },
  lead: { attack: 0.018, release: 0.24, cutoff: 3200, resonance: 3.2, gain: 0.085 },
  counter: { attack: 0.025, release: 0.32, cutoff: 4200, resonance: 1.4, gain: 0.055 },
  arp: { attack: 0.006, release: 0.12, cutoff: 5200, resonance: 4, gain: 0.052 },
  brass: { attack: 0.08, release: 0.65, cutoff: 2100, resonance: 2.1, gain: 0.062 },
  strings: { attack: 0.16, release: 0.72, cutoff: 2600, resonance: 1.1, gain: 0.052 },
  solo: { attack: 0.04, release: 0.7, cutoff: 1900, resonance: 2, gain: 0.08 },
};

export const HEPATIC_VOICES: Partial<Record<Exclude<Layer, 'drums' | 'texture'>, VoiceDefinition>> = {
  bass: { attack: 0.004, release: 0.11, cutoff: 680, resonance: 4.6, gain: 0.18 },
  pad: { attack: 0.3, release: 1.2, cutoff: 1450, resonance: 1.5, gain: 0.044 },
  lead: { attack: 0.012, release: 0.3, cutoff: 4300, resonance: 2.4, gain: 0.086 },
  counter: { attack: 0.006, release: 0.16, cutoff: 3500, resonance: 2.8, gain: 0.035 },
  arp: { attack: 0.004, release: 0.075, cutoff: 4200, resonance: 3.2, gain: 0.022 },
  brass: { attack: 0.035, release: 0.42, cutoff: 1550, resonance: 3.8, gain: 0.04 },
  strings: { attack: 0.24, release: 1.1, cutoff: 1750, resonance: 1.2, gain: 0.028 },
  solo: { attack: 0.01, release: 0.28, cutoff: 3400, resonance: 2.9, gain: 0.085 },
};

export const CNS_VOICES: Partial<Record<Exclude<Layer, 'drums' | 'texture'>, VoiceDefinition>> = {
  bass: { attack: .003, release: .16, cutoff: 520, resonance: 5.2, gain: .19 },
  pad: { attack: .42, release: 1.35, cutoff: 1250, resonance: 1.7, gain: .04 },
  lead: { attack: .01, release: .34, cutoff: 3900, resonance: 3.4, gain: .09 },
  counter: { attack: .004, release: .12, cutoff: 2800, resonance: 5.4, gain: .032 },
  arp: { attack: .003, release: .065, cutoff: 3400, resonance: 5.8, gain: .02 },
  brass: { attack: .025, release: .46, cutoff: 1200, resonance: 4.4, gain: .045 },
  strings: { attack: .3, release: 1.2, cutoff: 1500, resonance: 1.5, gain: .028 },
  solo: { attack: .012, release: .38, cutoff: 3600, resonance: 3.8, gain: .09 },
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
  if (snapshot.scene === 'menu' || snapshot.scene === 'paused' || snapshot.scene === 'victory' || snapshot.scene === 'loss' || snapshot.scene === 'boss') return snapshot.scene;
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

function saturationCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(256 * Float32Array.BYTES_PER_ELEMENT));
  const scale = Math.tanh(amount);
  for (let index = 0; index < curve.length; index += 1) {
    const input = index * 2 / (curve.length - 1) - 1;
    curve[index] = Math.tanh(input * amount) / scale;
  }
  return curve;
}

const HEPATIC_DRIVE_CURVE = saturationCurve(2.4);
const HEPATIC_REDLINE_CURVE = saturationCurve(4.2);

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private tonalDuck: GainNode | null = null;
  private layerBuses: Partial<Record<Layer, GainNode>> = {};
  private noiseBuffer: AudioBuffer | null = null;
  private impulseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private volume = 0.6;
  private scene: MusicScene = 'menu';
  private level: LevelId = 'marrow';
  private pendingScene: MusicScene | null = null;
  private bossPhase = 0;
  private pendingBossPhase = 0;
  private waveTier: 1 | 2 | 3 = 1;
  private hepaticEventPressure = 0;
  private hepaticProfile = hepaticWaveProfile(1, 'planning', 0);
  private pendingHepaticProfile: HepaticWaveProfile | null = null;
  private pendingWaveTransition: 'start' | 'clear' | null = null;
  private intensity = 0.3;
  private step = 0;
  private nextTime = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private activeVoices = 0;
  private lastLeadFrequency = 0;
  private lastSoloFrequency = 0;

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
    this.level = snapshot.level;
    this.waveTier = hepaticWaveTier(snapshot.wave);
    this.hepaticEventPressure = Math.max(0, Math.min(1, snapshot.hepaticEventPressure));
    const nextBossPhase = Math.max(0, Math.min(3, Math.round(snapshot.bossPhase)));
    if (nextBossPhase !== this.bossPhase) this.pendingBossPhase = nextBossPhase;
    const next = resolveMusicScene(snapshot);
    if (snapshot.level === 'liver' && next !== 'menu' && next !== 'victory' && next !== 'loss') {
      const phase: HepaticWavePhase = next === 'planning'
        ? 'planning'
        : next === 'paused' ? this.hepaticProfile.phase : 'combat';
      const profile = hepaticWaveProfile(snapshot.wave, phase, nextBossPhase);
      if (!sameHepaticProfile(profile, this.hepaticProfile)) this.pendingHepaticProfile = profile;
    }
    if (next === this.scene || next === this.pendingScene) return;
    if (next === 'victory' || next === 'loss' || !this.interval) {
      this.scene = next;
      this.pendingScene = null;
      if (next === 'victory' || next === 'loss') {
        this.pendingHepaticProfile = null;
        this.pendingWaveTransition = null;
      }
      this.step = 0;
      if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
      this.syncDelay();
    } else {
      this.pendingScene = next;
    }
  }

  trigger(event: MusicEvent, options: MusicCueOptions = {}): void {
    this.ensure();
    if (!this.ctx || !this.duck || !this.enabled) return;
    const now = this.ctx.currentTime + 0.01;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setValueAtTime(1, now);
    this.duck.gain.linearRampToValueAtTime(DUCK_GAIN, now + 0.025);
    this.duck.gain.setTargetAtTime(1, now + DUCK_SECONDS, 0.08);
    const notes: Partial<Record<MusicEvent, ReadonlyArray<string>>> = {
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
    const hepaticCue = event === 'hepaticSelect' || (this.level === 'liver' && this.scene !== 'menu');
    const cnsCue = event === 'cnsSelect' || (this.level === 'cns' && this.scene !== 'menu');
    if ((hepaticCue || cnsCue) && event === 'waveStart') this.pendingWaveTransition = 'start';
    if ((hepaticCue || cnsCue) && event === 'waveClear') this.pendingWaveTransition = 'clear';
    const spacing = hepaticCue || cnsCue ? 0.085 : 0.055;
    const sequence = hepaticCue ? hepaticStinger(event, Math.floor(this.step / STEPS_PER_BAR)) ?? [] : cnsCue ? cnsStinger(event, Math.floor(this.step / STEPS_PER_BAR)) ?? [] : notes[event] ?? [];
    const cuePan = Math.max(-0.75, Math.min(0.75, options.pan ?? 0));
    sequence.forEach((note, i) => {
      const pan = hepaticCue || cnsCue ? cuePan : i % 2 ? 0.35 : -0.35;
      this.tone('counter', noteFrequency(note), now + i * spacing, 0.24 + i * 0.025, pan, hepaticCue || cnsCue ? 0.86 : 1.15);
    });
    if (event === 'flareImpact' || event === 'bossPhase2' || event === 'bossPhase3') {
      this.kick(now, true);
      this.tom(now + 0.08, true);
      const impactRoot = (cnsCue ? cnsStinger(event, Math.floor(this.step / STEPS_PER_BAR)) : hepaticStinger(event, Math.floor(this.step / STEPS_PER_BAR)))?.[0] ?? (cnsCue ? 'E2' : 'F#2');
      this.tone('brass', noteFrequency(impactRoot), now, 0.7, cuePan, 1.12);
    }
  }

  restartMenu(): void {
    this.scene = 'menu';
    this.pendingScene = null;
    this.bossPhase = 0;
    this.pendingBossPhase = 0;
    this.hepaticEventPressure = 0;
    this.pendingHepaticProfile = null;
    this.pendingWaveTransition = null;
    this.step = 0;
    if (this.ctx) {
      this.nextTime = this.ctx.currentTime + 0.04;
      this.syncDelay();
    }
  }

  previewLevel(level: LevelId): void {
    this.level = level;
    if (level === 'liver') this.trigger('hepaticSelect');
    if (level === 'cns') this.trigger('cnsSelect');
  }

  startLevel(level: LevelId): void {
    this.level = level;
    this.scene = 'planning';
    this.pendingScene = null;
    this.bossPhase = 0;
    this.pendingBossPhase = 0;
    this.hepaticEventPressure = 0;
    this.hepaticProfile = hepaticWaveProfile(1, 'planning', 0);
    this.pendingHepaticProfile = null;
    this.pendingWaveTransition = null;
    this.step = 0;
    this.lastLeadFrequency = 0;
    this.lastSoloFrequency = 0;
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
    this.tonalDuck = null;
    this.activeVoices = 0;
  }

  get activeVoiceCount(): number { return this.activeVoices; }
  get currentScene(): MusicScene { return this.scene; }
  get queuedScene(): MusicScene | null { return this.pendingScene; }
  get currentStep(): number { return this.step; }
  get currentBossPhase(): number { return this.bossPhase; }
  get queuedBossPhase(): number { return this.pendingBossPhase; }
  get currentWaveTier(): 1 | 2 | 3 { return this.waveTier; }
  get currentHepaticProfile(): HepaticWaveProfile { return this.hepaticProfile; }
  get queuedHepaticProfile(): HepaticWaveProfile | null { return this.pendingHepaticProfile; }
  get queuedWaveTransition(): 'start' | 'clear' | null { return this.pendingWaveTransition; }

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
    this.tonalDuck = ctx.createGain();
    this.tonalDuck.gain.value = 1;
    this.tonalDuck.connect(dry);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse();
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.18;
    this.reverb.connect(reverbReturn);
    reverbReturn.connect(this.duck);
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 60 / arrangementFor(this.level, this.scene).bpm * 0.75;
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
      strings: 1, solo: 1,
      drums: 0.8, texture: 0.55,
    };
    for (const layer of Object.keys(levels) as Layer[]) {
      const bus = ctx.createGain();
      bus.gain.value = levels[layer];
      if (layer === 'bass' || layer === 'drums' || layer === 'texture') bus.connect(dry);
      else bus.connect(this.tonalDuck);
      if (layer !== 'bass' && layer !== 'drums') bus.connect(this.reverb);
      if (layer === 'lead' || layer === 'counter' || layer === 'arp' || layer === 'solo') bus.connect(this.delay);
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
      if (this.step % STEPS_PER_BAR === 0) {
        let profileChanged = false;
        if (this.pendingScene) {
          this.scene = this.pendingScene;
          this.pendingScene = null;
          this.syncDelay();
        }
        if (this.pendingBossPhase !== this.bossPhase) {
          this.bossPhase = this.pendingBossPhase;
        }
        if (this.pendingHepaticProfile) {
          this.hepaticProfile = this.pendingHepaticProfile;
          this.pendingHepaticProfile = null;
          profileChanged = true;
        }
        if (profileChanged && this.pendingWaveTransition) {
          this.scheduleWaveTransition(this.nextTime, this.pendingWaveTransition);
          this.pendingWaveTransition = null;
        }
      }
      const arrangement = arrangementFor(this.level, this.scene);
      const stepDuration = 60 / arrangement.bpm / 4;
      this.schedule(arrangement, this.step, this.nextTime, stepDuration);
      this.step += 1;
      this.nextTime += stepDuration;
    }
  }

  private schedule(arrangement: SceneArrangement, step: number, time: number, stepDuration: number): void {
    const phrase = Math.floor(step / STEPS_PER_PHRASE);
    const phaseOrder = this.scene === 'boss' && this.level === 'liver'
      ? arrangement.bossPhaseOrders?.[Math.max(1, this.bossPhase) as 1 | 2 | 3]
      : undefined;
    const tierOrder = this.level === 'liver' && this.scene === 'wave'
      ? arrangement.waveTierOrders?.[this.waveTier]
      : undefined;
    const sectionIndex = phaseOrder?.[phrase % phaseOrder.length]
      ?? tierOrder?.[phrase % tierOrder.length]
      ?? arrangement.order[phrase % arrangement.order.length];
    const section = arrangement.sections[sectionIndex];
    const index = step % STEPS_PER_PHRASE;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const variation = variationIndex(bar);
    const continuousHepatic = this.level === 'liver'
      && this.scene !== 'menu' && this.scene !== 'victory' && this.scene !== 'loss';
    const continuousCns = this.level === 'cns'
      && this.scene !== 'menu' && this.scene !== 'victory' && this.scene !== 'loss';
    const density = continuousHepatic || continuousCns ? 1 : Math.min(
      1,
      arrangement.density * (0.72 + this.intensity * 0.38) + this.hepaticEventPressure * 0.1,
    );
    const brightness = arrangement.brightness;
    const chordSpan = section.stepsPerChord ?? 8;
    const chordNotes = section.chords[Math.floor(index / chordSpan) % section.chords.length];
    const profile = continuousHepatic ? this.hepaticProfile : null;
    const livePressure = profile ? Math.min(1,
      this.intensity * .7 + this.hepaticEventPressure * .2 + Math.max(0, this.bossPhase - 1) / 20,
    ) : 0;
    const profileLevel = (layer: Layer): number => {
      if (!profile) return 1;
      if (layer === 'bass') return profile.bass * (1 + livePressure * .06);
      if (layer === 'arp') return profile.arp;
      if (layer === 'drums') return profile.drums * (1 + livePressure * .06);
      if (layer === 'lead') return profile.lead;
      return 1;
    };
    const level = (layer: Layer): number => (section.layerLevels?.[layer] ?? 1) * profileLevel(layer);
    const filterScale = (section.filterScale ?? 1) * (profile?.filter ?? 1) * (1 + livePressure * .08);

    if (index % chordSpan === 0) {
      chordNotes.forEach((note, i) => this.tone('pad', noteFrequency(note), time, stepDuration * (chordSpan + .4), -0.7 + i * 0.35, brightness, level('pad'), filterScale));
    }
    const bass = section.bass[index];
    if (bass) this.tone(
      'bass',
      noteFrequency(bass),
      time,
      stepDuration * ((this.level === 'liver' || this.level === 'cns') && (this.scene === 'wave' || this.scene === 'danger' || this.scene === 'boss') ? .82 : 2.6),
      -0.12,
      Math.max(0.58, brightness) * (this.level === 'liver' ? 1.16 : this.level === 'cns' ? 1.1 : 1),
      level('bass'),
      filterScale,
    );

    const melodicEvents = section.melody?.filter((event) => event.step === index);
    if (melodicEvents?.length && density >= 0.34) {
      for (const event of melodicEvents) {
        const pan = Math.sin((bar + event.step) * 0.48) * 0.34;
        this.tone('lead', noteFrequency(event.note), time, stepDuration * event.length, pan, event.velocity, level('lead'), filterScale);
      }
    } else if (!section.melody) {
      const lead = section.lead[index];
      if (lead && density >= 0.36 && (this.scene === 'menu' || (variation + index) % 13 !== 0)) {
        const octave = this.scene === 'menu' ? 1 : variation % 8 === 7 ? 2 : 1;
        this.tone('lead', noteFrequency(lead) * octave, time, stepDuration * 1.65, Math.sin(bar * 0.7) * 0.38, this.scene === 'menu' ? 1.22 : 1.05);
      }
    }
    const doubledEvents = section.leadDouble?.filter((event) => event.step === index);
    if (doubledEvents?.length && (!profile || profile.doubling > 0)) {
      for (const event of doubledEvents) {
        this.tone('lead', noteFrequency(event.note), time, stepDuration * event.length, -.24, event.velocity, level('lead') * (profile?.doubling ?? 1), filterScale);
      }
    }
    const counter = section.counter[index];
    if (counter && density >= 0.48) this.tone('counter', noteFrequency(counter), time, stepDuration * 2.1, 0.48, 0.9, level('counter'), filterScale);
    const arp = section.arp[index];
    if (arp && density >= 0.62) this.tone('arp', noteFrequency(arp), time, stepDuration * 0.8, index % 4 < 2 ? -0.52 : 0.52, 0.9, level('arp'), filterScale);
    const brass = section.brass?.[index];
    if (brass && density >= 0.58) this.tone('brass', noteFrequency(brass), time, stepDuration * 7.5, index % 16 ? 0.2 : -0.2, 0.95, level('brass'), filterScale);
    const strings = section.strings?.[index];
    if (strings && density >= 0.44) this.tone('strings', noteFrequency(strings), time, stepDuration * 4.6, index % 8 ? 0.34 : -0.34, 0.88, level('strings'), filterScale);
    const soloEvents = section.solo?.filter((event) => event.step === index);
    if (soloEvents?.length && density >= 0.5) {
      for (const event of soloEvents) {
        this.tone('solo', noteFrequency(event.note), time, stepDuration * event.length, 0.18, event.velocity, level('solo'), filterScale);
        if (this.level === 'liver' && this.scene === 'boss' && this.bossPhase >= 3) {
          this.tone('solo', noteFrequency(event.note) * .5, time, stepDuration * event.length * .96, -0.18, event.velocity * .34);
        }
      }
    }

    const drumLevel = level('drums');
    const reactiveHat = profile?.fullerHats && index % 2 === 0 ? 'x' : null;
    const hat = section.hat[index] ?? reactiveHat;
    if (drumLevel > 0 && density >= 0.55 && section.kick[index]) this.kick(time, section.kick[index] === 'o', drumLevel);
    if (drumLevel > 0 && density >= 0.62 && section.snare[index]) this.snare(time, section.snare[index] === 'o', drumLevel);
    if (drumLevel > 0 && density >= 0.72 && hat) this.hat(time, hat === 'o', drumLevel);
    if (drumLevel > 0 && density >= 0.66 && section.tom?.[index]) this.tom(time, section.tom[index] === 'o', drumLevel);
    if (section.texture[index]) this.texture(time, stepDuration * 7, brightness);
  }

  private tone(layer: Exclude<Layer, 'drums' | 'texture'>, frequency: number, time: number, duration: number, pan: number, velocity: number, level = 1, filterScale = 1): void {
    const ctx = this.ctx;
    const bus = this.layerBuses[layer];
    if (!ctx || !bus || frequency <= 0 || this.activeVoices >= VOICE_LIMIT) return;
    const hepaticPlayback = this.level === 'liver' && this.scene !== 'menu';
    const cnsPlayback = this.level === 'cns' && this.scene !== 'menu';
    const def = hepaticPlayback ? HEPATIC_VOICES[layer] ?? VOICES[layer] : cnsPlayback ? CNS_VOICES[layer] ?? VOICES[layer] : VOICES[layer];
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.75, Math.min(0.75, pan));
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(def.cutoff * Math.max(0.55, velocity) * filterScale, time);
    filter.Q.value = def.resonance;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(def.gain * velocity * level, time + def.attack);
    gain.gain.setTargetAtTime(0.0001, Math.max(time + def.attack, time + duration - def.release), Math.max(0.015, def.release / 4));
    const driven = (hepaticPlayback || cnsPlayback)
      && (this.scene === 'wave' || this.scene === 'danger' || this.scene === 'boss')
      && (layer === 'bass' || layer === 'solo');
    const saturation = driven ? ctx.createWaveShaper() : null;
    if (saturation) {
      saturation.curve = this.scene === 'danger' || this.bossPhase >= 3
        ? HEPATIC_REDLINE_CURVE
        : HEPATIC_DRIVE_CURVE;
      saturation.oversample = '2x';
      filter.connect(saturation);
      saturation.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(panner);
    panner.connect(bus);

    const waves: Partial<Record<typeof layer, OscillatorType[]>> = hepaticPlayback ? {
      bass: ['triangle', 'sawtooth'], pad: ['sawtooth', 'triangle'],
      lead: ['sawtooth', 'square'], counter: ['triangle', 'sine'], arp: ['triangle', 'square'],
      brass: ['sawtooth', 'triangle'], strings: ['triangle', 'sine'], solo: ['triangle', 'sawtooth'],
    } : cnsPlayback ? {
      bass: ['square', 'triangle'], pad: ['sawtooth', 'sine'], lead: ['sawtooth', 'square'],
      counter: ['square', 'triangle'], arp: ['square', 'triangle'], brass: ['sawtooth', 'square'],
      strings: ['triangle', 'sine'], solo: ['sawtooth', 'triangle'],
    } : {
      bass: ['triangle', 'sawtooth'], pad: ['sine', 'triangle'],
      lead: ['sawtooth', 'square'], counter: ['sine', 'triangle'], arp: ['triangle', 'square'],
      brass: ['sawtooth', 'triangle'],
      strings: ['sawtooth', 'triangle'],
      solo: ['sawtooth', 'triangle'],
    };
    const glideFrom = layer === 'lead'
      ? this.lastLeadFrequency
      : layer === 'solo' ? this.lastSoloFrequency || frequency * .98 : 0;
    const oscillators = (waves[layer] ?? ['sine']).map((wave, i) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(glideFrom || frequency, time);
      if (glideFrom) oscillator.frequency.exponentialRampToValueAtTime(frequency, time + (layer === 'solo' ? .055 : hepaticPlayback || cnsPlayback ? .065 : .045));
      const spread = (hepaticPlayback || cnsPlayback) && layer === 'solo' ? 7 : (hepaticPlayback || cnsPlayback) && layer === 'pad' ? 11 : (hepaticPlayback || cnsPlayback) && layer === 'lead' ? 7 : hepaticPlayback || cnsPlayback ? 3 : 5;
      oscillator.detune.value = i === 0 ? -spread : i === 1 ? spread : 0;
      oscillator.connect(filter);
      oscillator.start(time);
      safeStop(oscillator, time + duration + def.release + 0.08);
      return oscillator;
    });
    if (layer === 'lead') this.lastLeadFrequency = frequency;
    if (layer === 'solo') this.lastSoloFrequency = frequency;
    const modulationNodes: AudioNode[] = [];
    if (layer === 'lead' || layer === 'strings' || layer === 'solo') {
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.frequency.value = layer === 'strings' ? 4.4 : layer === 'solo' ? 6 : 5.2;
      vibratoGain.gain.value = layer === 'strings' ? 4 : layer === 'solo' ? 8 : 7;
      vibrato.connect(vibratoGain);
      for (const oscillator of oscillators) vibratoGain.connect(oscillator.detune);
      vibrato.start(time);
      safeStop(vibrato, time + duration + def.release);
      modulationNodes.push(vibrato, vibratoGain);
    }
    this.activeVoices += 1;
    const cleanup = (): void => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      for (const node of [...oscillators, ...modulationNodes, filter, saturation, gain, panner]) node?.disconnect();
    };
    oscillators[0].onended = cleanup;
  }

  private scheduleWaveTransition(time: number, transition: 'start' | 'clear'): void {
    const stepDuration = 60 / arrangementFor(this.level, this.scene).bpm / 4;
    if (transition === 'start') {
      this.kick(time, true, 1.12);
      this.hat(time + .012, true, 1.05);
      return;
    }
    this.tom(time, true, .72);
    this.texture(time, stepDuration * 8, .5);
  }

  private kick(time: number, strong: boolean, level = 1): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    if ((this.level === 'liver' || this.level === 'cns') && this.scene !== 'menu') this.pumpTonalLayers(time, strong);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(strong ? 145 : 110, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.13);
    const hepaticPunch = this.level === 'liver' ? 1.12 : this.level === 'cns' ? 1.08 : 1;
    gain.gain.setValueAtTime((strong ? 0.34 : 0.22) * hepaticPunch * level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    oscillator.connect(gain); gain.connect(bus);
    oscillator.start(time); safeStop(oscillator, time + 0.2);
    this.activeVoices += 1;
    oscillator.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 1); oscillator.disconnect(); gain.disconnect(); };
  }

  private pumpTonalLayers(time: number, strong: boolean): void {
    if (!this.tonalDuck) return;
    const gain = this.tonalDuck.gain;
    gain.setValueAtTime(1, time);
    gain.linearRampToValueAtTime(strong ? 0.82 : 0.88, time + 0.022);
    gain.setTargetAtTime(1, time + 0.045, 0.075);
  }

  private snare(time: number, strong: boolean, level = 1): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise();
    const hepaticGate = (this.level === 'liver' || this.level === 'cns') && this.scene !== 'menu';
    filter.type = 'bandpass'; filter.frequency.value = hepaticGate ? 1500 : 1800; filter.Q.value = hepaticGate ? 0.55 : 0.7;
    gain.gain.setValueAtTime((strong ? (hepaticGate ? .25 : .18) : (hepaticGate ? .15 : .11)) * level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (hepaticGate ? .34 : .16));
    source.connect(filter); filter.connect(gain); gain.connect(bus);
    if (hepaticGate && this.reverb) gain.connect(this.reverb);
    source.start(time); safeStop(source, time + (hepaticGate ? .36 : .18));
    this.trackTransient(source, source, filter, gain);
  }

  private tom(time: number, low: boolean, level = 1): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const oscillator = ctx.createOscillator();
    const metallic = (this.level === 'liver' || this.level === 'cns') && this.scene !== 'menu' ? ctx.createOscillator() : null;
    const metallicGain = metallic ? ctx.createGain() : null;
    const gain = ctx.createGain();
    oscillator.type = metallic ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(low ? 105 : 135, time);
    oscillator.frequency.exponentialRampToValueAtTime(low ? 62 : 78, time + .16);
    gain.gain.setValueAtTime((low ? .2 : .15) * level, time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .24);
    oscillator.connect(gain);
    if (metallic && metallicGain) {
      metallic.type = 'square';
      metallic.frequency.setValueAtTime((low ? 105 : 135) * 2.71, time);
      metallic.frequency.exponentialRampToValueAtTime((low ? 62 : 78) * 2.2, time + .11);
      metallicGain.gain.setValueAtTime(.055 * level, time);
      metallicGain.gain.exponentialRampToValueAtTime(.0001, time + .13);
      metallic.connect(metallicGain);
      metallicGain.connect(bus);
      metallic.start(time);
      safeStop(metallic, time + .15);
    }
    gain.connect(bus);
    oscillator.start(time);
    safeStop(oscillator, time + .26);
    this.activeVoices += 1;
    oscillator.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      oscillator.disconnect();
      gain.disconnect();
      metallic?.disconnect();
      metallicGain?.disconnect();
    };
  }

  private hat(time: number, open: boolean, level = 1): void {
    const ctx = this.ctx;
    const bus = this.layerBuses.drums;
    if (!ctx || !bus || this.activeVoices >= VOICE_LIMIT) return;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise();
    filter.type = 'highpass'; filter.frequency.value = open ? 5200 : 7200;
    const duration = open ? 0.18 : 0.055;
    gain.gain.setValueAtTime((open ? 0.09 : 0.055) * level, time);
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
    filter.type = 'bandpass';
    const hepaticSweep = this.level === 'liver' && this.scene !== 'menu';
    const baseFrequency = 500 + brightness * 900;
    filter.frequency.setValueAtTime(hepaticSweep ? baseFrequency * .55 : baseFrequency, time);
    if (hepaticSweep) filter.frequency.exponentialRampToValueAtTime(baseFrequency * 1.7, time + duration * .72);
    filter.Q.value = hepaticSweep ? 11 : 8;
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
    this.delay.delayTime.setTargetAtTime(60 / arrangementFor(this.level, this.scene).bpm * 0.75, now, 0.04);
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
