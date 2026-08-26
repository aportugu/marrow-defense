import { describe, expect, it } from 'vitest';
import type { Enemy, EnemyTypeId, GameState, Tower, UnitTypeId } from '../game/types';
import { ENEMY } from '../game/Balance';
import { createInitialState, startGame } from '../game/GameState';
import { buildPaths } from '../lib/path';
import { spawnEnemy } from './WaveSystem';
import {
  applyBuffs,
  computedTowerStats,
  crsFactorOf,
  damageOf,
  intervalOf,
  killEnemy,
  nearestTargets,
  rangeOf,
  stepEnemies,
  stepProjectiles,
  stepTowers,
} from './CombatSystem';

function tower(type: UnitTypeId, x = 100, y = 100, tier: 0 | 1 | 2 = 0): Tower {
  return {
    id: 1,
    type,
    x,
    y,
    tier,
    cd: 0,
    targetId: null,
    strength: 1,
    wavesSurvived: 0,
    buffPower: 0,
  };
}

function enemy(type: EnemyTypeId, x: number, y: number, id = 1, lane = 0): Enemy {
  const d = ENEMY[type];
  return { id, type, lane, x, y, pathPos: 0, speed: d.speed, reward: d.reward, hp: d.hp, maxHp: d.hp, alive: true };
}

function fresh(): GameState {
  const s = createInitialState('marrow', 1);
  startGame(s);
  return s;
}

describe('combat math', () => {
  it('rangeOf: base range and dual +30 range upgrade', () => {
    expect(rangeOf(tower('bcma'))).toBe(130);
    expect(rangeOf(tower('dual', 0, 0, 1))).toBe(142);
    expect(rangeOf(tower('memory'))).toBe(120);
  });

  it('damageOf: base, upgrade multipliers, fitness and bcma-low scaling', () => {
    const s = fresh();
    expect(damageOf(tower('bcma'), s, enemy('standard', 100, 100))).toBeCloseTo(16);
    expect(damageOf(tower('bcma', 0, 0, 2), s, enemy('standard', 100, 100))).toBeCloseTo(16);
    expect(damageOf(tower('dual', 0, 0, 1), s, enemy('standard', 100, 100))).toBeCloseTo(13 * 1.15);
    expect(damageOf(tower('memory', 0, 0, 1), s, enemy('standard', 100, 100))).toBeCloseTo(4);
    expect(damageOf(tower('dual', 0, 0, 1), s, enemy('bcmaLow', 100, 100))).toBeCloseTo(13 * 1.15);
    expect(damageOf(tower('bcma'), s, enemy('bcmaLow', 100, 100))).toBeCloseTo(16 * 0.5);
  });

  it('intervalOf: speed upgrades, buffs and dexa slow', () => {
    const s = fresh();
    expect(intervalOf(tower('bcma'), s)).toBeCloseTo(0.8);
    expect(intervalOf(tower('bcma', 0, 0, 1), s)).toBeCloseTo(0.8 / 1.6);
    expect(intervalOf(tower('memory', 0, 0, 1), s)).toBeCloseTo(1.2 * 0.8);
    const buffed = tower('bcma');
    buffed.buffPower = 0.3;
    expect(intervalOf(buffed, s)).toBeCloseTo(0.8 * 0.85);
    s.dexaUntil = s.stats.time + 10;
    expect(intervalOf(tower('bcma'), s)).toBeCloseTo(0.8 / 0.75);
  });

  it('crsFactorOf: base and durable tier reduction', () => {
    expect(crsFactorOf(tower('bcma'))).toBe(1);
    expect(crsFactorOf(tower('bcma', 0, 0, 2))).toBe(0.6);
    expect(crsFactorOf(tower('memory'))).toBe(0.2);
  });

  it('nearestTargets filters by range and sorts by distance', () => {
    const s = fresh();
    s.enemies = [
      enemy('standard', 100, 0, 1),
      enemy('standard', 50, 0, 2),
      enemy('standard', 200, 0, 3),
    ];
    const t = tower('bcma', 0, 0);
    const targets = nearestTargets(t, s.enemies, 2);
    expect(targets.map((e) => e.id)).toEqual([2, 1]);
  });

  it('applyBuffs marks towers inside a memory cell radius', () => {
    const s = fresh();
    s.towers = [tower('memory', 100, 100), tower('bcma', 170, 100), tower('dual', 400, 400)];
    applyBuffs(s);
    expect(s.towers[1].buffPower).toBeGreaterThan(0);
    expect(s.towers[2].buffPower).toBe(0);
  });

  it('killEnemy grants reward, counts kills and adds CRS and neurotoxicity', () => {
    const s = fresh();
    const e = enemy('standard', 100, 100);
    const c0 = s.currency;
    killEnemy(s, e, 'bcma', 1);
    expect(e.alive).toBe(false);
    expect(e.hp).toBe(0);
    expect(s.stats.kills).toBe(1);
    expect(s.currency).toBeCloseTo(c0 + ENEMY.standard.reward);
    expect(s.meters.crs).toBeCloseTo(ENEMY.standard.crsOnKill);
    expect(s.meters.neuro).toBeCloseTo(ENEMY.standard.neuroOnKill);
  });

  it('Dexamethasone suppresses newly generated CRS', () => {
    const s = fresh();
    s.crsSuppressedUntil = 8;
    killEnemy(s, enemy('standard', 100, 100), 'bcma', 1);
    expect(s.meters.crs).toBeCloseTo(ENEMY.standard.crsOnKill * 0.35);
  });

  it('computed stats include upgrades, resistance, and support', () => {
    const s = fresh();
    const t = tower('bcma', 0, 0, 1);
    t.buffPower = 0.2;
    const stats = computedTowerStats(t, s);
    expect(stats.attacksPerSecond).toBeGreaterThan(2);
    expect(stats.standardDamage).toBeGreaterThan(stats.bcmaLowDamage);
  });
});

