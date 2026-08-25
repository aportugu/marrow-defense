// Canvas renderer. Reads GameState + a small view struct; draws the marrow,
// path, units, enemies, projectiles, particles, the placement ghost and the
// pulsing CRS heat overlay. The menu phase shows a kinetic attract background.
import type { GameState, Tower, Vec, UnitTypeId } from './types';
import { CANVAS_W, CANVAS_H } from './types';
import { ENEMY, UNIT, METER } from './Balance';
import { rangeOf } from '../systems/CombatSystem';
import { canPlaceAt, type PathDef } from '../lib/path';
import { KineticBackground, type KineticSignals } from './KineticBackground';
import { IntroCutscene } from './IntroCutscene';

export function receptorCountForEnemy(type: GameState['enemies'][number]['type']): number {
  return type === 'standard' ? 12 : type === 'bcmaLow' ? 3 : 8;
}

export function shouldRenderIntro(phase: GameState['phase']): boolean {
  return phase === 'menu';
}

export interface View {
  cursor: Vec | null;
  selectedTower: number | null;
  buildType: UnitTypeId | null;
  path: PathDef;
  shake: number;
  time: number;
  introTime: number;
  kinetic: KineticBackground;
  intro: IntroCutscene;
  kineticSignals: KineticSignals;
}

