// Wave scheduling and completion. Pure; operates on GameState + the path.
import type { AbilityId, GameState, SpawnEntry, EnemyTypeId, Meters } from '../game/types';
import { WAVES, type Wave } from '../data/waves';
import { START, ENEMY, ECONOMY, METER, IEC_HS } from '../game/Balance';
import { posAt, type PathDef } from '../lib/path';

const enemyCounts = () => ({ standard: 0, proliferative: 0, highBurden: 0, bcmaLow: 0 });
const copyMeters = (meters: Meters): Meters => ({ ...meters });
const abilityUses = (s: GameState): Record<AbilityId, number> => ({
  toci: s.stats.tociUses,
  dexa: s.stats.dexaUses,
  stemcell: s.stats.stemcellUses,
  anakinra: s.stats.anakinraUses,
  gcsf: s.stats.gcsfUses,
});

export function expandWave(w: Wave): SpawnEntry[] {
  const out: SpawnEntry[] = [];
  for (const grp of w.groups) {
    for (let i = 0; i < grp.count; i++) {
      out.push({ type: grp.type, at: grp.start + i * grp.gap });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

export function spawnEnemy(s: GameState, type: EnemyTypeId, path: PathDef): void {
  const en = ENEMY[type];
  const p = posAt(path, 0);
  s.enemies.push({
    id: s.nextId++,
    type,
    x: p.x,
    y: p.y,
    pathPos: 0,
    hp: en.hp,
    maxHp: en.hp,
    alive: true,
  });
}

export function startWave(s: GameState): void {
  if (s.wave === IEC_HS.onsetWave && !s.iecHsUnlocked) {
    const priorPeak = s.lastWaveReport?.peakCrs ?? s.stats.peakCrs;
    s.meters.hyperinflammation = Math.min(
      IEC_HS.maxInitialSeverity,
      IEC_HS.baseSeverity + priorPeak * IEC_HS.peakCrsFactor + s.meters.burden * IEC_HS.burdenFactor,
    );
    s.iecHsActive = true;
    s.iecHsUnlocked = true;
  }
  s.subPhase = 'wave';
  s.waveTimer = 0;
  s.waveSpawnQueue = expandWave(WAVES[s.wave - 1]);
  s.waveBaseline = {
    kills: s.stats.kills,
    escapes: s.stats.escapes,
    fundingEarned: s.stats.fundingEarned,
    peakCrs: s.meters.crs,
    peakNeuro: s.meters.neuro,
    peakHyperinflammation: s.meters.hyperinflammation,
    peakHematotoxicity: s.meters.hematotoxicity,
    startMeters: copyMeters(s.meters),
    killsByType: { ...s.stats.killsByType },
    escapesByType: { ...s.stats.escapesByType },
    abilityUses: abilityUses(s),
  };
  s.lastWaveReport = null;
}

export function stepSpawns(s: GameState, dt: number, path: PathDef): void {
  s.waveTimer += dt;
  while (s.waveSpawnQueue.length > 0 && s.waveSpawnQueue[0].at <= s.waveTimer) {
    const e = s.waveSpawnQueue.shift();
    if (e) spawnEnemy(s, e.type, path);
  }
}

export function completeWave(s: GameState): void {
  s.enemies = s.enemies.filter((e) => e.alive);
  const cleared = s.wave;
  let payout = ECONOMY.waveClearBase + ECONOMY.waveClearPerWave * cleared;
  if (s.stats.severeCrsEvents === 0) payout += ECONOMY.noSevereBonus;
  s.currency += payout;
  s.stats.fundingEarned += payout;
  const baseline = s.waveBaseline;
  if (baseline) {
    const killsByType = enemyCounts();
    const escapesByType = enemyCounts();
    for (const type of Object.keys(killsByType) as EnemyTypeId[]) {
      killsByType[type] = s.stats.killsByType[type] - baseline.killsByType[type];
      escapesByType[type] = s.stats.escapesByType[type] - baseline.escapesByType[type];
    }
    const used = abilityUses(s);
    for (const id of Object.keys(used) as AbilityId[]) used[id] -= baseline.abilityUses[id];
    s.lastWaveReport = {
      wave: cleared,
      kills: s.stats.kills - baseline.kills,
      escapes: s.stats.escapes - baseline.escapes,
      fundingEarned: Math.round(s.stats.fundingEarned - baseline.fundingEarned),
      peakCrs: Math.round(baseline.peakCrs),
      peakNeuro: Math.round(baseline.peakNeuro),
      peakHyperinflammation: Math.round(baseline.peakHyperinflammation),
      peakHematotoxicity: Math.round(baseline.peakHematotoxicity),
      startMeters: copyMeters(baseline.startMeters),
      endMeters: copyMeters(s.meters),
      killsByType,
      escapesByType,
      abilityUses: used,
    };
  }
  s.meters.burden = Math.max(0, s.meters.burden * (1 - METER.burdenDecay));
  for (const m of s.towers) {
    if (m.type !== 'memory') continue;
    const rate = ECONOMY.memoryWaveGrowth * (m.tier >= 1 ? 1.6 : 1);
    m.strength += rate;
    m.wavesSurvived++;
  }
  s.stats.severeCrsEvents = 0;
  s.wave = cleared + 1;
  s.waveBaseline = null;
  s.subPhase = 'planning';
  s.countdown = START.countdown;
}

export function stepWave(s: GameState, dt: number, path: PathDef): void {
  if (s.subPhase === 'planning') {
    s.countdown -= dt;
    if (s.countdown <= 0 && s.wave <= s.wavesTotal) startWave(s);
  } else {
    stepSpawns(s, dt, path);
    if (s.waveSpawnQueue.length === 0 && s.enemies.length > 0 && s.enemies.every((e) => !e.alive)) {
      completeWave(s);
    }
  }
}
