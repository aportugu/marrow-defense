import { describe, expect, it } from 'vitest';
import type { GameState, Tower, UnitTypeId } from '../game/types';
import { UNIT } from '../game/Balance';
import { createInitialState, startGame } from '../game/GameState';
import { buildPaths, distToLanePaths, distToPath, placementFailure } from '../lib/path';
import { activate, canActivate, stepAbilities } from './AbilitySystem';
import { stepEnemies, stepProjectiles, stepTowers } from './CombatSystem';
import { checkEnd, stepMeters } from './MeterSystem';
import { containCnsBreach, stepWave } from './WaveSystem';

const paths = buildPaths('marrow');
const liverPaths = buildPaths('liver');
const cnsPaths = buildPaths('cns');
const spots = [
  [120, 495], [260, 613], [400, 349], [540, 313], [680, 218],
  [820, 365], [960, 573], [1100, 387],
  [120, 605], [400, 459], [680, 328], [960, 463],
] as const;

const liverSpots = [
  [140, 190], [140, 360], [140, 510],
  [455, 220], [455, 415], [455, 485],
  [760, 180], [760, 420], [760, 550],
  [1050, 230], [1050, 350], [1050, 575],
] as const;

const cnsSpots = [
  [590, 410], [570, 440], [400, 280], [820, 180],
  [480, 360], [850, 300], [600, 140], [890, 450],
  [500, 520], [590, 660], [320, 140], [770, 660],
  [440, 60], [430, 650], [670, 200],
  [470, 300],
  [780, 480], [600, 580], [580, 680],
] as const;

function addTower(s: GameState, type: UnitTypeId, spot: number): Tower {
  const [x, y] = spots[spot];
  const tower: Tower = {
    id: s.nextId++, type, x, y, tier: 0, cd: 0, targetId: null,
    strength: type === 'memory' ? 1 : 0, wavesSurvived: 0, buffPower: 0,
  };
  s.currency -= UNIT[type].cost;
  s.towers.push(tower);
  return tower;
}

function tick(s: GameState, dt: number): void {
  if (s.subPhase === 'wave') {
    stepEnemies(s, dt, paths);
    stepTowers(s, dt);
    stepProjectiles(s, dt);
  }
  stepAbilities(s, dt);
  stepMeters(s, dt);
  stepWave(s, dt, paths);
}

function addLiverTower(s: GameState, type: UnitTypeId, spot: number): Tower {
  const [x, y] = liverSpots[spot];
  const tower: Tower = {
    id: s.nextId++, type, x, y, tier: 0, cd: 0, targetId: null,
    strength: type === 'memory' ? 1 : 0, wavesSurvived: 0, buffPower: 0,
  };
  s.currency -= UNIT[type].cost;
  s.towers.push(tower);
  return tower;
}

function tickLiver(s: GameState, dt: number): void {
  if (s.subPhase === 'wave') {
    stepEnemies(s, dt, liverPaths);
    stepTowers(s, dt);
    stepProjectiles(s, dt);
  }
  stepAbilities(s, dt);
  stepMeters(s, dt);
  stepWave(s, dt, liverPaths);
}

function addCnsTower(s: GameState, type: UnitTypeId, spot: number): Tower {
  const [x, y] = cnsSpots[spot];
  const tower: Tower = { id: s.nextId++, type, x, y, tier: 0, cd: 0, targetId: null, strength: type === 'memory' ? 1 : 0, wavesSurvived: 0, buffPower: 0 };
  s.currency -= UNIT[type].cost; s.towers.push(tower); return tower;
}

function tickCns(s: GameState, dt: number): void {
  if (s.subPhase === 'wave') { stepEnemies(s, dt, cnsPaths); stepTowers(s, dt); stepProjectiles(s, dt); }
  stepAbilities(s, dt); stepMeters(s, dt); stepWave(s, dt, cnsPaths);
}

