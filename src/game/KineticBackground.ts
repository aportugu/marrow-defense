import { CANVAS_H, CANVAS_W } from './types';
import type { GamePhase, SubPhase } from './types';
import { mulberry32 } from '../lib/rng';
import { posAt, type PathDef } from '../lib/path';

export type KineticEventKind =
  | 'waveStart'
  | 'waveClear'
  | 'leak'
  | 'toci'
  | 'dexa'
  | 'stemcell'
  | 'iecHsOnset'
  | 'anakinra'
  | 'gcsf';

export interface KineticSignals {
  phase: GamePhase;
  subPhase: SubPhase;
  waveProgress: number;
  crs: number;
  neuro: number;
  burden: number;
  leakHeat: number;
  hyperinflammation: number;
  iecHsActive: boolean;
  hematotoxicity: number;
  stemCellRecovery: boolean;
  gcsfSupport: boolean;
  reducedMotion: boolean;
}

export interface KineticDescriptor {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  depth: number;
}

export function healthyMoteFraction(hematotoxicity: number, gcsfSupport = false): number {
  const baseline = Math.max(0.35, 1 - Math.max(0, Math.min(100, hematotoxicity)) / 130);
  return Math.min(1, baseline + (gcsfSupport ? 0.12 : 0));
}

interface TimedEvent {
  kind: KineticEventKind;
  at: number;
}

const EVENT_COLOR: Record<KineticEventKind, string> = {
  waveStart: '34,211,238',
  waveClear: '57,217,138',
  leak: '255,91,91',
  toci: '34,211,238',
  dexa: '176,107,255',
  stemcell: '57,217,138',
  iecHsOnset: '251,146,60',
  anakinra: '103,232,249',
  gcsf: '217,249,157',
};

export function createKineticDescriptors(count: number, seed = 0x4d415252): KineticDescriptor[] {
  const rng = mulberry32(seed);
  return Array.from({ length: Math.min(120, Math.max(0, count)) }, () => ({
    x: rng() * CANVAS_W,
    y: rng() * CANVAS_H,
    size: 1.2 + rng() * 4.8,
    speed: 7 + rng() * 30,
    phase: rng() * Math.PI * 2,
    depth: 0.2 + rng() * 0.8,
  }));
}

export class KineticBackground {
  readonly descriptors = createKineticDescriptors(120);
  private events: TimedEvent[] = [];
  private baseGradient: CanvasGradient | null = null;

  pushEvent(kind: KineticEventKind, time: number): void {
    this.events.push({ kind, at: time });
    if (this.events.length > 12) this.events.shift();
  }

  activeEvents(time: number): readonly TimedEvent[] {
    this.events = this.events.filter((event) => time - event.at < 1.4);
    return this.events;
  }

  render(
    ctx: CanvasRenderingContext2D,
    time: number,
    path: PathDef,
    signals: KineticSignals,
  ): void {
    if (!this.baseGradient) {
      this.baseGradient = ctx.createRadialGradient(
        CANVAS_W * 0.5, CANVAS_H * 0.5, 70,
        CANVAS_W * 0.5, CANVAS_H * 0.5, CANVAS_W * 0.72,
      );
      this.baseGradient.addColorStop(0, '#2a0f1c');
      this.baseGradient.addColorStop(1, '#160610');
    }
    ctx.fillStyle = this.baseGradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const menu = signals.phase === 'menu';
    const count = menu ? 120 : 80;
    const t = signals.reducedMotion ? 0 : time;
    const intensity = Math.min(
      1,
      0.12 + signals.waveProgress * 0.32 + signals.crs / 250 + signals.neuro / 300 + signals.hyperinflammation / 280 + signals.hematotoxicity / 450 + signals.leakHeat * 0.2,
    );
    const flowScale = 0.65 + intensity * 0.75;

    ctx.save();
    const breath = signals.reducedMotion ? 0.5 : 0.5 + Math.sin(t * 0.7) * 0.5;
    const glow = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, 25,
      CANVAS_W / 2, CANVAS_H / 2, 600,
    );
    glow.addColorStop(0, `rgba(176,67,214,${0.07 + breath * (menu ? 0.08 : 0.035)})`);
    glow.addColorStop(1, 'rgba(176,67,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Deep stromal silhouettes.
    for (let i = 0; i < Math.min(count, 28); i++) {
      const d = this.descriptors[i];
      const x = (d.x + t * d.speed * 0.12 * d.depth) % CANVAS_W;
      const y = d.y + Math.sin(t * 0.16 + d.phase) * 12;
      ctx.globalAlpha = menu ? 0.07 : 0.035;
      ctx.fillStyle = i % 2 ? '#7a1f5c' : '#4b1837';
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + d.size * 5, 10 + d.size * 3, d.phase, 0, Math.PI * 2);
      ctx.fill();
    }

