import { describe, expect, it } from 'vitest';
import { createInitialState, startGame } from '../game/GameState';
import { WAVES } from '../data/waves';
import { buildPath } from '../lib/path';
import { checkEnd } from './MeterSystem';
import { completeWave, expandWave, startWave, stepWave } from './WaveSystem';

const path = buildPath();

function fresh() {
  const s = createInitialState(1);
  startGame(s);
  return s;
}

describe('WaveSystem', () => {
  it('expandWave lists every spawn sorted by time', () => {
    const entries = expandWave(WAVES[0]);
    expect(entries).toHaveLength(6);
    expect(entries.every((e) => e.type === 'standard')).toBe(true);
    entries.forEach((e, i) => expect(e.at).toBeCloseTo(1 + i * 2.2, 5));
    const last = expandWave(WAVES[9]);
    expect(last.length).toBeGreaterThan(0);
    expect(Math.max(...last.map((e) => e.at))).toBeLessThan(99);
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
    stepWave(s, 1.5, path);
    expect(s.enemies).toHaveLength(1);
    stepWave(s, 12, path);
    expect(s.enemies).toHaveLength(6);
    expect(s.waveSpawnQueue).toHaveLength(0);
  });

  it('completing a wave pays out, advances the wave and returns to planning', () => {
    const s = fresh();
    startWave(s);
    s.waveTimer = 99;
    stepWave(s, 0.01, path);
    expect(s.enemies).toHaveLength(6);
    for (const e of s.enemies) e.alive = false;
    stepWave(s, 0.01, path);
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
    stepWave(s, 0.01, path);
    expect(s.waveSpawnQueue).toHaveLength(0);
    for (const e of s.enemies) e.alive = false;
    stepWave(s, 0.01, path);
    expect(s.wave).toBe(11);
    expect(checkEnd(s)).toBe('won');
  });

  it('planning countdown auto-starts the next wave', () => {
    const s = fresh();
    s.countdown = 0.5;
    stepWave(s, 1, path);
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
});