function runCnsMixed(): GameState {
  const s = createInitialState('cns', 29); startGame(s, false);
  addCnsTower(s, 'bcma', 0); addCnsTower(s, 'bcma', 1);
  const builds: [UnitTypeId, number][] = [
    ['bcma', 2], ['bcma', 8], ['dual', 7], ['bcma', 6], ['bcma', 4], ['memory', 15], ['bcma', 3],
    ['bcma', 10], ['bcma', 11], ['bcma', 16],
  ];
  let buildIndex = 0; let safety = 0;
  while (s.phase === 'playing' && safety++ < 60000) {
    const reserve = s.meters.hematotoxicity >= 35 ? 130 : 55;
    const build = builds[buildIndex];
    const upgrade = s.towers.find((tower) => tower.tier === 0);
    const secondUpgrade = s.towers.find((tower) => tower.tier === 1);
    if (build && s.towers.length < 3 && s.currency >= UNIT[build[0]].cost + reserve) { addCnsTower(s, ...build); buildIndex++; }
    else if (upgrade && s.towers.length >= 8 && s.currency >= UNIT[upgrade.type].upgrades[0].cost + reserve) {
      s.currency -= UNIT[upgrade.type].upgrades[0].cost; upgrade.tier = 1;
    } else if (build && s.currency >= UNIT[build[0]].cost + reserve) { addCnsTower(s, ...build); buildIndex++; }
    else if (!build && secondUpgrade && s.currency >= UNIT[secondUpgrade.type].upgrades[1].cost + reserve) {
      s.currency -= UNIT[secondUpgrade.type].upgrades[1].cost; secondUpgrade.tier = 2;
      if (secondUpgrade.type === 'memory') secondUpgrade.strength += .5;
    }
    const warning = [...s.activeCnsBreaches].filter((event) => event.stage === 'warning').sort((a, b) => a.remaining - b.remaining)[0];
    if (warning && !s.cnsContainmentUsed && s.currency >= 55 + 75) containCnsBreach(s, warning.id);
    if (s.meters.crs >= 58 && canActivate(s, 'toci')) activate(s, 'toci');
    const activeCore = s.enemies.find((enemy) => enemy.alive && enemy.type === 'parenchymalCore');
    if (s.meters.neuro >= 90 && (!activeCore || activeCore.hp >= 600) && canActivate(s, 'dexa')) activate(s, 'dexa');
    if (s.meters.hematotoxicity >= 30 && canActivate(s, 'stemcell')) activate(s, 'stemcell');
    else if (s.meters.hematotoxicity >= 20 && canActivate(s, 'gcsf')) activate(s, 'gcsf');
    tickCns(s, .05);
    const end = checkEnd(s); if (end) s.phase = end;
  }
  return s;
}

function runHepaticMixed(): GameState {
  const s = createInitialState('liver', 19);
  startGame(s, false);
  addLiverTower(s, 'bcma', 0);
  const actions: Array<{ build: [UnitTypeId, number] } | { upgrade: [number, 0 | 1] }> = [
    { build: ['bcma', 1] }, { build: ['dual', 2] }, { upgrade: [2, 0] },
    { build: ['dual', 3] }, { build: ['bcma', 4] }, { build: ['dual', 5] },
    { build: ['bcma', 8] }, { upgrade: [6, 0] }, { upgrade: [5, 0] },
    { upgrade: [2, 1] },
    { upgrade: [0, 0] }, { upgrade: [1, 0] }, { upgrade: [3, 0] },
    { build: ['memory', 7] }, { build: ['dual', 9] }, { build: ['bcma', 10] },
    { build: ['dual', 11] }, { upgrade: [7, 0] },
    { upgrade: [3, 1] }, { upgrade: [5, 1] },
  ];
  let actionIndex = 0;
  let safety = 0;
  while (s.phase === 'playing' && safety++ < 36000) {
    const reserve = s.meters.hematotoxicity >= 20 ? 100 : 0;
    const action = actions[actionIndex];
    if (action && 'build' in action && s.currency >= UNIT[action.build[0]].cost + reserve) {
      addLiverTower(s, ...action.build);
      actionIndex++;
    } else if (action && 'upgrade' in action) {
      const [towerIndex, tier] = action.upgrade;
      const tower = s.towers[towerIndex];
      if (tower && tower.tier === tier) {
        const cost = UNIT[tower.type].upgrades[tier].cost;
        if (s.currency >= cost + reserve) {
          s.currency -= cost;
          tower.tier = (tier + 1) as 1 | 2;
          if (tower.type === 'memory') tower.strength += .5;
          actionIndex++;
        }
      } else if (tower) actionIndex++;
    }
    if (s.meters.crs >= 58 && canActivate(s, 'toci')) activate(s, 'toci');
    if (s.stats.dexaUses < 1 && s.meters.neuro >= 85 && canActivate(s, 'dexa')) activate(s, 'dexa');
    if (s.meters.hematotoxicity >= 58 && canActivate(s, 'stemcell')) activate(s, 'stemcell');
    else if (s.stats.gcsfUses < 8 && s.meters.hematotoxicity >= 45 && canActivate(s, 'gcsf')) activate(s, 'gcsf');
    tickLiver(s, .05);
    const end = checkEnd(s);
    if (end) s.phase = end;
  }
  return s;
}

