import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ARRANGEMENTS, HEPATIC_ANSWER, HEPATIC_ARRANGEMENTS, HEPATIC_A_SEQUENCE, HEPATIC_B_SEQUENCE,
  HEPATIC_CHORDS, HEPATIC_FORM_ORDER, HEPATIC_FORM_SECTIONS, HEPATIC_LEITMOTIF, HEPATIC_SCALE,
  HEPATIC_VOICES, DUCK_GAIN, DUCK_SECONDS, Music, VOICES, VOICE_LIMIT,
  CNS_ARRANGEMENTS, CNS_CHORDS, CNS_FORM_ORDER, CNS_FORM_SECTIONS, CNS_LEITMOTIF, CNS_SCALE, CNS_VOICES, cnsStinger,
  arrangementFor, hepaticStinger, hepaticWaveProfile, hepaticWaveTier,
  nextBarStep, noteFrequency, resolveMusicScene, smoothIntensity, variationIndex,
  type MusicSnapshot,
} from './Music';
import { INTRO_BPM, INTRO_LOOP_SECONDS, INTRO_SCENE_SECONDS } from '../lib/introTiming';

const snapshot = (overrides: Partial<MusicSnapshot> = {}): MusicSnapshot => ({
  level: 'marrow', scene: 'wave', wave: 4, intensity: 0.5, crs: 20, neuro: 10,
  hematotoxicity: 20, fitness: 75, leakHeat: 0, bossPhase: 0, hepaticEventPressure: 0, ...overrides,
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
        if (section.strings) expect(section.strings).toHaveLength(32);
        for (const chord of section.chords) {
          expect(chord.length).toBeGreaterThan(0);
          for (const note of chord) expect(noteFrequency(note)).toBeGreaterThan(0);
        }
        for (const layer of ['bass', 'lead', 'counter', 'arp', 'brass', 'strings'] as const) {
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

  it('routes every nonterminal hepatic scene through one continuous 114 BPM form', () => {
    expect(arrangementFor('liver', 'wave')).toBe(HEPATIC_ARRANGEMENTS.wave);
    for (const scene of ['planning', 'wave', 'danger', 'iecHs', 'boss', 'paused'] as const) {
      const arrangement = arrangementFor('liver', scene);
      expect(arrangement.bpm).toBe(114);
      expect(arrangement.sections).toBe(HEPATIC_FORM_SECTIONS);
      expect(arrangement.order).toBe(HEPATIC_FORM_ORDER);
    }
    expect(arrangementFor('marrow', 'wave')).toBe(ARRANGEMENTS.wave);
    expect(arrangementFor('liver', 'boss')).toBe(HEPATIC_ARRANGEMENTS.boss);
    expect(arrangementFor('marrow', 'boss')).toBe(ARRANGEMENTS.wave);
    expect(HEPATIC_FORM_SECTIONS).toHaveLength(40);
    expect(HEPATIC_FORM_ORDER).toEqual(Array.from({ length: 40 }, (_, index) => index));
    expect(HEPATIC_FORM_SECTIONS.length * 2).toBe(80);
    expect(80 * 4 * 60 / 114).toBeCloseTo(168.421, 3);
    expect(HEPATIC_ARRANGEMENTS.victory?.bpm).toBe(114);
    expect(HEPATIC_ARRANGEMENTS.loss?.bpm).toBe(114);
    expect(HEPATIC_VOICES.lead).not.toEqual(VOICES.lead);
    expect(HEPATIC_VOICES.bass?.release).toBeLessThan(VOICES.bass.release);
    expect(HEPATIC_VOICES.lead?.resonance).toBeLessThan(VOICES.lead.resonance);
    expect(HEPATIC_VOICES.lead?.cutoff).toBeGreaterThan(VOICES.lead.cutoff);
  });

  it('routes Neuroaxis through a continuous 96-bar E-minor industrial form', () => {
    for (const scene of ['planning', 'wave', 'danger', 'iecHs', 'boss', 'paused'] as const) {
      const arrangement = arrangementFor('cns', scene);
      expect(arrangement.bpm).toBe(118);
      expect(arrangement.sections).toBe(CNS_FORM_SECTIONS);
      expect(arrangement.order).toBe(CNS_FORM_ORDER);
    }
    expect(CNS_FORM_SECTIONS).toHaveLength(48);
    expect(CNS_FORM_ORDER).toEqual(Array.from({ length: 48 }, (_, index) => index));
    expect(CNS_FORM_SECTIONS.length * 2).toBe(96);
    expect(CNS_LEITMOTIF).toEqual(['E4', 'G4', 'B4', 'D5', 'B4', 'G4']);
    expect(CNS_ARRANGEMENTS.victory?.bpm).toBe(118);
    expect(CNS_ARRANGEMENTS.loss?.bpm).toBe(118);
    expect(CNS_VOICES.lead).not.toEqual(VOICES.lead);
    const pitchClass = (note: string): string => note.replace(/-?\d$/, '');
    const expectedRoots = Array.from({ length: 96 }, (_, bar) => ['E', 'C', 'G', 'D'][bar % 4]);
    expect(CNS_FORM_SECTIONS.flatMap((section) => section.chords.map((notes) => pitchClass(notes[0])))).toEqual(expectedRoots);
    for (const section of CNS_FORM_SECTIONS) {
      const pitches = [...section.chords.flat(), ...section.bass, ...section.arp, ...(section.melody?.map((event) => event.note) ?? [])]
        .filter((note): note is string => Boolean(note));
      expect(pitches.every((note) => CNS_SCALE.includes(pitchClass(note) as typeof CNS_SCALE[number]))).toBe(true);
      for (let step = 0; step < 32; step += 1) {
        const activeChord = section.chords[Math.floor(step / 16)].map(pitchClass);
        if (section.arp[step]) expect(activeChord).toContain(pitchClass(section.arp[step]!));
      }
      for (const accent of [0, 6, 12, 16, 22, 28]) {
        if (section.kick.some(Boolean)) expect(section.kick[accent]).not.toBeNull();
      }
    }
    expect(CNS_FORM_SECTIONS[0].chords[0]).toBe(CNS_CHORDS.tonic);
    expect(cnsStinger('waveStart', 0)).toEqual(['E3', 'G3', 'B3']);
  });

  it('retains the wave-tier helper without allowing tiers to replace the authored form', () => {
    expect(hepaticWaveTier(1)).toBe(1);
    expect(hepaticWaveTier(3)).toBe(1);
    expect(hepaticWaveTier(4)).toBe(2);
    expect(hepaticWaveTier(6)).toBe(2);
    expect(hepaticWaveTier(7)).toBe(3);
    expect(hepaticWaveTier(10)).toBe(3);
    for (const scene of ['planning', 'wave', 'danger', 'iecHs', 'boss', 'paused'] as const) {
      expect(HEPATIC_ARRANGEMENTS[scene]!.waveTierOrders).toBeUndefined();
      expect(HEPATIC_ARRANGEMENTS[scene]!.bossPhaseOrders).toBeUndefined();
    }
  });

  it('builds bounded monotonic hepatic wave profiles without changing composition data', () => {
    const profiles = Array.from({ length: 10 }, (_, index) => hepaticWaveProfile(index + 1, 'combat', 0));
    expect(profiles.map((profile) => profile.tier)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
    for (const key of ['filter', 'bass', 'arp', 'drums', 'lead', 'doubling'] as const) {
      for (let index = 1; index < profiles.length; index += 1) {
        expect(profiles[index][key]).toBeGreaterThanOrEqual(profiles[index - 1][key]);
      }
    }
    expect(profiles[0]).toMatchObject({ filter: .82, bass: .88, arp: .76, drums: .82, lead: .96, doubling: 0, fullerHats: false });
    expect(profiles[2].doubling).toBe(0);
    expect(profiles[3].doubling).toBeGreaterThan(0);
    expect(profiles[6].fullerHats).toBe(true);
    expect(profiles[9]).toMatchObject({ filter: 1.1, bass: 1.1, arp: 1, drums: 1.1, lead: 1.08, doubling: 1, fullerHats: true });
    expect(HEPATIC_FORM_SECTIONS).toHaveLength(40);
  });

  it('uses a quiet planning profile for the upcoming wave', () => {
    const first = hepaticWaveProfile(1, 'planning', 0);
    const final = hepaticWaveProfile(10, 'planning', 0);
    expect(first).toMatchObject({ phase: 'planning', filter: .68, bass: .5, arp: .48, drums: 0, lead: .78, doubling: 0, fullerHats: false });
    expect(final).toMatchObject({ phase: 'planning', filter: .76, bass: .6, arp: .56, drums: 0, lead: .78, doubling: 0, fullerHats: false });
    expect(final.filter).toBeGreaterThan(first.filter);
  });

  it('defines the memorable F# minor motif, answer, and complete section form', () => {
    expect(HEPATIC_LEITMOTIF).toEqual(['F#4', 'A4', 'B4', 'C#5', 'E5', 'G#5', 'F#5', 'E5']);
    expect(HEPATIC_ANSWER).toEqual(['D5', 'F#5', 'E5', 'D5', 'E5', 'G#5', 'A5', 'B5', 'G#5']);
    expect(HEPATIC_A_SEQUENCE).toEqual(['M', 'Q', 'M', 'Qcad', 'M', 'Q', "M'", 'Qcad']);
    expect(HEPATIC_B_SEQUENCE).toEqual(['D1', 'D2', 'D1', 'Qcad', "M'", 'D2', 'M', 'Qcad']);

    const primary = (start: number): ReadonlyArray<ReadonlyArray<unknown>> =>
      HEPATIC_FORM_SECTIONS.slice(start, start + 8).map((section) => section.melody!);
    expect(primary(4)).toEqual(primary(12));
    expect(primary(4)).toEqual(primary(28));
    expect(HEPATIC_FORM_SECTIONS.slice(12, 20).some((section) => section.leadDouble?.length)).toBe(true);
    expect(HEPATIC_FORM_SECTIONS.slice(28, 36).some((section) => section.leadDouble?.length)).toBe(true);
    expect(HEPATIC_FORM_SECTIONS.slice(20, 28).map((section) => section.name.split('-').at(-1)))
      .toEqual(HEPATIC_B_SEQUENCE);
  });

  it('defines bounded hepatic melodies and chord-aware event stingers', () => {
    for (const arrangement of Object.values(HEPATIC_ARRANGEMENTS)) {
      for (const section of arrangement!.sections) {
        for (const event of [...section.melody ?? [], ...section.leadDouble ?? [], ...section.solo ?? []]) {
          expect(Number.isInteger(event.step)).toBe(true);
          expect(event.step).toBeGreaterThanOrEqual(0);
          expect(event.step).toBeLessThan(32);
          expect(noteFrequency(event.note)).toBeGreaterThan(0);
          expect(event.length).toBeGreaterThan(0);
          expect(event.length).toBeLessThanOrEqual(12);
          expect(event.velocity).toBeGreaterThan(0);
          expect(event.velocity).toBeLessThanOrEqual(1);
        }
      }
    }
    expect(HEPATIC_ARRANGEMENTS.wave!.sections.some((section) =>
      section.melody!.some((event) => event.step % 4 !== 0))).toBe(true);
    const chordPitchClasses = [
      ['F#', 'A', 'C#'], ['E', 'G#', 'B'], ['D', 'F#', 'A'], ['E', 'G#', 'B'],
    ];
    for (let bar = 0; bar < 4; bar += 1) {
      for (const event of ['waveStart', 'warning', 'flareWarn', 'flareImpact', 'division', 'bossPhase3'] as const) {
        expect(hepaticStinger(event, bar)!.every((note) =>
          chordPitchClasses[bar].includes(note.replace(/-?\d$/, '')))).toBe(true);
      }
    }
    expect(hepaticStinger('hepaticSelect', 0)).toEqual(['F#2', 'C#3', 'A3', 'F#3']);
    expect(hepaticStinger('waveStart', 0)).toEqual(['F#4', 'A4', 'C#5']);
    expect(hepaticStinger('waveClear', 0)).toEqual(['C#5', 'A4', 'F#4']);
  });

  it('holds F#m-E-D-E, keeps every arp chordal, and anchors every strong lead onset', () => {
    const pitchClass = (note: string): string => note.replace(/-?\d$/, '');
    const expectedRoots = Array.from({ length: 80 }, (_, bar) => ['F#', 'E', 'D', 'E'][bar % 4]);
    const actualRoots = HEPATIC_FORM_SECTIONS.flatMap((section) => section.chords.map((notes) => pitchClass(notes[0])));
    expect(actualRoots).toEqual(expectedRoots);
    expect(HEPATIC_FORM_SECTIONS.every((section) => section.stepsPerChord === 16)).toBe(true);

    let strong = 0;
    let chordal = 0;
    for (const section of HEPATIC_FORM_SECTIONS) {
      const pitched = [
        ...section.chords.flat(), ...section.bass, ...section.arp,
        ...(section.melody?.map((event) => event.note) ?? []),
        ...(section.leadDouble?.map((event) => event.note) ?? []),
      ].filter((note): note is string => Boolean(note));
      expect(pitched.every((note) => HEPATIC_SCALE.includes(pitchClass(note) as typeof HEPATIC_SCALE[number]))).toBe(true);
      for (let step = 0; step < 32; step += 1) {
        const activeChord = section.chords[Math.floor(step / 16)].map(pitchClass);
        const arpNote = section.arp[step];
        if (arpNote) expect(activeChord).toContain(pitchClass(arpNote));
      }
      for (const event of section.melody ?? []) {
        if (event.step % 4 !== 0) continue;
        strong += 1;
        const activeChord = section.chords[Math.floor(event.step / 16)].map(pitchClass);
        if (activeChord.includes(pitchClass(event.note))) chordal += 1;
      }
      for (const note of section.bass.filter((value): value is string => Boolean(value))) {
        const pc = pitchClass(note);
        expect(['F#', 'C#', 'E', 'B', 'D', 'A']).toContain(pc);
      }
    }
    expect(chordal / strong).toBe(1);
    expect(HEPATIC_FORM_SECTIONS[39].chords[1]).toBe(HEPATIC_CHORDS.subtonic);
    expect(HEPATIC_FORM_SECTIONS[0].chords[0]).toBe(HEPATIC_CHORDS.tonic);
    expect(HEPATIC_FORM_SECTIONS[39].melody?.at(-1)).toMatchObject({ note: 'E5', step: 16, length: 12 });
  });

  it('uses classic drums, full sixteenth arps, and fills only at major boundaries', () => {
    for (const section of HEPATIC_FORM_SECTIONS.slice(0, 4)) {
      expect(section.kick.some(Boolean)).toBe(false);
      expect(section.snare.some(Boolean)).toBe(false);
      expect(section.hat.some(Boolean)).toBe(false);
    }
    for (const section of HEPATIC_FORM_SECTIONS.slice(4, 36)) {
      expect(section.arp.every(Boolean)).toBe(true);
      for (const step of [4, 12, 20, 28]) expect(section.snare[step]).toBe('o');
    }
    const fillBars = HEPATIC_FORM_SECTIONS.flatMap((section, index) =>
      section.tom?.some(Boolean) ? [(index + 1) * 2] : []);
    expect(fillBars).toEqual([24, 40, 56, 72]);
  });

  it('keeps the primary melody within F#4-B5 and octave doubles no higher than C#6', () => {
    const frequencies = HEPATIC_FORM_SECTIONS.flatMap((section) => section.melody?.map((event) => noteFrequency(event.note)) ?? []);
    expect(Math.min(...frequencies)).toBe(noteFrequency('F#4'));
    expect(Math.max(...frequencies)).toBe(noteFrequency('B5'));
    for (const section of HEPATIC_FORM_SECTIONS) {
      for (const event of section.leadDouble ?? []) {
        expect(noteFrequency(event.note)).toBeLessThanOrEqual(noteFrequency('C#6'));
      }
    }
  });

  it('uses separate four-bar terminal cues without changing key or progression', () => {
    for (const scene of ['victory', 'loss'] as const) {
      const arrangement = HEPATIC_ARRANGEMENTS[scene]!;
      expect(arrangement.sections).toHaveLength(2);
      expect(arrangement.order).toEqual([0, 1]);
      expect(arrangement.sections.flatMap((section) => section.chords.map((notes) => notes[0].replace(/-?\d$/, ''))))
        .toEqual(['F#', 'E', 'D', 'E']);
    }
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
    expect(resolveMusicScene(snapshot({ scene: 'boss', bossPhase: 2 }))).toBe('boss');
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
  buffer: unknown = null; curve: Float32Array | null = null; oversample = ''; type = ''; onended: (() => void) | null = null;
  connect = vi.fn(() => this); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
  getChannelData(): Float32Array { return new Float32Array(8); }
}
class FakeAudioContext {
  currentTime = 1; sampleRate = 8; state = 'running'; destination = new FakeNode();
  gains: FakeNode[] = [];
  oscillators: FakeNode[] = [];
  waveShapers: FakeNode[] = [];
  panners: FakeNode[] = [];
  close = vi.fn(async () => undefined); resume = vi.fn(async () => undefined);
  createGain = (): GainNode => {
    const gain = new FakeNode();
    this.gains.push(gain);
    return gain as unknown as GainNode;
  };
  createDynamicsCompressor = (): DynamicsCompressorNode => new FakeNode() as unknown as DynamicsCompressorNode;
  createConvolver = (): ConvolverNode => new FakeNode() as unknown as ConvolverNode;
  createDelay = (): DelayNode => new FakeNode() as unknown as DelayNode;
  createBiquadFilter = (): BiquadFilterNode => new FakeNode() as unknown as BiquadFilterNode;
  createWaveShaper = (): WaveShaperNode => {
    const waveShaper = new FakeNode();
    this.waveShapers.push(waveShaper);
    return waveShaper as unknown as WaveShaperNode;
  };
  createStereoPanner = (): StereoPannerNode => {
    const panner = new FakeNode();
    this.panners.push(panner);
    return panner as unknown as StereoPannerNode;
  };
  createOscillator = (): OscillatorNode => {
    const oscillator = new FakeNode();
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  };
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
    music.trigger('flareWarn');
    music.trigger('flareImpact');
    music.trigger('bossPhase3');
    expect(music.activeVoiceCount).toBeLessThanOrEqual(VOICE_LIMIT);
    music.restartMenu();
    expect(music.currentScene).toBe('menu');
    expect(music.currentStep).toBe(0);
    music.dispose();
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(music.activeVoiceCount).toBe(0);
  });

  it('places hepatic musical cues in the requested lane', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    music.update(snapshot({ level: 'liver' }));
    music.unlock();
    music.trigger('flareWarn', { pan: -0.6 });
    expect(contexts[0].panners.slice(-hepaticStinger('flareWarn', 0)!.length)
      .every((panner) => panner.pan.value === -0.6)).toBe(true);
    music.trigger('division', { pan: 0.6 });
    expect(contexts[0].panners.slice(-hepaticStinger('division', 0)!.length)
      .every((panner) => panner.pan.value === 0.6)).toBe(true);
    music.dispose();
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

  it('resets the transport to the hepatic intro only when a level starts', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    music.unlock();
    contexts[0].currentTime = 2;
    vi.advanceTimersByTime(25);
    expect(music.currentStep).toBeGreaterThan(0);

    music.startLevel('liver');
    expect(music.currentStep).toBe(0);
    expect(music.currentScene).toBe('planning');
    expect(music.queuedScene).toBeNull();
    expect(music.currentHepaticProfile).toEqual(hepaticWaveProfile(1, 'planning', 0));
    music.dispose();
  });

  it('commits wave profiles and transition accents once at bar boundaries', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    const transition = vi.spyOn(
      music as unknown as { scheduleWaveTransition(time: number, kind: 'start' | 'clear'): void },
      'scheduleWaveTransition',
    );
    music.startLevel('liver');
    music.unlock();
    vi.advanceTimersByTime(25);
    const before = music.currentStep;

    music.trigger('waveStart');
    music.update(snapshot({ level: 'liver', scene: 'wave', wave: 4 }));
    expect(music.currentHepaticProfile.phase).toBe('planning');
    expect(music.queuedHepaticProfile).toMatchObject({ phase: 'combat', wave: 4, tier: 2 });
    expect(music.queuedWaveTransition).toBe('start');
    expect(music.currentStep).toBe(before);

    contexts[0].currentTime = 3.3;
    vi.advanceTimersByTime(25);
    expect(music.currentHepaticProfile).toMatchObject({ phase: 'combat', wave: 4, tier: 2 });
    expect(music.queuedHepaticProfile).toBeNull();
    expect(music.queuedWaveTransition).toBeNull();
    expect(music.currentStep).toBeGreaterThan(before);
    expect(transition).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenLastCalledWith(expect.any(Number), 'start');

    contexts[0].currentTime = 5.4;
    vi.advanceTimersByTime(25);
    expect(transition).toHaveBeenCalledOnce();

    music.trigger('waveClear');
    music.update(snapshot({ level: 'liver', scene: 'planning', wave: 5 }));
    contexts[0].currentTime = 7.6;
    vi.advanceTimersByTime(25);
    expect(music.currentHepaticProfile).toMatchObject({ phase: 'planning', wave: 5, tier: 2, drums: 0, doubling: 0 });
    expect(transition).toHaveBeenCalledTimes(2);
    expect(transition).toHaveBeenLastCalledWith(expect.any(Number), 'clear');
    music.dispose();
  });

  it('keeps Hepatic phrase position through planning and wave transitions', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    music.unlock();
    music.update(snapshot({ level: 'liver', scene: 'planning' }));
    vi.advanceTimersByTime(25);
    expect(music.currentScene).toBe('planning');
    const planningStep = music.currentStep;

    music.update(snapshot({ level: 'liver', scene: 'wave' }));
    expect(music.queuedScene).toBe('wave');
    contexts[0].currentTime = 3.2;
    vi.advanceTimersByTime(25);
    expect(music.currentScene).toBe('wave');
    expect(music.currentStep).toBeGreaterThan(planningStep);
    const waveStep = music.currentStep;

    music.update(snapshot({ level: 'liver', scene: 'planning' }));
    contexts[0].currentTime = 5.4;
    vi.advanceTimersByTime(25);
    expect(music.currentScene).toBe('planning');
    expect(music.currentStep).toBeGreaterThan(waveStep);
    music.dispose();
  });

  it('uses a short gated envelope and saturation for the hepatic sub-bass', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    music.update(snapshot({ level: 'liver', scene: 'wave' }));
    (music as unknown as { step: number }).step = 128;
    music.unlock();
    vi.advanceTimersByTime(25);

    const bassFrequency = noteFrequency('F#2');
    const bassOscillators = contexts[0].oscillators.filter((oscillator) =>
      oscillator.frequency.setValueAtTime.mock.calls.some(([frequency]) => frequency === bassFrequency));
    const stepDuration = 60 / 114 / 4;
    const expectedStop = 1.06 + stepDuration * .82 + .11 + .08;
    expect(bassOscillators.some((oscillator) =>
      oscillator.stop.mock.calls.some(([time]) => time === expectedStop))).toBe(true);
    expect(contexts[0].waveShapers).toHaveLength(1);
    expect(contexts[0].waveShapers[0].curve).toHaveLength(256);
    expect(contexts[0].waveShapers[0].oversample).toBe('2x');
    expect(music.currentWaveTier).toBe(2);
    music.dispose();
  });

  it('applies hepatic boss phase changes only at bar boundaries', () => {
    vi.useFakeTimers();
    const contexts: FakeAudioContext[] = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext { constructor() { super(); contexts.push(this); } },
    });
    const music = new Music();
    music.unlock();
    music.update(snapshot({ level: 'liver', scene: 'boss', bossPhase: 1 }));
    vi.advanceTimersByTime(25);
    expect(music.currentScene).toBe('boss');
    expect(music.currentBossPhase).toBe(1);
    contexts[0].currentTime = 2.2;
    vi.advanceTimersByTime(25);
    music.update(snapshot({ level: 'liver', scene: 'boss', bossPhase: 2, hepaticEventPressure: 1 }));
    expect(music.currentBossPhase).toBe(1);
    expect(music.queuedBossPhase).toBe(2);
    contexts[0].currentTime = 3.2;
    vi.advanceTimersByTime(25);
    expect(music.currentBossPhase).toBe(2);
    music.dispose();
  });
});
