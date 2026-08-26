// Tiny WebAudio synth. Every sound is generated (no assets), all guarded so it
// is a no-op until the user interacts and the context is allowed.
import type { Settings } from '../lib/storage';
import type { AbilityId, HepaticCueKind } from '../game/types';

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private volume = 0.6;

  applySettings(s: Settings): void {
    this.enabled = s.sound;
    this.volume = s.sfxVolume;
    if (this.master) this.master.gain.value = s.sound ? s.sfxVolume : 0;
  }

  ensure(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.4,
    delay = 0,
  ): void {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  place(): void {
    this.blip(520, 0.08, 'triangle', 0.35);
  }

  hit(): void {
    this.blip(240, 0.15, 'sine', 0.25);
  }

  kill(): void {
    this.blip(320, 0.12, 'sawtooth', 0.18);
  }

  wave(): void {
    this.blip(440, 0.25, 'triangle', 0.3);
  }

  ability(id: AbilityId): void {
    const notes: Record<AbilityId, [number, OscillatorType]> = {
      toci: [520, 'sine'], dexa: [260, 'triangle'],
      stemcell: [660, 'sine'],
      anakinra: [740, 'triangle'],
      gcsf: [880, 'sine'],
    };
    const [frequency, wave] = notes[id];
    this.blip(frequency, 0.3, wave, 0.3);
  }

  clear(): void {
    this.blip(620, 0.18, 'triangle', 0.24);
    this.blip(820, 0.2, 'triangle', 0.2, 0.1);
  }

  hepatic(kind: HepaticCueKind): void {
    const cues: Record<HepaticCueKind, Array<[number, number, OscillatorType, number]>> = {
      flareWarn: [[92, .34, 'sawtooth', .2], [138, .25, 'triangle', .14]],
      flareImpact: [[48, .5, 'sine', .42], [96, .22, 'sawtooth', .2]],
      division: [[420, .12, 'triangle', .18], [630, .18, 'sine', .14]],
      obstruction: [[72, .45, 'square', .16], [61, .55, 'sawtooth', .12]],
      shieldBreak: [[260, .18, 'triangle', .2], [520, .3, 'sine', .2]],
      bossPhase2: [[82, .5, 'sawtooth', .24], [123, .4, 'triangle', .2]],
      bossPhase3: [[46, .65, 'sawtooth', .3], [92, .5, 'square', .22]],
    };
    cues[kind].forEach(([frequency, duration, wave, gain], index) =>
      this.blip(frequency, duration, wave, gain, index * .07));
  }

  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.3, i * 0.12));
  }

  lose(): void {
    [400, 320, 250].forEach((f, i) => this.blip(f, 0.35, 'sawtooth', 0.3, i * 0.15));
  }
}
