// Pure combat math: targeting, damage, cooldowns, enemy movement, projectiles,
// and kill effects. Operates on GameState only (no DOM/canvas), so it is
// deterministically testable.
import type { ComputedTowerStats, GameState, Tower, Enemy, UnitTypeId } from '../game/types';
import { UNIT, ENEMY, METER, DEXA, ECONOMY, IEC_HS } from '../game/Balance';
import { clamp, dist2 } from '../lib/math';
import { posAt, type PathDef } from '../lib/path';

export function rangeOf(t: Tower): number {
  let r = UNIT[t.type].range;
  if (t.type === 'dual' && t.tier >= 1) r += 30;
  return r;
}

export function damageOf(t: Tower, s: GameState, target: Enemy): number {
  let dmg = UNIT[t.type].damage;
  if (t.type === 'dual' && t.tier >= 1) dmg *= 1.15;
  dmg *= 1 + t.buffPower;
  const fit = s.meters.fitness / 100;
  dmg *= 0.55 + 0.45 * fit;
  if (t.type === 'bcma' && target.type === 'bcmaLow') dmg *= 0.5;
  return dmg;
}

export function intervalOf(t: Tower, s: GameState): number {
  let iv = UNIT[t.type].interval;
  if (t.type === 'bcma' && t.tier >= 1) iv /= 1.6;
  if (t.type === 'memory' && t.tier >= 1) iv *= 0.8;
  iv *= 1 - t.buffPower * 0.5;
  const fit = s.meters.fitness / 100;
  iv /= 0.7 + 0.3 * fit;
  if (s.stats.time < s.dexaUntil) iv /= 1 - DEXA.slowAtk;
  return iv;
}

export function crsFactorOf(t: Tower): number {
  let cf = UNIT[t.type].crsFactor;
  if (t.type === 'bcma' && t.tier >= 2) cf *= 0.6;
  return cf;
}

export function supportPowerOf(t: Tower): number {
  if (t.type !== 'memory') return 0;
  return Math.min(0.35, 0.15 + t.tier * 0.05 + Math.max(0, t.strength - 1) * 0.025);
}

export function supportRadiusOf(t: Tower): number {
  if (t.type !== 'memory') return 0;
  return (UNIT.memory.buff?.radius ?? 120) + ECONOMY.buffRadiusGrowth * t.strength + (t.tier >= 2 ? 16 : 0);
}

export function computedTowerStats(t: Tower, s: GameState): ComputedTowerStats {
  const target = (type: Enemy['type']): Enemy => ({
    id: -1, type, x: t.x, y: t.y, pathPos: 0, hp: 1, maxHp: 1, alive: true,
  });
  return {
    range: rangeOf(t),
    attacksPerSecond: 1 / intervalOf(t, s),
    standardDamage: damageOf(t, s, target('standard')),
    bcmaLowDamage: damageOf(t, s, target('bcmaLow')),
    crsFactor: crsFactorOf(t),
    supportPower: supportPowerOf(t),
    supportRadius: supportRadiusOf(t),
  };
}

export function nearestTargets(t: Tower, enemies: Enemy[], n: number): Enemy[] {
  const r = rangeOf(t);
  return enemies
    .filter((e) => e.alive && dist2(t, e) <= r * r)
    .sort((a, b) => dist2(t, a) - dist2(t, b))
    .slice(0, n);
}

export function applyBuffs(s: GameState): void {
  for (const t of s.towers) t.buffPower = 0;
  for (const m of s.towers) {
    if (m.type !== 'memory') continue;
    const r = supportRadiusOf(m);
    const power = supportPowerOf(m);
    for (const t of s.towers) {
      if (t === m || t.type === 'memory') continue;
      if (dist2(m, t) <= r * r) t.buffPower = Math.max(t.buffPower, power);
    }
  }
}

export function stepEnemies(s: GameState, dt: number, path: PathDef): number {
  let escapes = 0;
  for (const e of s.enemies) {
    if (!e.alive) continue;
    const en = ENEMY[e.type];
    e.pathPos += en.speed * dt;
    const p = posAt(path, e.pathPos);
    e.x = p.x;
    e.y = p.y;
    if (e.pathPos >= path.length) {
      e.alive = false;
      escapes++;
      s.stats.escapes++;
      s.stats.escapesByType[e.type]++;
      s.meters.burden = clamp(s.meters.burden + en.escapeBurden, 0, 100);
      s.hematotoxicityLoad += en.escapeHematotoxicity;
      s.particles.push({
        x: e.x, y: e.y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4,
        color: '#ff5b5b', size: 7,
      });
    }
  }
  return escapes;
}

