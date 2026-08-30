import { describe, expect, it } from 'vitest';
import { CNS_WAVES } from '../data/waves';
import { LEVELS } from '../data/levels';
import { CNS } from '../game/Balance';
import { createInitialState, startGame } from '../game/GameState';
import { CNS_ROUTE_STRUCTURES, buildPaths, cnsRouteAnchor, posAt } from '../lib/path';
import { killEnemy, stepEnemies, stepProjectiles } from './CombatSystem';
import { completeWave, containCnsBreach, spawnEnemy, startWave, stepSpawns } from './WaveSystem';

function fresh() {
  const state = createInitialState('cns', 7);
  startGame(state, false);
  return state;
}

describe('Neuroaxis CNS campaign', () => {
  it('is an immediately available ten-wave expert campaign with precise distinct routes', () => {
    expect(LEVELS.cns).toMatchObject({ difficulty: 'EXPERT', startCurrency: 260 });
    expect(CNS_WAVES).toHaveLength(10);
    expect(CNS_ROUTE_STRUCTURES[0]).toEqual([
      'Spinal microvasculature', 'blood–spinal cord barrier', 'penetrating vessel', 'perivascular space', 'spinal white matter',
    ]);
    expect(CNS_ROUTE_STRUCTURES[1]).toContain('foramen of Monro');
    expect(CNS_ROUTE_STRUCTURES[1]).toContain('median and lateral apertures');
    expect(CNS_ROUTE_STRUCTURES[1]).toContain('spinal subarachnoid space');
    expect(CNS_ROUTE_STRUCTURES[2]).toContain('lumbar cistern');
    expect(new Set(CNS_WAVES.flatMap((wave) => wave.cnsBreaches?.map((breach) => breach.interface) ?? [])))
      .toEqual(new Set(['bbb', 'bloodCsf', 'leptomeningeal']));
  });

  it('uses a cord-only BBB route and distinct left/right spinal descents without changing travel time', () => {
    const [bbb, bloodCsf, leptomeningeal] = buildPaths('cns');
    expect(bbb.length).toBeGreaterThanOrEqual(1406.24 * .95);
    expect(bbb.length).toBeLessThanOrEqual(1406.24 * 1.05);
    expect(bloodCsf.length).toBeGreaterThanOrEqual(1406.83 * .95);
    expect(bloodCsf.length).toBeLessThanOrEqual(1406.83 * 1.05);
    expect(leptomeningeal.length).toBeGreaterThanOrEqual(1600.25 * .95);
    expect(leptomeningeal.length).toBeLessThanOrEqual(1600.25 * 1.05);

    const bbbEnd = posAt(bbb, bbb.length);
    const bloodCsfSpine = posAt(bloodCsf, bloodCsf.length - 300);
    const leptomeningealSpine = posAt(leptomeningeal, leptomeningeal.length - 300);
    expect(bbbEnd.x).toBeGreaterThan(580);
    expect(bbbEnd.x).toBeLessThan(660);
    expect(bbbEnd.y).toBeGreaterThan(720);
    expect(bloodCsfSpine.x).toBeLessThan(600);
    expect(leptomeningealSpine.x).toBeGreaterThan(750);
    expect(leptomeningealSpine.x - bloodCsfSpine.x).toBeGreaterThan(120);
  });

  it('maps stationary CNS objectives to named anatomical anchors', () => {
    const paths = buildPaths('cns');
    expect(cnsRouteAnchor(paths, 'intramedullaryCore')).toMatchObject({ lane: 0, point: { x: 590, y: 350 } });
    expect(cnsRouteAnchor(paths, 'ventricular')).toMatchObject({ lane: 1, point: { x: 260, y: 80 } });
    expect(cnsRouteAnchor(paths, 'basalCisternal')).toMatchObject({ lane: 1, point: { x: 550, y: 160 } });
    expect(cnsRouteAnchor(paths, 'lumbarCistern')).toMatchObject({ lane: 2, point: { x: 690, y: 640 } });
  });

  it('offers one chord-safe tactical containment per wave and applies all effects', () => {
    const state = fresh(); const paths = buildPaths('cns');
    startWave(state);
    stepSpawns(state, 3.1, paths);
    const warning = state.activeCnsBreaches[0];
    expect(warning).toMatchObject({ interface: 'bbb', stage: 'warning', contained: false });
    const beforeAt = state.cnsEventQueue[0].at;
    expect(containCnsBreach(state, warning.id)).toBe(true);
    expect(state.currency).toBe(260 - CNS.containmentCost);
    expect(state.cnsEventQueue[0]).toMatchObject({ at: beforeAt + CNS.containmentDelay, count: 2, contained: true });
    expect(containCnsBreach(state, warning.id)).toBe(false);
    stepSpawns(state, 9, paths);
    expect(state.waveSpawnQueue.some((entry) => entry.behavior === 'contained')).toBe(true);
  });

  it('separates malignant burden from ordinary kills and recovers only for sanctuary destruction or wave clear', () => {
    const state = fresh(); const paths = buildPaths('cns');
    state.meters.cnsBurden = 30;
    spawnEnemy(state, 'standard', 0, paths);
    killEnemy(state, state.enemies[0], 'bcma', 1);
    expect(state.meters.cnsBurden).toBe(30);
    spawnEnemy(state, 'sanctuaryDeposit', 1, paths, 'deposit');
    const deposit = state.enemies.at(-1)!;
    stepEnemies(state, 2, paths);
    expect(state.meters.cnsBurden).toBeCloseTo(30 + CNS.depositBurdenPerSecond * 2);
    killEnemy(state, deposit, 'dual', 1);
    expect(state.meters.cnsBurden).toBeCloseTo(30 + CNS.depositBurdenPerSecond * 2 - CNS.depositKillRecovery);
    startWave(state);
    const beforeClear = state.meters.cnsBurden;
    completeWave(state);
    expect(state.meters.cnsBurden).toBe(Math.max(0, beforeClear - CNS.waveClearRecovery));
  });

  it('shields the core with three named-route deposits, then enters phases two and three', () => {
    const state = fresh(); const paths = buildPaths('cns');
    state.wave = 10; startWave(state);
    spawnEnemy(state, 'parenchymalCore', 0, paths);
    const core = state.enemies.find((enemy) => enemy.type === 'parenchymalCore')!;
    expect({ x: core.x, y: core.y }).toEqual(cnsRouteAnchor(paths, 'intramedullaryCore').point);
    expect(state.enemies.filter((enemy) => enemy.type === 'sanctuaryDeposit').map((enemy) => enemy.sanctuarySite))
      .toEqual(['ventricular', 'basalCisternal', 'lumbarCistern']);
    for (const deposit of state.enemies.filter((enemy) => enemy.type === 'sanctuaryDeposit')) {
      const anchor = cnsRouteAnchor(paths, deposit.sanctuarySite!);
      expect({ x: deposit.x, y: deposit.y }).toEqual(anchor.point);
    }
    state.projectiles.push({ id: 999, x: core.x, y: core.y, targetId: core.id, speed: 1, damage: 100, unit: 'bcma', crsFactor: 1 });
    stepProjectiles(state, .01);
    expect(core.hp).toBe(core.maxHp);
    for (const deposit of state.enemies.filter((enemy) => enemy.type === 'sanctuaryDeposit')) deposit.alive = false;
    stepEnemies(state, .01, paths);
    expect(core.bossPhase).toBe(2);
    expect(state.cnsEventQueue.filter((event) => event.id >= 20000).map((event) => event.interface)).toEqual(['bbb', 'bloodCsf', 'leptomeningeal']);
    core.hp = core.maxHp * .49;
    state.projectiles.push({ id: 1000, x: core.x, y: core.y, targetId: core.id, speed: 1, damage: 1, unit: 'bcma', crsFactor: 1 });
    stepProjectiles(state, .01);
    expect(core.bossPhase).toBe(3);
    expect(core.speed).toBeGreaterThan(core.baseSpeed!);
  });
});