describe('combat simulation', () => {
  it('a tower kills a stationary enemy with projectiles', () => {
    const s = fresh();
    s.towers = [tower('bcma', 100, 100)];
    s.enemies = [enemy('standard', 140, 100)];
    for (let i = 0; i < 600 && s.enemies.some((e) => e.alive); i++) {
      stepTowers(s, 0.05);
      stepProjectiles(s, 0.05);
    }
    expect(s.enemies[0].alive).toBe(false);
    expect(s.stats.kills).toBe(1);
  });

  it('emits distinct resistant-hit, dual-engagement, and toxicity feedback', () => {
    const resistant = fresh();
    resistant.enemies = [enemy('bcmaLow', 100, 100)];
    resistant.projectiles = [{ id: 2, x: 100, y: 100, targetId: 1, speed: 480, damage: 1, unit: 'bcma', crsFactor: 1 }];
    stepProjectiles(resistant, 0.01);
    expect(resistant.particles.some((p) => p.effect === 'resist')).toBe(true);

    const dual = fresh();
    dual.enemies = [enemy('bcmaLow', 100, 100)];
    dual.projectiles = [{ id: 2, x: 100, y: 100, targetId: 1, speed: 480, damage: 999, unit: 'dual', crsFactor: 0.7 }];
    stepProjectiles(dual, 0.01);
    expect(dual.particles.some((p) => p.effect === 'dual')).toBe(true);
    expect(dual.particles.filter((p) => p.effect === 'cytokine').length).toBeGreaterThan(0);
    expect(dual.particles.some((p) => p.effect === 'neuro')).toBe(true);
  });

  it('enemies that reach the end leak and hit the meters', () => {
    const s = fresh();
    const path = buildPaths('marrow')[0];
    const e = enemy('standard', 0, 0);
    e.pathPos = path.length;
    s.enemies = [e];
    const leaked = stepEnemies(s, 0.5, [path]);
    expect(leaked).toBe(1);
    expect(e.alive).toBe(false);
    expect(s.stats.escapes).toBe(1);
    expect(s.hematotoxicityLoad).toBeCloseTo(ENEMY.standard.escapeHematotoxicity);
    expect(s.meters.hematotoxicity).toBe(0);
    expect(s.meters.burden).toBeCloseTo(ENEMY.standard.escapeBurden);
    expect(s.meters.fitness).toBe(100);
  });

  it('splits a mitotic cluster once while conserving remaining HP and reward', () => {
    const s = createInitialState('liver', 2);
    startGame(s);
    const parent = enemy('proliferative', 100, 100);
    parent.behavior = 'mitotic';
    s.enemies = [parent];
    s.projectiles = [{ id: 9, x: 100, y: 100, targetId: parent.id, speed: 480, damage: 12, unit: 'bcma', crsFactor: 1 }];
    stepProjectiles(s, .01);
    const daughters = s.enemies.filter((candidate) => candidate.alive);
    expect(parent.alive).toBe(false);
    expect(daughters).toHaveLength(2);
    expect(daughters.reduce((total, daughter) => total + daughter.hp, 0)).toBeCloseTo(10);
    expect(daughters.reduce((total, daughter) => total + daughter.reward, 0)).toBeCloseTo(parent.reward);
    expect(daughters.every((daughter) => daughter.behavior == null && daughter.splitDone)).toBe(true);
    expect(s.hepaticCue?.kind).toBe('division');
  });

  it('anchors one obstruction and produces exactly three escorts', () => {
    const s = createInitialState('liver', 3);
    startGame(s);
    const liverPaths = buildPaths('liver');
    const obstruction = enemy('highBurden', 0, 0, 1, 2);
    obstruction.behavior = 'obstruction';
    obstruction.pathPos = liverPaths[2].length * .63;
    s.enemies = [obstruction];
    stepEnemies(s, 3.2, liverPaths);
    expect(obstruction.escortsSpawned).toBe(3);
    stepEnemies(s, 3.2, liverPaths);
    expect(s.enemies.filter((candidate) => candidate !== obstruction)).toHaveLength(3);
  });

  it('protects the boss with escorts and advances through both HP phases', () => {
    const s = createInitialState('liver', 4);
    startGame(s);
    spawnEnemy(s, 'hepaticCore', 2, buildPaths('liver'));
    const boss = s.enemies.find((candidate) => candidate.type === 'hepaticCore')!;
    s.projectiles = [{ id: 20, x: boss.x, y: boss.y, targetId: boss.id, speed: 480, damage: 100, unit: 'bcma', crsFactor: 1 }];
    stepProjectiles(s, .01);
    expect(boss.hp).toBe(1150);
    for (const escort of s.enemies.filter((candidate) => candidate.behavior === 'bossEscort')) escort.alive = false;
    s.projectiles = [{ id: 21, x: boss.x, y: boss.y, targetId: boss.id, speed: 480, damage: 400, unit: 'bcma', crsFactor: 1 }];
    stepProjectiles(s, .01);
    expect(boss.bossPhase).toBe(2);
    expect(s.hepaticEventQueue).toHaveLength(2);
    s.projectiles = [{ id: 22, x: boss.x, y: boss.y, targetId: boss.id, speed: 480, damage: 400, unit: 'bcma', crsFactor: 1 }];
    stepProjectiles(s, .01);
    expect(boss.bossPhase).toBe(3);
    expect(boss.speed).toBeCloseTo(9);
  });
});