    // Organelle motes.
    const moteStart = 28;
    const healthyFraction = menu ? 1 : healthyMoteFraction(signals.hematotoxicity, signals.gcsfSupport);
    const moteEnd = Math.min(count, moteStart + Math.floor(((menu ? 84 : 60) - moteStart) * healthyFraction));
    for (let i = moteStart; i < moteEnd; i++) {
      const d = this.descriptors[i];
      const x = (d.x + t * d.speed * flowScale) % CANVAS_W;
      const y = (d.y + t * d.speed * 0.18 + Math.sin(t + d.phase) * 8) % CANVAS_H;
      ctx.globalAlpha = Math.min(0.25, (menu ? 0.1 : 0.055) + d.depth * 0.08);
      ctx.fillStyle = i % 3 === 0 ? '#a5f3fc' : i % 3 === 1 ? '#e9d5ff' : '#f9a8d4';
      ctx.beginPath();
      ctx.arc(x, y, d.size * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }

    // Plasma particles flow through the marrow vessel.
    const flowStart = menu ? 84 : 60;
    for (let i = flowStart; i < count; i++) {
      const d = this.descriptors[i];
      const distance = ((d.x / CANVAS_W) * path.length + t * d.speed * 1.8 * flowScale) % path.length;
      const p = posAt(path, distance);
      const offset = Math.sin(t * 0.8 + d.phase) * (8 + d.depth * 10);
      ctx.globalAlpha = Math.min(0.25, menu ? 0.2 : 0.08 + intensity * 0.07);
      ctx.fillStyle = i % 2 ? '#fbcfe8' : '#c4b5fd';
      ctx.beginPath();
      ctx.arc(p.x, p.y + offset, 1 + d.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Toxicity tint is intentionally restrained and remains below all entities.
    if (signals.crs > 35 || signals.neuro > 35) {
      ctx.globalAlpha = Math.min(0.16, Math.max(signals.crs, signals.neuro) / 600);
      ctx.fillStyle = signals.crs >= signals.neuro ? '#ff5b3d' : '#8b5cf6';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (signals.iecHsActive) {
      ctx.globalAlpha = Math.min(0.18, 0.05 + signals.hyperinflammation / 700);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      const macrophages = Math.min(14, 3 + Math.floor(signals.hyperinflammation / 9));
      for (let i = 0; i < macrophages; i++) {
        const d = this.descriptors[28 + i];
        const drift = signals.reducedMotion ? 0 : t * d.speed * 0.16;
        const x = (d.x + drift) % CANVAS_W;
        const y = d.y + (signals.reducedMotion ? 0 : Math.sin(t * 0.35 + d.phase) * 9);
        ctx.globalAlpha = Math.min(0.2, 0.07 + signals.hyperinflammation / 900);
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(x, y, 5 + d.size, 0, Math.PI * 2);
        ctx.arc(x + 5, y - 3, 3 + d.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (signals.hematotoxicity > 15) {
      const injuryCount = Math.min(12, Math.ceil(signals.hematotoxicity / 8));
      for (let i = 0; i < injuryCount; i++) {
        const d = this.descriptors[44 + i];
        const x = d.x;
        const y = d.y + (signals.reducedMotion ? 0 : Math.sin(t * 0.24 + d.phase) * 5);
        ctx.globalAlpha = Math.min(0.16, 0.04 + signals.hematotoxicity / 1000);
        ctx.strokeStyle = '#b4535a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 3 + d.size, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (signals.stemCellRecovery) {
      for (let i = 0; i < 14; i++) {
        const d = this.descriptors[66 + i];
        const progress = signals.reducedMotion ? 0.45 : (t * 0.22 + d.phase / (Math.PI * 2)) % 1;
        const p = posAt(path, progress * path.length);
        ctx.globalAlpha = signals.reducedMotion ? 0.14 : 0.08 + 0.12 * (1 - progress);
        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + d.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (signals.gcsfSupport) {
      for (let i = 0; i < 8; i++) {
        const d = this.descriptors[82 + i];
        const progress = signals.reducedMotion ? 0.55 : (t * 0.38 + d.phase / (Math.PI * 2)) % 1;
        const p = posAt(path, progress * path.length);
        ctx.globalAlpha = signals.reducedMotion ? 0.13 : 0.07 + 0.1 * (1 - progress);
        ctx.fillStyle = i % 2 ? '#ecfccb' : '#bbf7d0';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5 + d.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const event of this.activeEvents(time)) {
      const age = Math.max(0, time - event.at);
      const progress = signals.reducedMotion ? 0.5 : age / 1.4;
      ctx.globalAlpha = signals.reducedMotion ? 0.08 : Math.max(0, 0.22 * (1 - progress));
      ctx.strokeStyle = `rgb(${EVENT_COLOR[event.kind]})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2, 80 + progress * 520, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
