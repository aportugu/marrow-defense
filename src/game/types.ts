// Shared types for the Marrow Defense core simulation.
// The simulation (systems/) is pure and depends only on these + Balance.

export type Vec = { x: number; y: number };

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

export type EnemyTypeId = 'standard' | 'proliferative' | 'highBurden' | 'bcmaLow' | 'hepaticCore';
export type UnitTypeId = 'bcma' | 'dual' | 'memory';
export type AbilityId = 'toci' | 'dexa' | 'stemcell' | 'anakinra' | 'gcsf';
export type HintId = 'chooseUnit' | 'placeUnit' | 'startWave';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'won' | 'lost';
export type SubPhase = 'planning' | 'wave';
export type LevelId = 'marrow' | 'liver';
export type ResponseCategory = 'sCR' | 'CR' | 'VGPR' | 'PR' | 'SD' | 'PD';
export type EnemyBehavior = 'mitotic' | 'obstruction' | 'bossEscort' | 'surge';
export type HepaticEventKind = 'surge' | 'bossPhase';
export type HepaticCueKind = 'flareWarn' | 'flareImpact' | 'division' | 'obstruction' | 'shieldBreak' | 'bossPhase2' | 'bossPhase3';

export interface Enemy {
  id: number;
  type: EnemyTypeId;
  lane: number;
  x: number;
  y: number;
  pathPos: number;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  alive: boolean;
  behavior?: EnemyBehavior;
  splitDone?: boolean;
  obstructionTimer?: number;
  escortsSpawned?: number;
  parentBossId?: number;
  bossPhase?: 1 | 2 | 3;
  baseSpeed?: number;
}

export interface Tower {
  id: number;
  type: UnitTypeId;
  x: number;
  y: number;
  tier: 0 | 1 | 2;
  cd: number;
  targetId: number | null;
  strength: number;
  wavesSurvived: number;
  buffPower: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  unit: UnitTypeId;
  crsFactor: number;
  dead?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  effect?: 'cytokine' | 'neuro' | 'resist' | 'dual' | 'division' | 'obstruction' | 'boss';
}

export interface Meters {
  burden: number; // 0..100, informational (disease load)
  crs: number; // 0..100, lose @ 100
  neuro: number; // 0..100, lose @ 100 (neurotoxicity)
  fitness: number; // 0..100, lose @ 0
  hematotoxicity: number; // 0..100, higher is worse; indirect fitness pressure
  hyperinflammation: number; // 0..100, IEC-HS pressure; lose @ 100
}

export interface AbilityState {
  cooldown: number;
  used: boolean;
}

export interface OnboardingState {
  active: boolean;
  hint: HintId | null;
}

export interface Stats {
  kills: number;
  peakCrs: number;
  peakNeuro: number;
  peakHyperinflammation: number;
  peakHematotoxicity: number;
  lowestFitness: number;
  severeCrsEvents: number;
  tociUses: number;
  dexaUses: number;
  stemcellUses: number;
  gcsfUses: number;
  anakinraUses: number;
  escapes: number;
  time: number;
  burdenPeak: number;
  fundingEarned: number;
  killsByType: Record<EnemyTypeId, number>;
  escapesByType: Record<EnemyTypeId, number>;
}

export interface WaveReport {
  wave: number;
  kills: number;
  escapes: number;
  fundingEarned: number;
  peakCrs: number;
  peakNeuro: number;
  peakHyperinflammation: number;
  peakHematotoxicity: number;
  startMeters: Meters;
  endMeters: Meters;
  killsByType: Record<EnemyTypeId, number>;
  escapesByType: Record<EnemyTypeId, number>;
  abilityUses: Record<AbilityId, number>;
}

export interface WaveBaseline {
  kills: number;
  escapes: number;
  fundingEarned: number;
  peakCrs: number;
  peakNeuro: number;
  peakHyperinflammation: number;
  peakHematotoxicity: number;
  startMeters: Meters;
  killsByType: Record<EnemyTypeId, number>;
  escapesByType: Record<EnemyTypeId, number>;
  abilityUses: Record<AbilityId, number>;
}

export type PlacementFailure = 'path' | 'overlap' | 'bounds' | 'funding';
export type PlacementResult =
  | { ok: true; tower: Tower }
  | { ok: false; reason: PlacementFailure };

export interface ComputedTowerStats {
  range: number;
  attacksPerSecond: number;
  standardDamage: number;
  bcmaLowDamage: number;
  crsFactor: number;
  supportPower: number;
  supportRadius: number;
}

export interface SpawnEntry {
  type: EnemyTypeId;
  lane: number;
  at: number;
  behavior?: EnemyBehavior;
}

export interface HepaticEventEntry {
  id: number;
  kind: HepaticEventKind;
  lane: number;
  at: number;
  count: number;
  enemyType: EnemyTypeId;
  warned: boolean;
  fired: boolean;
}

export interface ActiveHepaticEvent {
  id: number;
  kind: HepaticEventKind;
  lane: number;
  stage: 'warning' | 'impact';
  remaining: number;
}

export interface HepaticCue {
  serial: number;
  kind: HepaticCueKind;
  lane: number;
}

export interface GameState {
  phase: GamePhase;
  subPhase: SubPhase;
  level: LevelId;
  wave: number;
  wavesTotal: number;
  countdown: number;
  currency: number;
  meters: Meters;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  particles: Particle[];
  abilities: Record<AbilityId, AbilityState>;
  crsSuppressedUntil: number;
  dexaUntil: number;
  stemCellRecoveryUntil: number;
  gcsfUntil: number;
  hematotoxicityLoad: number;
  stats: Stats;
  onboarding: OnboardingState;
  rng: () => number;
  nextId: number;
  waveSpawnQueue: SpawnEntry[];
  waveTimer: number;
  waveBaseline: WaveBaseline | null;
  lastWaveReport: WaveReport | null;
  iecHsActive: boolean;
  iecHsUnlocked: boolean;
  anakinraUntil: number;
  iecHsDexaUntil: number;
  hyperinflammationTrend: number;
  bossEscaped: boolean;
  hepaticEventQueue: HepaticEventEntry[];
  activeHepaticEvent: ActiveHepaticEvent | null;
  hepaticCue: HepaticCue | null;
  hepaticCueSerial: number;
}
