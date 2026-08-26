// Canvas renderer. Reads GameState + a small view struct; draws the marrow,
// path, units, enemies, projectiles, particles, the placement ghost and the
// pulsing CRS heat overlay. The menu phase shows a kinetic attract background.
import type { EnemyBehavior, GameState, Tower, Vec, UnitTypeId } from './types';
import { CANVAS_W, CANVAS_H } from './types';
import { ENEMY, UNIT, METER } from './Balance';
import { rangeOf } from '../systems/CombatSystem';
import { canPlaceAt, posAt, type PathDef } from '../lib/path';
import { LEVELS } from '../data/levels';
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
  paths: PathDef[];
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

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawPath(ctx: CanvasRenderingContext2D, path: PathDef, time: number, color: string): void {
  const pts = path.points;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = withAlpha(color, 0.3);
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  // flowing dashed centre line — the stream keeps moving even in the menu
  ctx.strokeStyle = withAlpha(color, 0.35);
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

function drawHepaticEventLayer(ctx: CanvasRenderingContext2D, s: GameState, paths: PathDef[], time: number, reduced: boolean): void {
  const event = s.activeHepaticEvent;
  if (!event) return;
  const path = paths[event.lane % paths.length];
  const color = LEVELS.liver.lanes[event.lane].color;
  const pulse = reduced ? .7 : .58 + Math.sin(time * (event.stage === 'impact' ? 14 : 7)) * .3;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = event.stage === 'impact' ? '#f0abfc' : color;
  ctx.shadowBlur = event.stage === 'impact' ? 34 : 22;
  ctx.strokeStyle = withAlpha(event.stage === 'impact' ? '#e879f9' : color, .35 + pulse * .25);
  ctx.lineWidth = event.stage === 'impact' ? 60 : 54;
  ctx.beginPath();
  ctx.moveTo(path.points[0].x, path.points[0].y);
  for (const point of path.points) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  const entry = posAt(path, Math.min(55, path.length));
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = .35 - i * .08;
    ctx.strokeStyle = '#f5d0fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(entry.x, entry.y, 22 + i * 13 + pulse * 7, 0, Math.PI * 2);
    ctx.stroke();
  }
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
  behavior: EnemyBehavior | undefined,
  bossPhase: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  if (behavior === 'mitotic') {
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 2;
    ctx.globalAlpha = .55;
    ctx.beginPath();
    ctx.ellipse(-size * .35, 0, size * .75, size * .95, -.22, 0, Math.PI * 2);
    ctx.ellipse(size * .35, 0, size * .75, size * .95, .22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (behavior === 'obstruction') {
    ctx.strokeStyle = '#bef264';
    ctx.lineWidth = 2;
    ctx.globalAlpha = .4;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + time * .3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * size * .5, Math.sin(a) * size * .5);
      ctx.quadraticCurveTo(Math.cos(a + .4) * size, Math.sin(a + .4) * size, Math.cos(a) * size * 1.55, Math.sin(a) * size * 1.55);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (behavior === 'surge') {
    const wake = ctx.createLinearGradient(-size * 2.4, 0, size, 0);
    wake.addColorStop(0, 'rgba(34,211,238,0)');
    wake.addColorStop(1, 'rgba(232,121,249,.58)');
    ctx.globalAlpha = .72;
    ctx.fillStyle = wake;
    ctx.beginPath();
    ctx.ellipse(-size * 1.1, 0, size * 1.8, size * .42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (behavior === 'bossEscort') {
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    ctx.globalAlpha = .72;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Every enemy reads as a plasma-cell cluster. Eccentric nuclei and a pale
  // perinuclear hof distinguish the cells from CAR-T units at gameplay size.
  const cluster = type === 'standard'
    ? { count: 3, cell: size * .66, spread: size * .58, alpha: .96 }
    : type === 'proliferative'
      ? { count: 6, cell: size * .47, spread: size * .7, alpha: .98 }
      : type === 'bcmaLow'
        ? { count: 4, cell: size * .55, spread: size * .68, alpha: .68 }
        : type === 'highBurden'
          ? { count: 8, cell: size * .43, spread: size * .72, alpha: .96 }
          : { count: 13, cell: size * .31, spread: size * .77, alpha: .98 };
  const ring = type === 'bcmaLow' ? '#94a3b8' : type === 'hepaticCore' ? '#f5d0fe' : color;
  const receptors = receptorCountForEnemy(type);
  ctx.globalAlpha = cluster.alpha;
  for (let i = 0; i < cluster.count; i++) {
    const a = i * 2.399963;
    const radial = i === 0 ? 0 : cluster.spread * (.42 + (i % 4) * .17);
    const cx = Math.cos(a) * radial;
    const cy = Math.sin(a) * radial * .78;
    const r = cluster.cell * (1 - (i % 3) * .06);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = i % 3 === 0 ? color : type === 'bcmaLow' ? '#a8a8c9' : '#d946ef';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ring;
    ctx.lineWidth = type === 'hepaticCore' ? 1.6 : 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(253,230,255,.48)';
    ctx.beginPath();
    ctx.arc(-r * .18, r * .08, r * .36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(54,12,67,.88)';
    ctx.beginPath();
    ctx.arc(r * .25, -r * .12, r * .42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ring;
    ctx.globalAlpha *= type === 'bcmaLow' ? .38 : .8;
    for (let j = 0; j < receptors; j++) {
      const receptorAngle = (Math.PI * 2 * j) / receptors;
      ctx.beginPath();
      ctx.arc(Math.cos(receptorAngle) * r, Math.sin(receptorAngle) * r, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (type === 'hepaticCore') {
    ctx.strokeStyle = '#f0abfc';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, size + 6, 0, Math.PI * 2);
    ctx.stroke();
    if (bossPhase >= 2) {
      ctx.strokeStyle = bossPhase === 3 ? '#ffffff' : '#67e8f9';
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      for (let i = 0; i < (bossPhase === 3 ? 7 : 4); i++) {
        const a = i * Math.PI * 2 / (bossPhase === 3 ? 7 : 4) + time * .15;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * size * .2, Math.sin(a) * size * .2);
        ctx.lineTo(Math.cos(a + .15) * size * .9, Math.sin(a + .15) * size * .9);
        ctx.stroke();
      }
    }
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

function drawHepaticLabels(ctx: CanvasRenderingContext2D, paths: PathDef[]): void {
  ctx.save();
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const labels = ['PORTAL VEIN', 'HEPATIC ARTERY', 'BILIARY BRANCH'];
  const colors = ['#9bd7ee', '#fca5a5', '#bef264'];
  for (let i = 0; i < Math.min(3, paths.length); i++) {
    const p = posAt(paths[i], 92);
    const label = labels[i];
    const w = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(9,9,17,.72)';
    ctx.fillRect(22, p.y - 12, w + 18, 24);
    ctx.fillStyle = colors[i];
    ctx.fillText(label, 31, p.y);
  }
  ctx.globalAlpha = .22;
  ctx.fillStyle = '#fecdd3';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.fillText('L I V E R   P A R E N C H Y M A  ·  D I F F U S E   P L A S M A C Y T O M A', 74, 680);
  ctx.restore();
}

function drawBossHud(ctx: CanvasRenderingContext2D, s: GameState): void {
  const boss = s.enemies.find((enemy) => enemy.alive && enemy.type === 'hepaticCore');
  if (!boss) return;
  const x = 430;
  const y = 22;
  const w = 420;
  const frac = Math.max(0, boss.hp / boss.maxHp);
  ctx.save();
  ctx.fillStyle = 'rgba(12,4,16,.9)';
  ctx.strokeStyle = 'rgba(240,171,252,.7)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - 12, y - 13, w + 24, 47);
  ctx.strokeRect(x - 12, y - 13, w + 24, 47);
  ctx.fillStyle = '#f5d0fe';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const shielded = s.enemies.some((enemy) => enemy.alive && enemy.behavior === 'bossEscort' && enemy.parentBossId === boss.id);
  ctx.fillText(`HEPATIC PLASMACYTOMA CORE · PHASE ${boss.bossPhase ?? 1}${shielded ? ' · SHIELDED' : ''}`, x + w / 2, y);
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  ctx.fillRect(x, y + 10, w, 9);
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#a21caf');
  grad.addColorStop(1, '#f0abfc');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y + 10, w * frac, 9);
  ctx.restore();
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
  const ok = canPlaceAt(v.paths, s.towers, v.cursor.x, v.cursor.y);
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
      Math.sin(v.time * 91.7) * v.shake * .5,
      Math.cos(v.time * 73.1) * v.shake * .5,
    );
  }
  if (shouldRenderIntro(s.phase)) {
    v.intro.render(ctx, v.introTime, v.kineticSignals.reducedMotion);
  } else {
    v.kinetic.render(ctx, v.time, v.paths, v.kineticSignals);
    const laneColors = LEVELS[s.level].lanes.map((lane) => lane.color);
    if (s.level === 'liver') drawHepaticEventLayer(ctx, s, v.paths, time, v.kineticSignals.reducedMotion);
    for (let i = 0; i < v.paths.length; i++) {
      drawPath(ctx, v.paths[i], time, laneColors[i % laneColors.length]);
    }
    if (s.level === 'liver') drawHepaticLabels(ctx, v.paths);
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
      if (!e.alive || e.behavior !== 'bossEscort' || e.parentBossId == null) continue;
      const boss = s.enemies.find((candidate) => candidate.id === e.parentBossId && candidate.alive);
      if (!boss) continue;
      ctx.globalAlpha = .48;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boss.x, boss.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const def = ENEMY[e.type];
      drawEnemy(ctx, e.x, e.y, def.icon, def.color, def.size, e.hp / e.maxHp, e.type, e.behavior, e.bossPhase ?? 0, time);
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
        } else if (pt.effect === 'division') {
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pt.x - pt.vx * .035, pt.y - pt.vy * .035);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
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
    drawBossHud(ctx, s);
  }
  ctx.restore();
  drawCrsHeat(ctx, s.meters.crs, time, v.kineticSignals.reducedMotion);
  drawNeuroHeat(ctx, s.meters.neuro, time, v.kineticSignals.reducedMotion);
}