function poly(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rot: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (Math.PI * 2 * i) / sides;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function cellBody(
  ctx: CanvasRenderingContext2D,
  r: number,
  color: string,
  ring: string,
  receptors = 8,
  receptorAlpha = 1,
): void {
  // membrane with a soft inner nucleus — reads as a "cell", not a dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,6,16,0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // receptor studs around the membrane
  ctx.fillStyle = ring;
  ctx.globalAlpha *= receptorAlpha;
  for (let i = 0; i < receptors; i++) {
    const a = (Math.PI * 2 * i) / receptors;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha /= receptorAlpha;
}

function drawPath(ctx: CanvasRenderingContext2D, path: PathDef, time: number): void {
  const pts = path.points;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(122,31,92,0.35)';
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  // flowing dashed centre line — the marrow stream keeps moving even in the menu
  ctx.strokeStyle = 'rgba(176,67,214,0.3)';
  ctx.lineWidth = 4;
  ctx.setLineDash([2, 14]);
  ctx.lineDashOffset = -time * 42;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: string,
  color: string,
  size: number,
  hpFrac: number,
  type: GameState['enemies'][number]['type'],
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  if (icon === 'mass') {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (icon === 'burst') {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const r = i % 2 === 0 ? size + 3 : size * 0.55;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'dim') {
    ctx.globalAlpha = 0.72;
    cellBody(ctx, size, color, '#94a3b8', 3, 0.55);
  } else {
    cellBody(ctx, size, color, color, receptorCountForEnemy(type));
  }
  ctx.restore();

  // hp bar
  if (hpFrac < 1) {
    const w = size * 2;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - w / 2, y - size - 9, w, 4);
    ctx.fillStyle =
      hpFrac > 0.5 ? '#39d98a' : hpFrac > 0.25 ? '#f5c518' : '#ff5b5b';
    ctx.fillRect(x - w / 2, y - size - 9, w * Math.max(0, hpFrac), 4);
    ctx.restore();
  }
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  t: Tower,
  selected: boolean,
  time: number,
  dexaActive: boolean,
  planning: boolean,
  reducedMotion: boolean,
): void {
  const { x, y, tier, type, buffPower } = t;
  const def = UNIT[type];
  ctx.save();
  ctx.translate(x, y);
  if (selected) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, 0, rangeOf(t), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, rangeOf(t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (buffPower > 0) {
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 5);
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (type === 'memory') {
    ctx.globalAlpha = 0.18 + tier * 0.05;
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27 + tier * 5, 0, Math.PI * 2);
    ctx.stroke();
    if (planning && tier >= 2) {
      for (let i = 0; i < 4; i++) {
        const travel = reducedMotion ? i / 4 : (time * 0.24 + i / 4) % 1;
        ctx.globalAlpha = 0.45 * (1 - travel);
        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.arc(-travel * 55, -travel * 48, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  if (dexaActive) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#a78bfa';
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  const cadence = dexaActive ? 1.4 : 3;
  const pulse = reducedMotion ? 1 : 1 + Math.sin(time * cadence + x * 0.05) * 0.05;
  const r = 13 * pulse;
  ctx.shadowColor = def.color;
  ctx.shadowBlur = selected ? 18 : 10;
  if (def.icon === 'triangle') {
    poly(ctx, 0, 0, r + 2, 3, -Math.PI / 2);
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.strokeStyle = def.ring;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (def.icon === 'hex') {
    poly(ctx, 0, 0, r + 2, 6, Math.PI / 6);
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.strokeStyle = def.ring;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    cellBody(ctx, r, def.color, def.ring);
  }
  ctx.restore();

  // tier pips
  for (let i = 0; i < tier; i++) {
    ctx.fillStyle = def.ring;
    ctx.beginPath();
    ctx.arc(x - 6 + i * 6, y + 18, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Placement ghost: a translucent unit at the cursor with its range ring,
// tinted green when the spot is legal, red when it is not.
function drawGhost(ctx: CanvasRenderingContext2D, s: GameState, v: View): void {
  if (!v.buildType || !v.cursor) return;
  const def = UNIT[v.buildType];
  const ok = canPlaceAt(v.path, s.towers, v.cursor.x, v.cursor.y);
  const tint = ok ? def.color : '#ff5b5b';
  const ring = ok ? def.ring : '#ff9b9b';
  const { x, y } = v.cursor;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(0, 0, def.range, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = tint;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, def.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.65;
  cellBody(ctx, 13, tint, ring);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = ring;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
    ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrsHeat(ctx: CanvasRenderingContext2D, crs: number, time: number, reduced: boolean): void {
  if (crs <= METER.crsWarn) return;
  const t = Math.min(1, (crs - METER.crsWarn) / (100 - METER.crsWarn));
  const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 4.5);
  const a = 0.12 + t * 0.4 * (0.6 + 0.4 * pulse);
  const g = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.3,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_W * 0.62,
  );
  g.addColorStop(0, 'rgba(255,60,40,0)');
  g.addColorStop(1, `rgba(255,60,40,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawNeuroHeat(ctx: CanvasRenderingContext2D, neuro: number, time: number, reduced: boolean): void {
  if (neuro <= METER.neuroWarn) return;
  const t = Math.min(1, (neuro - METER.neuroWarn) / (100 - METER.neuroWarn));
  const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * 3.3);
  const a = 0.12 + t * 0.4 * (0.6 + 0.4 * pulse);
  const g = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.3,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_W * 0.62,
  );
  g.addColorStop(0, 'rgba(176,107,255,0)');
  g.addColorStop(1, `rgba(176,107,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

export function render(ctx: CanvasRenderingContext2D, s: GameState, v: View): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const time = v.kineticSignals.reducedMotion ? 0 : v.time;
  ctx.save();
  if (v.shake > 0.2 && !v.kineticSignals.reducedMotion) {
    ctx.translate(
      (Math.random() - 0.5) * v.shake,
      (Math.random() - 0.5) * v.shake,
    );
  }
  if (shouldRenderIntro(s.phase)) {
    v.intro.render(ctx, v.introTime, v.kineticSignals.reducedMotion);
  } else {
    v.kinetic.render(ctx, v.time, v.path, v.kineticSignals);
    drawPath(ctx, v.path, time);
    if (s.onboarding.active && s.onboarding.hint === 'placeUnit') {
      ctx.fillStyle = 'rgba(57,217,138,0.045)';
      ctx.fillRect(18, 18, CANVAS_W - 36, CANVAS_H - 36);
      ctx.strokeStyle = 'rgba(134,239,172,0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);
      ctx.setLineDash([]);
    }
    for (const t of s.towers) drawTower(ctx, t, v.selectedTower === t.id, time, s.stats.time < s.dexaUntil, s.subPhase === 'planning', v.kineticSignals.reducedMotion);
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const def = ENEMY[e.type];
      drawEnemy(ctx, e.x, e.y, def.icon, def.color, def.size, e.hp / e.maxHp, e.type);
    }
    for (const p of s.projectiles) {
      const def = UNIT[p.unit];
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const pt of s.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        if (pt.effect === 'resist' || pt.effect === 'dual') {
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = pt.effect === 'dual' ? 3 : 2;
          ctx.setLineDash(pt.effect === 'resist' ? [3, 4] : []);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size + (1 - pt.life / pt.maxLife) * 12, 0, Math.PI * 2);
          ctx.stroke();
          if (pt.effect === 'dual') {
            ctx.strokeStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * 0.65, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        } else if (pt.effect === 'neuro') {
          ctx.fillRect(pt.x - pt.size, pt.y - 1, pt.size * 2, 2);
          ctx.fillRect(pt.x - 1, pt.y - pt.size, 2, pt.size * 2);
        } else {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
    drawGhost(ctx, s, v);
  }
  ctx.restore();
  drawCrsHeat(ctx, s.meters.crs, time, v.kineticSignals.reducedMotion);
  drawNeuroHeat(ctx, s.meters.neuro, time, v.kineticSignals.reducedMotion);
}
