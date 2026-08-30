// Wave scheduling and completion. Pure; operates on GameState + the level's lanes.
import type { AbilityId, GameState, SpawnEntry, EnemyTypeId, Meters, HepaticCueKind } from '../game/types';
import type { Wave } from '../data/waves';
import { wavesForLevel, LEVELS } from '../data/levels';
import { START, ENEMY, ECONOMY, METER, IEC_HS } from '../game/Balance';
import { posAt, type PathDef } from '../lib/path';

const enemyCounts = () => ({ standard: 0, proliferative: 0, highBurden: 0, bcmaLow: 0, hepaticCore: 0 });
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
      out.push({ type: grp.type, at: grp.start + i * grp.gap, lane: grp.lane ?? 0, behavior: grp.behavior });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

export function emitHepaticCue(s: GameState, kind: HepaticCueKind, lane: number): void {
  s.hepaticCueSerial++;
  s.hepaticCue = { serial: s.hepaticCueSerial, kind, lane };
}

export function spawnEnemy(
  s: GameState,
  type: EnemyTypeId,
  lane: number,
  paths: PathDef[],
  behavior?: SpawnEntry['behavior'],
): void {
  const en = ENEMY[type];
  const lanes = LEVELS[s.level].lanes;
  const idx = ((lane % lanes.length) + lanes.length) % lanes.length;
  const mod = lanes[idx].mods[type];
  const hp = en.hp * mod.hp * (behavior === 'surge' ? .62 : 1);
  const path = paths[idx % paths.length];
  const p = posAt(path, 0);
  const enemy = {
    id: s.nextId++,
    type,
    x: p.x,
    y: p.y,
    pathPos: 0,
    lane: idx,
    speed: en.speed * mod.speed * (behavior === 'surge' ? 1.12 : 1),
    reward: en.reward * mod.reward * (behavior === 'surge' ? .75 : 1),
    hp,
    maxHp: hp,
    alive: true, behavior, baseSpeed: en.speed * mod.speed * (behavior === 'surge' ? 1.12 : 1),
    bossPhase: type === 'hepaticCore' ? 1 as const : undefined,
  };
  s.enemies.push(enemy);
  if (type === 'hepaticCore') {
    for (let i = 0; i < 3; i++) {
      s.enemies.push({
        id: s.nextId++, type: 'standard' as const, lane: idx, x: p.x, y: p.y,
        pathPos: 0, speed: 0, baseSpeed: 0, reward: 12,
        hp: 45, maxHp: 45, alive: true,
        behavior: 'bossEscort' as const, parentBossId: enemy.id,
      });
    }
  }
}

export function startWave(s: GameState): void {
  if (s.level === 'marrow' && s.wave === IEC_HS.onsetWave && !s.iecHsUnlocked) {
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
  const wave = wavesForLevel(s.level)[s.wave - 1];
  s.waveSpawnQueue = expandWave(wave);
  s.hepaticEventQueue = (wave.events ?? []).map((event, index) => ({
    id: s.wave * 100 + index,
    kind: event.kind,
    lane: event.lane,
    at: event.at,
    count: event.count,
    enemyType: event.enemyType ?? 'proliferative',
    warned: false,
    fired: false,
  }));
  s.activeHepaticEvent = null;
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

export function stepSpawns(s: GameState, dt: number, paths: PathDef[]): void {
  s.waveTimer += dt;
  if (s.activeHepaticEvent) {
    s.activeHepaticEvent.remaining -= dt;
    if (s.activeHepaticEvent.remaining <= 0) s.activeHepaticEvent = null;
  }
  for (const event of s.hepaticEventQueue) {
    if (!event.warned && s.waveTimer >= event.at - 3) {
      event.warned = true;
      s.activeHepaticEvent = { id: event.id, kind: event.kind, lane: event.lane, stage: 'warning', remaining: 3 };
      emitHepaticCue(s, 'flareWarn', event.lane);
    }
    if (!event.fired && s.waveTimer >= event.at) {
      event.fired = true;
      s.activeHepaticEvent = { id: event.id, kind: event.kind, lane: event.lane, stage: 'impact', remaining: 1.2 };
      emitHepaticCue(s, 'flareImpact', event.lane);
      for (let i = 0; i < event.count; i++) {
        s.waveSpawnQueue.push({ type: event.enemyType, lane: event.lane, at: event.at + i * .42, behavior: 'surge' });
      }
      s.waveSpawnQueue.sort((a, b) => a.at - b.at);
    }
  }
  s.hepaticEventQueue = s.hepaticEventQueue.filter((event) => !event.fired);
  while (s.waveSpawnQueue.length > 0 && s.waveSpawnQueue[0].at <= s.waveTimer) {
    const e = s.waveSpawnQueue.shift();
    if (e) spawnEnemy(s, e.type, e.lane, paths, e.behavior);
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
  s.hepaticEventQueue = [];
  s.activeHepaticEvent = null;
  s.subPhase = 'planning';
  s.countdown = START.countdown;
}

export function stepWave(s: GameState, dt: number, paths: PathDef[]): void {
  if (s.subPhase === 'planning') {
    const guidedConstruction = s.onboarding.active
      && (s.onboarding.hint === 'chooseUnit'
        || s.onboarding.hint === 'placeUnit'
        || s.onboarding.hint === 'reinforce');
    if (guidedConstruction) return;
    s.countdown -= dt;
    if (s.countdown <= 0 && s.wave <= s.wavesTotal) startWave(s);
  } else {
    stepSpawns(s, dt, paths);
    if (!s.bossEscaped && s.waveSpawnQueue.length === 0 && s.hepaticEventQueue.length === 0 && s.enemies.length > 0 && s.enemies.every((e) => !e.alive)) {
      completeWave(s);
    }
  }
}
