// Factory + reset for a fresh deterministic state.
import type { GameState } from './types';
import { START } from './Balance';
import { WAVES } from '../data/waves';
import { mulberry32 } from '../lib/rng';

const enemyCounts = () => ({ standard: 0, proliferative: 0, highBurden: 0, bcmaLow: 0 });

function freshStats(): GameState['stats'] {
  return {
kills: 0,
  peakCrs: 0,
    peakNeuro: 0,
    peakHyperinflammation: 0,
    peakHematotoxicity: 0,
  lowestFitness: 100,
    severeCrsEvents: 0,
    tociUses: 0,
    dexaUses: 0,
    stemcellUses: 0,
    gcsfUses: 0,
    anakinraUses: 0,
    escapes: 0,
    time: 0,
    burdenPeak: 0,
    fundingEarned: 0,
    killsByType: enemyCounts(),
    escapesByType: enemyCounts(),
  };
}

function freshAbilities(): GameState['abilities'] {
  return {
    toci: { cooldown: 0, used: false },
    dexa: { cooldown: 0, used: false },
    stemcell: { cooldown: 0, used: false },
    anakinra: { cooldown: 0, used: false },
    gcsf: { cooldown: 0, used: false },
  };
}

export function createInitialState(seed: number): GameState {
  return {
    phase: 'menu',
    subPhase: 'planning',
    wave: 1,
    wavesTotal: WAVES.length,
    countdown: START.countdown,
    currency: START.currency,
    meters: { ...START.meter, hyperinflammation: 0 },
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    abilities: freshAbilities(),
    crsSuppressedUntil: 0,
    dexaUntil: 0,
    stemCellRecoveryUntil: 0,
    gcsfUntil: 0,
    hematotoxicityLoad: 0,
    stats: freshStats(),
    onboarding: { active: false, hint: null },
    rng: mulberry32(seed),
    nextId: 1,
    waveSpawnQueue: [],
    waveTimer: 0,
    waveBaseline: null,
    lastWaveReport: null,
    iecHsActive: false,
    iecHsUnlocked: false,
    anakinraUntil: 0,
    iecHsDexaUntil: 0,
    hyperinflammationTrend: 0,
  };
}

export function startGame(s: GameState, tutorialActive = true): void {
  s.phase = 'playing';
  s.subPhase = 'planning';
  s.wave = 1;
  s.countdown = START.countdown;
  s.currency = START.currency;
  s.meters = { ...START.meter, hyperinflammation: 0 };
  s.enemies = [];
  s.towers = [];
  s.projectiles = [];
  s.particles = [];
  s.abilities = freshAbilities();
  s.crsSuppressedUntil = 0;
  s.dexaUntil = 0;
  s.stemCellRecoveryUntil = 0;
  s.gcsfUntil = 0;
  s.hematotoxicityLoad = 0;
  s.stats = freshStats();
  s.onboarding = { active: tutorialActive, hint: tutorialActive ? 'chooseUnit' : null };
  s.nextId = 1;
  s.waveSpawnQueue = [];
  s.waveTimer = 0;
  s.waveBaseline = null;
  s.lastWaveReport = null;
  s.iecHsActive = false;
  s.iecHsUnlocked = false;
  s.anakinraUntil = 0;
  s.iecHsDexaUntil = 0;
  s.hyperinflammationTrend = 0;
}