function runBalanced(): { state: GameState; firstGcsfWave: number | null; gcsfWaves: Set<number> } {
  const s = createInitialState('marrow', 11);
  let firstGcsfWave: number | null = null;
  const gcsfWaves = new Set<number>();
  startGame(s, false);
  addTower(s, 'bcma', 0);
  const build: [UnitTypeId, number][] = [
    ['dual', 2], ['bcma', 5], ['dual', 6], ['memory', 4], ['bcma', 7],
    ['dual', 1], ['bcma', 3], ['dual', 8], ['bcma', 9], ['dual', 10], ['bcma', 11],
  ];
  const upgrades: [number, 0 | 1][] = [
    [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [3, 0], [4, 0], [4, 1],
    [2, 1], [3, 1], [5, 0], [6, 0], [7, 0], [8, 0], [5, 1], [6, 1],
    [9, 0], [10, 0], [11, 0], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1],
  ];
  let buildIndex = 0;
  let upgradeIndex = 0;
  let safety = 0;
  while (s.phase === 'playing' && safety++ < 30000) {
    const recoveryReserve = s.stats.peakHematotoxicity >= 20
      ? (!s.abilities.stemcell.used && s.meters.hematotoxicity >= 50 ? 185 : 90)
      : 0;
    if (buildIndex < build.length && s.currency >= UNIT[build[buildIndex][0]].cost + recoveryReserve) {
      addTower(s, ...build[buildIndex]);
      buildIndex++;
    } else if (buildIndex >= 2 && upgradeIndex < upgrades.length) {
      const [towerIndex, tier] = upgrades[upgradeIndex];
      const tower = s.towers[towerIndex];
      if (tower && tower.tier === tier) {
        const cost = UNIT[tower.type].upgrades[tier].cost;
        if (s.currency >= cost + recoveryReserve) {
          s.currency -= cost;
          tower.tier = (tier + 1) as 1 | 2;
          if (tower.type === 'memory') tower.strength += 0.5;
          upgradeIndex++;
        }
      } else if (tower) {
        upgradeIndex++;
      }
    }
    if (s.meters.crs >= 60 && canActivate(s, 'toci')) activate(s, 'toci');
    if ((s.meters.neuro >= 68 || s.meters.hyperinflammation >= 45) && canActivate(s, 'dexa')) activate(s, 'dexa');
    if (s.meters.hematotoxicity >= 55 && canActivate(s, 'stemcell')) activate(s, 'stemcell');
    else if (
      s.meters.hematotoxicity >= 20 &&
      (s.abilities.stemcell.used || s.meters.hematotoxicity < 55) &&
      (s.abilities.stemcell.used || s.currency >= 185) &&
      canActivate(s, 'gcsf')
    ) {
      firstGcsfWave ??= s.wave;
      gcsfWaves.add(s.wave);
      activate(s, 'gcsf');
    }
    if (s.meters.hyperinflammation >= 30 && canActivate(s, 'anakinra')) activate(s, 'anakinra');
    tick(s, 0.05);
    const end = checkEnd(s);
    if (end) s.phase = end;
  }
  return { state: s, firstGcsfWave, gcsfWaves };
}