function fire(t: Tower, s: GameState): void {
  const dualTier2 = t.type === 'dual' && t.tier >= 2;
  const targets = nearestTargets(t, s.enemies, dualTier2 ? 2 : 1);
  for (const target of targets) {
  const mult = dualTier2 ? 0.75 : 1;
    s.projectiles.push({
      id: s.nextId++,
      x: t.x,
      y: t.y,
      targetId: target.id,
      speed: 480,
      damage: damageOf(t, s, target) * mult,
      unit: t.type,
      crsFactor: crsFactorOf(t),
    });
  }
}

export function stepTowers(s: GameState, dt: number): void {
  applyBuffs(s);
  for (const t of s.towers) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    const targets = nearestTargets(t, s.enemies, 1);
    if (targets.length === 0) {
      t.cd = 0;
      t.targetId = null;
      continue;
    }
    t.targetId = targets[0].id;
    fire(t, s);
    t.cd = intervalOf(t, s);
  }
}

export function killEnemy(
  s: GameState,
  e: Enemy,
  unit: UnitTypeId,
  crsFactor: number,
): void {
  if (!e.alive) return;
  e.alive = false;
  e.hp = 0;
  const en = ENEMY[e.type];
  s.currency += en.reward;
  s.stats.fundingEarned += en.reward;
  s.stats.kills++;
  s.stats.killsByType[e.type]++;
  const prevCrs = s.meters.crs;
  const dexaFactor = s.stats.time < s.crsSuppressedUntil ? DEXA.crsMultiplier : 1;
  s.meters.crs = clamp(s.meters.crs + en.crsOnKill * crsFactor * dexaFactor, 0, 100);
  s.meters.neuro = clamp(s.meters.neuro + en.neuroOnKill, 0, 100);
  if (s.iecHsActive) {
    const anakinraFactor = s.stats.time < s.anakinraUntil ? IEC_HS.anakinraMultiplier : 1;
    const dexaIecFactor = s.stats.time < s.iecHsDexaUntil ? IEC_HS.dexaMultiplier : 1;
    s.meters.hyperinflammation = clamp(
      s.meters.hyperinflammation + en.crsOnKill * crsFactor * IEC_HS.killFactor * anakinraFactor * dexaIecFactor,
      0,
      100,
    );
  }
  if (prevCrs < METER.crsWarn && s.meters.crs >= METER.crsWarn) {
    s.stats.severeCrsEvents++;
  }
  s.meters.fitness = clamp(s.meters.fitness - 0.2, 0, 100);
  const cytokines = Math.min(18, 4 + Math.ceil(en.crsOnKill));
  for (let i = 0; i < cytokines; i++) {
    const a = (Math.PI * 2 * i) / cytokines;
    s.particles.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * (45 + en.crsOnKill * 2), vy: Math.sin(a) * (45 + en.crsOnKill * 2),
      life: 0.65, maxLife: 0.65, color: '#fb923c', size: e.type === 'highBurden' ? 5 : 2.5,
      effect: 'cytokine',
    });
  }
  if (en.neuroOnKill > 0) s.particles.push({
    x: e.x, y: e.y, vx: 8, vy: -16, life: 1.1, maxLife: 1.1,
    color: '#a78bfa', size: 6, effect: 'neuro',
  });
}

export function stepProjectiles(s: GameState, dt: number): void {
  for (const p of s.projectiles) {
    if (p.dead) continue;
    const target = s.enemies.find((e) => e.id === p.targetId && e.alive);
    if (!target) {
      p.dead = true;
      continue;
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    const hit = ENEMY[target.type].size * 0.5;
    if (d <= step + hit) {
      p.dead = true;
      if (p.unit === 'bcma' && target.type === 'bcmaLow') {
        s.particles.push({ x: target.x, y: target.y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, color: '#94a3b8', size: ENEMY[target.type].size + 5, effect: 'resist' });
      } else if (p.unit === 'dual') {
        s.particles.push({ x: target.x, y: target.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color: '#67e8f9', size: ENEMY[target.type].size + 4, effect: 'dual' });
      }
      target.hp -= p.damage;
      if (target.hp <= 0) killEnemy(s, target, p.unit, p.crsFactor);
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }
  s.projectiles = s.projectiles.filter((p) => !p.dead);
}
