import { CANVAS_H, CANVAS_W } from './types';
import type { ActiveHepaticEvent, GamePhase, SubPhase, LevelId } from './types';
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
  | 'gcsf'
  | 'flareWarn'
  | 'flareImpact'
  | 'division'
  | 'obstruction'
  | 'shieldBreak'
  | 'bossPhase2'
  | 'bossPhase3';

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
  level: LevelId;
  bossActive: boolean;
  bossDefeated: boolean;
  activeHepaticEvent: ActiveHepaticEvent | null;
  bossPhase: number;
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

export function hepaticTumorIntensity(
  waveProgress: number,
  burden: number,
  leakHeat: number,
  bossDefeated = false,
): number {
  if (bossDefeated) return 0.3;
  return Math.min(1, 0.5 + waveProgress * 0.25 + burden / 300 + leakHeat * 0.12);
}

function drawHepaticAnatomy(
  ctx: CanvasRenderingContext2D,
  t: number,
  signals: KineticSignals,
): void {
  ctx.save();
  const liver = ctx.createLinearGradient(120, 80, 1160, 620);
  liver.addColorStop(0, 'rgba(92,26,86,.88)');
  liver.addColorStop(.52, 'rgba(63,18,69,.92)');
  liver.addColorStop(1, 'rgba(23,9,39,.96)');
  ctx.beginPath();
  ctx.moveTo(118, 164);
  ctx.bezierCurveTo(310, 62, 790, 70, 1118, 174);
  ctx.bezierCurveTo(1205, 215, 1180, 366, 1112, 510);
  ctx.bezierCurveTo(1010, 646, 768, 644, 585, 603);
  ctx.bezierCurveTo(430, 568, 318, 621, 181, 533);
  ctx.bezierCurveTo(82, 446, 65, 256, 118, 164);
  ctx.closePath();
  ctx.fillStyle = liver;
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,113,133,.24)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.clip();

  // Slow parallax light sheets make the malignant field feel deep rather than flat.
  for (let layer = 0; layer < 3; layer++) {
    const drift = signals.reducedMotion ? 0 : Math.sin(t * (.18 + layer * .07) + layer) * 42;
    const glow = ctx.createRadialGradient(320 + layer * 310 + drift, 260 + layer * 75, 20, 320 + layer * 310 + drift, 260 + layer * 75, 270);
    glow.addColorStop(0, `rgba(${layer === 1 ? '34,211,238' : '217,70,239'},${.1 + signals.waveProgress * .06})`);
    glow.addColorStop(1, 'rgba(15,5,30,0)');
    ctx.globalAlpha = .8;
    ctx.fillStyle = glow;
    ctx.fillRect(70, 70, 1140, 580);
  }

  // Lobular parenchyma: deterministic hexagonal plates with central veins.
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 14; col++) {
      const x = 105 + col * 84 + (row % 2) * 42;
      const y = 135 + row * 72;
      const r = 27 + ((row * 7 + col * 3) % 6);
      ctx.globalAlpha = 0.12 + signals.waveProgress * .05;
      ctx.strokeStyle = col % 3 === 0 ? '#e879f9' : '#67e8f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Fine sinusoidal channels drift through the hepatic cords.
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    const y = 150 + i * 46;
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = i % 2 ? '#67e8f9' : '#fecdd3';
    ctx.beginPath();
    ctx.moveTo(100, y);
    ctx.bezierCurveTo(370, y - 34, 720, y + 36, 1160, y - 8);
    ctx.stroke();
  }

  // The entire hepatic field is the plasmacytoma: sheets and clusters of
  // eccentric-nucleated plasma cells replace a detached tumor icon.
  const infiltration = hepaticTumorIntensity(
    signals.waveProgress,
    signals.burden,
    signals.leakHeat,
    signals.bossDefeated,
  );
  const cellCount = Math.round(34 + infiltration * 34);
  const tissuePulse = signals.reducedMotion || signals.bossDefeated
    ? 0
    : Math.sin(t * (signals.bossActive ? 2.7 : 1.1)) * 2.5;
  for (let i = 0; i < cellCount; i++) {
    const d = (i * 47) % 113;
    const cx = 150 + ((i * 167) % 970) + Math.sin(i * 1.7) * 18;
    const cy = 145 + ((i * 83) % 410) + Math.cos(i * 2.2) * 13;
    const cellR = 7 + d % 5 + tissuePulse * .15;
    ctx.globalAlpha = signals.bossDefeated ? .07 : .12 + infiltration * .16;
    ctx.fillStyle = i % 3 ? '#e9d5ff' : '#f0abfc';
    ctx.beginPath();
    ctx.arc(cx, cy, cellR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = signals.bossDefeated ? .06 : .2 + infiltration * .2;
    ctx.fillStyle = '#6b21a8';
    ctx.beginPath();
    ctx.arc(cx + cellR * .3, cy - cellR * .12, cellR * .43, 0, Math.PI * 2);
    ctx.fill();
  }
  const event = signals.activeHepaticEvent;
  if (event) {
    const impact = event.stage === 'impact';
    const pulse = signals.reducedMotion ? .65 : .55 + Math.sin(t * (impact ? 12 : 6)) * .25;
    const bloom = ctx.createRadialGradient(640, 360, 80, 640, 360, 610);
    bloom.addColorStop(0, `rgba(217,70,239,${impact ? .22 : .1})`);
    bloom.addColorStop(.7, `rgba(34,211,238,${pulse * .08})`);
    bloom.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = bloom;
    ctx.fillRect(60, 60, 1160, 600);
  }
  if (signals.bossPhase >= 2 && !signals.bossDefeated) {
    ctx.globalAlpha = signals.bossPhase === 3 ? .22 : .13;
    ctx.strokeStyle = signals.bossPhase === 3 ? '#f0abfc' : '#a5f3fc';
    ctx.lineWidth = signals.bossPhase === 3 ? 4 : 2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(640, 360);
      ctx.lineTo(210 + ((i * 173) % 880), 130 + ((i * 97) % 440));
      ctx.stroke();
    }
  }
  ctx.restore();
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
  flareWarn: '217,70,239',
  flareImpact: '34,211,238',
  division: '240,171,252',
  obstruction: '190,242,100',
  shieldBreak: '103,232,249',
  bossPhase2: '217,70,239',
  bossPhase3: '255,255,255',
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
  private baseGradients = new Map<LevelId, CanvasGradient>();

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
    paths: PathDef[],
    signals: KineticSignals,
  ): void {
    const level = signals.level;
    let base = this.baseGradients.get(level);
    if (!base) {
      base = ctx.createRadialGradient(
        CANVAS_W * 0.5, CANVAS_H * 0.5, 70,
        CANVAS_W * 0.5, CANVAS_H * 0.5, CANVAS_W * 0.72,
      );
      if (level === 'liver') {
        base.addColorStop(0, '#0e2430');
        base.addColorStop(1, '#07141b');
      } else {
        base.addColorStop(0, '#2a0f1c');
        base.addColorStop(1, '#160610');
      }
      this.baseGradients.set(level, base);
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (level === 'liver') drawHepaticAnatomy(ctx, signals.reducedMotion ? 0 : time, signals);
    const lanePath = (i: number): PathDef =>
      paths[((i % paths.length) + paths.length) % paths.length];

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
    const glowRgb = level === 'liver' ? '90,167,201' : '176,67,214';
    glow.addColorStop(0, `rgba(${glowRgb},${0.07 + breath * (menu ? 0.08 : 0.035)})`);
    glow.addColorStop(1, `rgba(${glowRgb},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Deep stromal silhouettes.
    for (let i = 0; i < Math.min(count, 28); i++) {
      const d = this.descriptors[i];
      const x = (d.x + t * d.speed * 0.12 * d.depth) % CANVAS_W;
      const y = d.y + Math.sin(t * 0.16 + d.phase) * 12;
      ctx.globalAlpha = menu ? 0.07 : 0.035;
      ctx.fillStyle = level === 'liver'
        ? (i % 2 ? '#7f1d35' : '#4c1726')
        : (i % 2 ? '#7a1f5c' : '#4b1837');
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
      const lane = lanePath(i);
      const distance = ((d.x / CANVAS_W) * lane.length + t * d.speed * 1.8 * flowScale) % lane.length;
      const p = posAt(lane, distance);
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
        const lane = lanePath(66 + i);
        const p = posAt(lane, progress * lane.length);
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
        const lane = lanePath(82 + i);
        const p = posAt(lane, progress * lane.length);
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