describe('full-run balance', () => {
  it('uses legal placements for the representative hepatic mixed strategy', () => {
    for (let i = 0; i < liverSpots.length; i++) {
      const [x, y] = liverSpots[i];
      const prior = liverSpots.slice(0, i).map(([px, py], id): Tower => ({
        id, type: 'bcma', x: px, y: py, tier: 0, cd: 0, targetId: null,
        strength: 0, wavesSurvived: 0, buffPower: 0,
      }));
      expect(placementFailure(liverPaths, prior, x, y), `spot ${i}`).toBeNull();
      expect(distToLanePaths(liverPaths, x, y), `coverage ${i}`).toBeLessThan(112);
    }
  });

  it('allows a well-managed mixed strategy to clear the advanced hepatic level', () => {
    const s = runHepaticMixed();
    expect(s.phase, JSON.stringify({ wave: s.wave, meters: s.meters, stats: s.stats, towers: s.towers.length })).toBe('won');
    expect(s.stats.killsByType.hepaticCore).toBe(1);
    expect(s.bossEscaped).toBe(false);
    expect(s.meters.fitness).toBeGreaterThan(0);
    expect(s.stats.peakCrs).toBeLessThan(95);
    expect(s.stats.peakNeuro).toBeLessThan(95);
  });

  it('requires a geographically distributed mixed strategy to clear Neuroaxis', () => {
    expect(cnsSpots.length).toBeGreaterThanOrEqual(12);
    const s = runCnsMixed();
    expect(s.phase, JSON.stringify({ wave: s.wave, meters: s.meters, stats: s.stats, towers: s.towers.length })).toBe('won');
    expect(s.stats.killsByType.parenchymalCore).toBe(1);
    expect(s.bossEscaped).toBe(false);
    expect(new Set(s.towers.map((tower) => cnsPaths.map((path) => distToPath(path, tower.x, tower.y)).indexOf(Math.min(...cnsPaths.map((path) => distToPath(path, tower.x, tower.y)))))).size).toBe(3);
  });

  it('punishes an unattended single-unit hepatic strategy before the finale', () => {
    const s = createInitialState('liver', 23);
    startGame(s, false);
    addLiverTower(s, 'bcma', 0);
    let safety = 0;
    while (s.phase === 'playing' && s.wave < 10 && safety++ < 26000) {
      tickLiver(s, .05);
      const end = checkEnd(s);
      if (end) s.phase = end;
    }
    expect(s.phase === 'lost' || s.stats.escapes >= 20).toBe(true);
  });

  it('allows a balanced automated strategy to clear all ten waves', () => {
    const { state: s, firstGcsfWave, gcsfWaves } = runBalanced();
    expect(s.phase, JSON.stringify({ wave: s.wave, meters: s.meters, hematotoxicityLoad: s.hematotoxicityLoad, stats: s.stats, towers: s.towers.length })).toBe('won');
    expect(s.meters.hematotoxicity).toBeLessThan(85);
    expect(s.stats.peakCrs).toBeLessThan(85);
    expect(s.stats.peakNeuro).toBeLessThan(85);
    expect(s.stats.peakHyperinflammation).toBeLessThan(85);
    expect(s.stats.anakinraUses).toBeGreaterThan(0);
    expect(s.stats.gcsfUses).toBeGreaterThanOrEqual(3);
    expect(firstGcsfWave).not.toBeNull();
    expect(firstGcsfWave!).toBeLessThanOrEqual(4);
    expect(gcsfWaves.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps cumulative exposure controlled with periodic G-CSF but without Stem-Cell Boost', () => {
    const s = createInitialState('marrow', 31);
    startGame(s, false);
    s.currency = 1000;
    s.meters.hematotoxicity = 35;
    for (let wave = 1; wave <= 10; wave++) {
      s.subPhase = 'wave';
      s.meters.crs = 35 + wave * 2;
      s.meters.burden = 20 + wave * 2;
      for (let i = 0; i < 400; i++) {
        if (s.meters.hematotoxicity >= 20 && canActivate(s, 'gcsf')) activate(s, 'gcsf');
        stepAbilities(s, 0.05);
        stepMeters(s, 0.05);
      }
      s.subPhase = 'planning';
      for (let i = 0; i < 240; i++) {
        if (s.meters.hematotoxicity >= 20 && canActivate(s, 'gcsf')) activate(s, 'gcsf');
        stepAbilities(s, 0.05);
        stepMeters(s, 0.05);
      }
    }
    expect(s.stats.stemcellUses).toBe(0);
    expect(s.stats.gcsfUses).toBeGreaterThan(0);
    expect(s.stats.peakHematotoxicity).toBeGreaterThanOrEqual(20);
    expect(s.meters.hematotoxicity).toBeLessThan(50);
  });

  it('makes an unsupported BCMA-only strategy leak heavily by wave eight', () => {
    const s = createInitialState('marrow', 12);
    startGame(s, false);
    addTower(s, 'bcma', 0);
    let safety = 0;
    while (s.phase === 'playing' && s.wave <= 8 && safety++ < 22000) {
      tick(s, 0.05);
      const end = checkEnd(s);
      if (end) s.phase = end;
    }
    expect(s.phase === 'lost' || s.stats.escapes >= 10).toBe(true);
    expect(s.stats.peakHematotoxicity).toBeGreaterThan(65);
  });

});
