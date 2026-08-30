import { describe, expect, it } from 'vitest';
import { createInitialState, startGame } from '../game/GameState';
import { WAVES, LIVER_WAVES } from '../data/waves';
import { LEVELS } from '../data/levels';
import { buildPaths } from '../lib/path';
import { checkEnd } from './MeterSystem';
import { stepEnemies } from './CombatSystem';
import { completeWave, expandWave, startWave, stepWave } from './WaveSystem';

const paths = buildPaths('marrow');

function fresh(level: 'marrow' | 'liver' = 'marrow') {
  const s = createInitialState(level, 1);
  startGame(s);
  return s;
}

describe('WaveSystem', () => {
  it('expandWave lists every spawn sorted by time', () => {
    const entries = expandWave(WAVES[0]);
    expect(entries).toHaveLength(6);
    expect(entries.every((e) => e.type === 'standard' && e.lane === 0)).toBe(true);
    entries.forEach((e, i) => expect(e.at).toBeCloseTo(1 + i * 2.2, 5));
    const last = expandWave(WAVES[9]);
    expect(last.length).toBeGreaterThan(0);
    expect(Math.max(...last.map((e) => e.at))).toBeLessThan(99);
  });

  it('expandWave preserves per-lane grouping on the liver level', () => {
    const entries = expandWave(LIVER_WAVES[0]);
    expect(entries.length).toBeGreaterThan(0);
    expect(new Set(entries.map((e) => e.lane)).size).toBeGreaterThan(1);
    entries.forEach((e) => expect([0, 1, 2]).toContain(e.lane));
    const sorted = [...entries].sort((a, b) => a.at - b.at);
    expect(entries).toEqual(sorted);
    const scheduled = LIVER_WAVES.reduce((total, wave) => total + expandWave(wave).length, 0);
    const flareSpawns = LIVER_WAVES.reduce((total, wave) =>
      total + (wave.events ?? []).reduce((count, event) => count + event.count, 0), 0);
    expect(WAVES.reduce((total, wave) => total + expandWave(wave).length, 0)).toBe(287);
    expect(scheduled).toBe(183);
    expect(flareSpawns).toBe(27);
    expect(LIVER_WAVES.slice(0, 5).map((wave) =>
      wave.groups.find((group) => group.behavior === 'surge')?.count)).toEqual([1, 1, 1, 1, 1]);
    expect(LIVER_WAVES.slice(5).map((wave) =>
      wave.groups.find((group) => group.behavior === 'surge')?.count)).toEqual([3, 3, 3, 3, 3]);
    expect(LIVER_WAVES.every((wave) => new Set(wave.groups.map((group) => group.lane)).size === 3)).toBe(true);
    expect(LIVER_WAVES.every((wave) => wave.groups.some((group) => group.behavior === 'surge'))).toBe(true);
    expect(LEVELS.liver.scoreKillTarget).toBeGreaterThan(scheduled + flareSpawns);
  });

  it('startWave switches to wave phase and fills the spawn queue', () => {
    const s = fresh();
    expect(s.subPhase).toBe('planning');
    startWave(s);
    expect(s.subPhase).toBe('wave');
    expect(s.waveSpawnQueue).toHaveLength(6);
  });

  it('stepWave spawns enemies as the timer passes their spawn time', () => {
    const s = fresh();
    startWave(s);
    stepWave(s, 1.5, paths);
    expect(s.enemies).toHaveLength(1);
    stepWave(s, 12, paths);
    expect(s.enemies).toHaveLength(6);
    expect(s.waveSpawnQueue).toHaveLength(0);
  });

  it('liver spawns land on their assigned lane', () => {
    const s = fresh('liver');
    startWave(s);
    stepWave(s, 99, buildPaths('liver'));
    expect(s.enemies.length).toBeGreaterThan(0);
    for (const e of s.enemies) {
      expect([0, 1, 2]).toContain(e.lane);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.reward).toBeGreaterThan(0);
    }
  });

  it('warns three seconds before a hepatic surge and fires it once', () => {
    const s = fresh('liver');
    s.wave = 4;
    startWave(s);
    const liverPaths = buildPaths('liver');
    stepWave(s, 5.9, liverPaths);
    expect(s.activeHepaticEvent).toBeNull();
    stepWave(s, .2, liverPaths);
    expect(s.activeHepaticEvent).toMatchObject({ lane: 1, stage: 'warning' });
    expect(s.hepaticCue?.kind).toBe('flareWarn');
    stepWave(s, 2.9, liverPaths);
    expect(s.activeHepaticEvent).toMatchObject({ lane: 1, stage: 'impact' });
    expect(s.hepaticCue?.kind).toBe('flareImpact');
    expect(s.waveSpawnQueue.some((entry) => entry.behavior === 'surge')).toBe(true);
    expect(s.hepaticEventQueue).toHaveLength(0);
  });

  it('completing a wave pays out, advances the wave and returns to planning', () => {
    const s = fresh();
    startWave(s);
    s.waveTimer = 99;
    stepWave(s, 0.01, paths);
    expect(s.enemies).toHaveLength(6);
    for (const e of s.enemies) e.alive = false;
    stepWave(s, 0.01, paths);
    expect(s.subPhase).toBe('planning');
    expect(s.wave).toBe(2);
    expect(s.countdown).toBe(12);
    // 120 start + (45 + 5*1) clear bonus + 20 no-severe bonus
    expect(s.currency).toBeCloseTo(120 + 50 + 20);
    expect(s.lastWaveReport).toMatchObject({ wave: 1, kills: 0, escapes: 0 });
    expect(s.enemies).toHaveLength(0);
  });

  it('reports peak hematotoxicity for the completed wave', () => {
    const s = fresh();
    startWave(s);
    s.waveBaseline!.peakHematotoxicity = 57;
    completeWave(s);
    expect(s.lastWaveReport?.peakHematotoxicity).toBe(57);
  });

  it('clearing the final wave wins the game', () => {
    const s = fresh();
    s.wave = 10;
    startWave(s);
    s.waveTimer = 99;
    stepWave(s, 0.01, paths);
    expect(s.waveSpawnQueue).toHaveLength(0);
    for (const e of s.enemies) e.alive = false;
    stepWave(s, 0.01, paths);
    expect(s.wave).toBe(11);
    expect(checkEnd(s)).toBe('won');
  });

  it('planning countdown auto-starts the next wave', () => {
    const s = fresh();
    s.countdown = 0.5;
    stepWave(s, 1, paths);
    expect(s.subPhase).toBe('wave');
    completeWave(s);
    expect(s.subPhase).toBe('planning');
    expect(s.wave).toBe(2);
  });

  it('starts the guaranteed IEC-HS episode on wave nine from prior risk', () => {
    const s = fresh();
    s.wave = 9;
    s.stats.peakCrs = 72;
    s.meters.burden = 50;
    startWave(s);
    expect(s.iecHsActive).toBe(true);
    expect(s.iecHsUnlocked).toBe(true);
    expect(s.meters.hyperinflammation).toBeGreaterThan(25);
  });

  it('skips the IEC-HS episode outside the marrow level', () => {
    const s = fresh('liver');
    s.wave = 9;
    s.stats.peakCrs = 72;
    s.meters.burden = 50;
    startWave(s);
    expect(s.iecHsActive).toBe(false);
    expect(s.iecHsUnlocked).toBe(false);
  });

  it('spawns the hepatic plasmacytoma core as the required wave-ten boss', () => {
    const s = fresh('liver');
    const liverPaths = buildPaths('liver');
    s.wave = 10;
    startWave(s);
    stepWave(s, 99, liverPaths);
    const boss = s.enemies.find((enemy) => enemy.type === 'hepaticCore');
    expect(boss).toMatchObject({ lane: 2, hp: 1200, maxHp: 1200, reward: 160, alive: true, bossPhase: 1 });
    expect(s.enemies.filter((enemy) => enemy.behavior === 'bossEscort')).toHaveLength(3);
    for (const enemy of s.enemies) if (enemy !== boss) enemy.alive = false;
    stepWave(s, .01, liverPaths);
    expect(s.wave).toBe(10);
    boss!.alive = false;
    stepWave(s, .01, liverPaths);
    expect(s.wave).toBe(11);
    expect(checkEnd(s)).toBe('won');
  });

  it('loses immediately when the hepatic core escapes', () => {
    const s = fresh('liver');
    const liverPaths = buildPaths('liver');
    s.enemies.push({
      id: 99, type: 'hepaticCore', lane: 2, x: 0, y: 0,
      pathPos: liverPaths[2].length - 1, hp: 1200, maxHp: 1200,
      speed: 8, reward: 160, alive: true,
    });
    stepEnemies(s, 1, liverPaths);
    expect(s.bossEscaped).toBe(true);
    expect(checkEnd(s)).toBe('lost');
  });
});
