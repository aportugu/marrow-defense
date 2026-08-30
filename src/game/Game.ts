// Orchestrator: owns state, level paths, input, the rAF loop, sound and progress.
// Calls the pure systems each tick, then renders + syncs the UI.
import type {
  GameState,
  Vec,
  LevelId,
  UnitTypeId,
  AbilityId,
  Tower,
  PlacementResult,
  NoticeMessage,
} from './types';
import { CANVAS_W, CANVAS_H } from './types';
import { ABILITY, UNIT } from './Balance';
import { createInitialState, startGame } from './GameState';
import { buildPaths, guidedPlacementFailure, placementFailure, type PathDef } from '../lib/path';
import { stepTowers, stepProjectiles, stepEnemies } from '../systems/CombatSystem';
import { containCnsBreach, stepWave, startWave } from '../systems/WaveSystem';
import { stepMeters, checkEnd } from '../systems/MeterSystem';
import { stepAbilities, activate, canActivate } from '../systems/AbilitySystem';
import { computeScore, type ScoreResult } from '../systems/ScoringSystem';
import { render } from './Renderer';
import { Sound } from '../audio/Sound';
import { Music, type MusicScene } from '../audio/Music';
import { KineticBackground } from './KineticBackground';
import { IntroCutscene, introTimeline, shouldTriggerIntroCue } from './IntroCutscene';
import {
  loadSettings,
  saveSettings,
  loadHighScore,
  saveHighScore,
  loadProgress,
  saveProgress,
  isBetterResult,
  type Settings,
  type Progress,
} from '../lib/storage';

export type MenuKind =
  | 'start'
  | 'pause'
  | 'win'
  | 'lose'
  | 'science'
  | 'settings'
  | null;

export interface GameCallbacks {
  onSync?: (s: GameState) => void;
  onNotice?: (message: NoticeMessage) => void;
}

export class Game {
  state: GameState;
  paths: PathDef[];
  progress: Progress;
  canvas: HTMLCanvasElement;
  sound = new Sound();
  music = new Music();
  kinetic = new KineticBackground();
  intro = new IntroCutscene();
  heat = 0;
  lastEscapes = 0;
  crsWarned = false;
  neuroWarned = false;
  iecHsWasActive = false;
  settings: Settings;
  highScore: number;
  hasEnteredMenu = false;
  selectedTower: number | null = null;
  buildType: UnitTypeId | null = null;
  cursor: Vec | null = null;
  shake = 0;
  cb: GameCallbacks;

  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private visualTime = 0;
  private introStartedAt = 0;
  private lastIntroCueId: string | null = null;
  private lastHepaticCueSerial = 0;
  private lastCnsCueSerial = 0;

  constructor(canvas: HTMLCanvasElement | null = null, cb: GameCallbacks = {}) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.cb = cb;
    this.paths = buildPaths('marrow');
    this.state = createInitialState('marrow', 1337);
    this.progress = loadProgress();
    this.settings = loadSettings();
    this.sound.applySettings(this.settings);
    this.music.applySettings(this.settings);
    this.highScore = loadHighScore();
    document.documentElement.classList.toggle('reduce-motion', this.settings.reducedMotion);

    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    this.canvas.width = CANVAS_W * dpr;
    this.canvas.height = CANVAS_H * dpr;
    const c = this.canvas.getContext('2d');
    if (!c) throw new Error('2D canvas context unavailable');
    this.ctx = c;
    this.ctx.scale(dpr, dpr);
    this.last = typeof performance !== 'undefined' ? performance.now() : 0;
    if (typeof requestAnimationFrame !== 'undefined') {
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.visualTime += dt;
    this.update(dt * this.settings.speed);
    this.render();
    this.cb.onSync?.(this.state);
    this.raf = requestAnimationFrame(this.frame);
  };

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.music.dispose();
  }

  render(): void {
    const s = this.state;
    render(this.ctx, this.state, {
      cursor: this.cursor,
      selectedTower: this.selectedTower,
      buildType: this.buildType,
      paths: this.paths,
      shake: this.shake,
      time: this.visualTime,
      introTime: this.hasEnteredMenu ? Math.max(0, this.visualTime - this.introStartedAt) : 0,
      kinetic: this.kinetic,
      intro: this.intro,
      kineticSignals: {
        phase: s.phase,
        subPhase: s.subPhase,
        waveProgress: (s.wave - 1) / Math.max(1, s.wavesTotal - 1),
        crs: s.meters.crs,
        neuro: s.meters.neuro,
        burden: s.meters.burden,
        leakHeat: this.heat,
        hyperinflammation: s.meters.hyperinflammation,
        iecHsActive: s.iecHsActive,
        hematotoxicity: s.meters.hematotoxicity,
        stemCellRecovery: s.stats.time < s.stemCellRecoveryUntil,
        gcsfSupport: s.stats.time < s.gcsfUntil,
        reducedMotion: this.settings.reducedMotion,
        level: s.level,
        bossActive: s.enemies.some((enemy) => enemy.alive && (enemy.type === 'hepaticCore' || enemy.type === 'parenchymalCore')),
        bossDefeated: s.stats.killsByType.hepaticCore > 0 || s.stats.killsByType.parenchymalCore > 0,
        activeHepaticEvent: s.activeHepaticEvent,
        activeCnsBreaches: s.activeCnsBreaches,
        cnsBurden: s.meters.cnsBurden,
        bossPhase: s.enemies.find((enemy) => enemy.alive && (enemy.type === 'hepaticCore' || enemy.type === 'parenchymalCore'))?.bossPhase ?? 0,
      },
    });
  }

  update(dt: number): void {
    const s = this.state;
    for (const p of s.particles) {
      p.life -= dt;
      if (!this.settings.reducedMotion) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    s.particles = s.particles.filter((p) => p.life > 0);
    if (s.particles.length > 260) s.particles.splice(0, s.particles.length - 260);

    this.shake = Math.max(0, this.shake - dt * 28);
    this.syncMusic(dt);

    if (s.phase !== 'playing') {
      return;
    }

    const killsBefore = s.stats.kills;
    const escBefore = s.stats.escapes;
    const subPhaseBefore = s.subPhase;

    if (s.subPhase === 'wave') {
      stepEnemies(s, dt, this.paths);
      stepTowers(s, dt);
      stepProjectiles(s, dt);
    }
    stepAbilities(s, dt);
    stepMeters(s, dt);
    stepWave(s, dt, this.paths);
    this.syncHepaticCue();
    this.syncCnsCue();
    if (subPhaseBefore === 'planning' && s.subPhase === 'wave') {
      if (s.onboarding.active) {
        s.onboarding.hint = 'monitorWave';
      }
      this.kinetic.pushEvent('waveStart', this.visualTime);
      this.music.trigger('waveStart');
    } else if (subPhaseBefore === 'wave' && s.subPhase === 'planning') {
      if (s.onboarding.active) {
        s.onboarding.hint = 'reinforce';
        this.buildType = null;
        this.cb.onNotice?.({ text: 'Wave cleared — construct another cell near a lane', level: 'info' });
      }
      this.kinetic.pushEvent('waveClear', this.visualTime);
      this.music.trigger('waveClear');
      this.sound.clear();
      this.cb.onNotice?.({ text: `Wave ${s.lastWaveReport?.wave ?? s.wave - 1} cleared`, level: 'info' });
    }

    if (s.stats.kills > killsBefore) this.sound.kill();
    if (s.stats.escapes > escBefore) {
      this.sound.hit();
      this.kinetic.pushEvent('leak', this.last / 1000);
    }

    const end = checkEnd(s);
    if (end === 'lost') {
      s.phase = 'lost';
      s.onboarding.active = false;
      s.onboarding.hint = null;
      this.sound.lose();
      this.music.trigger('loss');
      this.punch(12);
      this.commitScore();
    } else if (end === 'won') {
      s.phase = 'won';
      s.onboarding.active = false;
      s.onboarding.hint = null;
      this.sound.win();
      this.music.trigger('victory');
      this.punch(8);
      this.commitScore();
    }
  }

  private commitScore(): void {
    const { score, response } = computeScore(this.state);
    this.highScore = saveHighScore(score);
    const level = this.state.level;
    if (this.state.phase === 'won') this.progress.cleared[level] = true;
    const result = { score, response: response.id };
    if (isBetterResult(result, this.progress.best[level])) this.progress.best[level] = result;
    this.progress = saveProgress(this.progress);
  }

  score(): ScoreResult {
    return computeScore(this.state);
  }

  get introScene(): number {
    const time = this.hasEnteredMenu ? Math.max(0, this.visualTime - this.introStartedAt) : 0;
    return introTimeline(time).scene;
  }

  loseReason(): string {
    const m = this.state.meters;
    if (this.state.bossEscaped) return 'The hepatic plasmacytoma core escaped containment.';
    if (m.crs >= 100) return 'Severe CRS — a cytokine storm took the T cells down.';
    if (m.neuro >= 100) return 'Irreversible neurotoxicity silenced the nervous system.';
    if (m.hyperinflammation >= 100) return 'IEC-HS hyperinflammation progressed to critical organ stress.';
    if (m.fitness <= 0) return 'The patient lost all fitness — the body gave up.';
    if (m.cnsBurden >= 100) return 'Malignant CNS disease burden reached the critical threshold.';
    if (this.state.level === 'cns') return 'The neuroaxis was overrun.';
    return this.state.level === 'liver' ? 'The liver was overrun.' : 'The marrow was overrun.';
  }

  // ---- Public input API (called by the UI) ----

  enterMenu(): void {
    if (this.hasEnteredMenu || this.state.phase !== 'menu') return;
    this.hasEnteredMenu = true;
    this.introStartedAt = this.visualTime;
    this.music.restartMenu();
    this.music.unlock();
    this.sound.ensure();

    if (!this.settings.reducedMotion) {
      const intro = introTimeline(0);
      this.lastIntroCueId = intro.audioCueId;
      this.music.trigger(intro.audioCue);
    } else {
      this.lastIntroCueId = null;
    }
  }

  begin(level: LevelId = 'marrow', forceTutorial = false): void {
    this.paths = buildPaths(level);
    this.state = createInitialState(level, 1337);
    startGame(this.state, forceTutorial || !this.settings.tutorialSeen);
    this.selectedTower = null;
    this.buildType = null;
    this.cursor = null;
    this.heat = 0;
    this.lastEscapes = 0;
    this.crsWarned = false;
    this.neuroWarned = false;
    this.iecHsWasActive = false;
    this.lastHepaticCueSerial = 0;
    this.lastCnsCueSerial = 0;
    this.music.startLevel(level);
    this.music.unlock();
    this.sound.ensure();
    this.sound.wave();
  }

  toMenu(): void {
    this.paths = buildPaths('marrow');
    this.state = createInitialState('marrow', 1337);
    this.state.onboarding.active = false;
    this.state.onboarding.hint = null;
    this.selectedTower = null;
    this.buildType = null;
    this.cursor = null;
    this.heat = 0;
    this.lastEscapes = 0;
    this.iecHsWasActive = false;
    this.lastHepaticCueSerial = 0;
    this.lastCnsCueSerial = 0;
    this.introStartedAt = this.visualTime;
    this.lastIntroCueId = null;
    this.music.restartMenu();
  }

  cycleSpeed(): void {
    this.setSettings({ speed: this.settings.speed >= 3 ? 1 : this.settings.speed + 1 });
  }

  togglePause(): void {
    if (this.state.phase === 'playing') this.state.phase = 'paused';
    else if (this.state.phase === 'paused') this.state.phase = 'playing';
  }

  tryPlace(x: number, y: number, type: UnitTypeId): PlacementResult {
    const s = this.state;
    if (s.phase !== 'playing') return { ok: false, reason: 'bounds' };
    const guidedConstruction = s.onboarding.active
      && (s.onboarding.hint === 'placeUnit' || s.onboarding.hint === 'reinforce');
    const invalid = guidedConstruction
      ? guidedPlacementFailure(this.paths, s.towers, type, x, y)
      : placementFailure(this.paths, s.towers, x, y);
    if (invalid) return { ok: false, reason: invalid };
    const def = UNIT[type];
    if (s.currency < def.cost) return { ok: false, reason: 'funding' };
    s.currency -= def.cost;
    const t: Tower = {
      id: s.nextId++,
      type,
      x,
      y,
      tier: 0,
      cd: 0,
      targetId: null,
      strength: type === 'memory' ? 1 : 0,
      wavesSurvived: 0,
      buffPower: 0,
    };
    s.towers.push(t);
    if (s.onboarding.active && s.onboarding.hint === 'placeUnit') {
      s.onboarding.hint = 'startWave';
    } else if (s.onboarding.active && s.onboarding.hint === 'reinforce') {
      s.onboarding.active = false;
      s.onboarding.hint = null;
      this.markTutorialSeen();
      this.cb.onNotice?.({ text: 'Guided run complete — wave 2 is ready', level: 'info' });
    }
    this.sound.place();
    this.punch(3);
    return { ok: true, tower: t };
  }

  selectTower(id: number): void {
    if (this.buildType) return;
    this.selectedTower = id;
  }

  clearSelection(): void {
    this.selectedTower = null;
    this.buildType = null;
  }

  setBuildType(type: UnitTypeId | null): void {
    this.buildType = type;
    if (type) this.selectedTower = null;
    if (type && this.state.onboarding.active && this.state.onboarding.hint === 'chooseUnit') {
      this.state.onboarding.hint = 'placeUnit';
    }
  }

  upgradeSelected(): void {
    const s = this.state;
    const t = s.towers.find((tw) => tw.id === this.selectedTower);
    if (!t || t.tier === 2) return;
    const cost = UNIT[t.type].upgrades[t.tier].cost;
    if (s.currency < cost) return;
    s.currency -= cost;
    t.tier = (t.tier + 1) as 0 | 1 | 2;
    if (t.type === 'memory') t.strength += 0.5;
    this.sound.place();
  }

  useAbility(id: AbilityId): void {
    if (canActivate(this.state, id)) {
      activate(this.state, id);
      this.sound.ability(id);
      this.music.trigger(id);
      this.kinetic.pushEvent(id, this.visualTime);
      this.cb.onNotice?.({ text: `${ABILITY[id].name} activated`, level: 'info' });
    }
  }

  startWaveNow(): void {
    const s = this.state;
    if (s.phase !== 'playing' || s.subPhase !== 'planning' || s.wave > s.wavesTotal)
      return;
    if (s.onboarding.active && s.onboarding.hint !== 'startWave') return;
    startWave(s);
    if (s.onboarding.active) {
      s.onboarding.hint = 'monitorWave';
    }
    this.kinetic.pushEvent('waveStart', this.visualTime);
    this.punch(5);
    this.sound.wave();
    this.music.trigger('waveStart');
  }

  containCnsBreach(eventId: number): boolean {
    const contained = containCnsBreach(this.state, eventId);
    if (!contained) return false;
    this.sound.place();
    this.music.trigger('warning');
    this.kinetic.pushEvent('containment', this.visualTime);
    this.cb.onNotice?.({ text: 'Interface contained — breach delayed and reduced', level: 'info' });
    return true;
  }

  setCursor(x: number, y: number, on: boolean): void {
    this.cursor = on ? { x, y } : null;
  }

  punch(n: number): void {
    this.shake = Math.max(this.shake, n);
  }

  private syncHepaticCue(): void {
    const cue = this.state.hepaticCue;
    if (!cue || cue.serial === this.lastHepaticCueSerial) return;
    this.lastHepaticCueSerial = cue.serial;
    const musicPan = this.state.level === 'liver' ? [-0.6, 0, 0.6][cue.lane] ?? 0 : 0;
    this.music.trigger(cue.kind, { pan: musicPan });
    this.sound.hepatic(cue.kind);
    this.kinetic.pushEvent(cue.kind, this.visualTime);
    const lane = this.state.level === 'liver' ? ['PORTAL VEIN', 'HEPATIC ARTERY', 'BILIARY BRANCH'][cue.lane] : '';
    if (cue.kind === 'flareWarn') this.cb.onNotice?.({ text: `PLASMA-CELL SURGE — ${lane}`, level: 'critical' });
    const impacts = cue.kind === 'flareImpact' || cue.kind === 'bossPhase2' || cue.kind === 'bossPhase3' || cue.kind === 'shieldBreak';
    if (impacts) this.punch(cue.kind === 'bossPhase3' ? 11 : 7);
  }

  private syncCnsCue(): void {
    const cue = this.state.cnsCue;
    if (!cue || cue.serial === this.lastCnsCueSerial) return;
    this.lastCnsCueSerial = cue.serial;
    const pan = [-0.55, 0, 0.55][cue.lane] ?? 0;
    if (cue.kind === 'breachWarn') this.music.trigger('warning', { pan });
    else if (cue.kind === 'breachImpact') this.music.trigger('waveStart', { pan });
    else if (cue.kind === 'corePhase2') this.music.trigger('bossPhase2', { pan });
    else if (cue.kind === 'corePhase3') this.music.trigger('bossPhase3', { pan });
    else this.music.trigger('waveClear', { pan });
    this.kinetic.pushEvent(cue.kind, this.visualTime);
    if (cue.kind === 'breachWarn') this.cb.onNotice?.({ text: 'CNS INTERFACE BREACH INCOMING', level: 'critical' });
    if (cue.kind === 'breachImpact' || cue.kind === 'corePhase2' || cue.kind === 'corePhase3') this.punch(cue.kind === 'corePhase3' ? 11 : 7);
  }

  private syncMusic(dt: number): void {
    const p = this.state.phase;
    const s = this.state;
    if (p === 'menu' && !this.hasEnteredMenu) return;
    if (p === 'menu' && !this.settings.reducedMotion) {
      const intro = introTimeline(Math.max(0, this.visualTime - this.introStartedAt));
      if (shouldTriggerIntroCue(this.lastIntroCueId, intro)) {
        this.lastIntroCueId = intro.audioCueId;
        this.music.trigger(intro.audioCue);
      }
    } else if (p !== 'menu') {
      this.lastIntroCueId = null;
    }
    if (s.iecHsActive && !this.iecHsWasActive) {
      this.music.trigger('iecHsOnset');
      this.kinetic.pushEvent('iecHsOnset', this.visualTime);
      this.cb.onNotice?.({ text: 'IEC-HS ACTIVE', level: 'critical' });
    }
    this.iecHsWasActive = s.iecHsActive;
    const dEsc = s.stats.escapes - this.lastEscapes;
    if (dEsc > 0 && p === 'playing') {
      this.heat = Math.min(1, this.heat + 0.35 * dEsc);
      this.music.trigger('leak');
    }
    this.lastEscapes = s.stats.escapes;
    this.heat = Math.max(0, this.heat - dt * 0.3);
    if (s.meters.crs >= 60 && !this.crsWarned) {
      this.crsWarned = true;
      this.music.trigger('warning');
      this.cb.onNotice?.({ text: 'CRS is entering the danger zone', level: 'warning' });
    } else if (s.meters.crs < 45) {
      this.crsWarned = false;
    }
    if (s.meters.neuro >= 60 && !this.neuroWarned) {
      this.neuroWarned = true;
      this.music.trigger('warning');
      this.cb.onNotice?.({ text: 'Neurotoxicity is entering the danger zone', level: 'warning' });
    } else if (s.meters.neuro < 45) {
      this.neuroWarned = false;
    }
    const waveT = (s.wave - 1) / Math.max(1, s.wavesTotal - 1);
    const bossPhase = s.enemies.find((enemy) => enemy.alive && (enemy.type === 'hepaticCore' || enemy.type === 'parenchymalCore'))?.bossPhase ?? 0;
    const hepaticPressure = s.activeHepaticEvent ? .18 : bossPhase ? bossPhase * .09 : 0;
    const battle = Math.min(1, 0.2 + 0.45 * waveT + 0.3 * (s.meters.crs / 100) + 0.3 * (s.meters.neuro / 100) + 0.25 * (s.meters.hematotoxicity / 100) + 0.45 * this.heat + 0.2 * (this.settings.speed - 1) + hepaticPressure);
    let scene: MusicScene;
    if (p === 'menu') scene = 'menu';
    else if (p === 'paused') scene = 'paused';
    else if (p === 'won') scene = 'victory';
    else if (p === 'lost') scene = 'loss';
    else if ((s.level === 'liver' || s.level === 'cns') && bossPhase > 0) scene = 'boss';
    else if (s.iecHsActive) scene = 'iecHs';
    else scene = s.subPhase === 'wave' ? 'wave' : 'planning';
    this.music.update({
      level: s.level,
      scene,
      wave: s.wave,
      intensity: p === 'menu' ? 0.5 : battle,
      crs: s.meters.crs,
      neuro: s.meters.neuro,
      hematotoxicity: s.meters.hematotoxicity,
      fitness: s.meters.fitness,
      leakHeat: this.heat,
      bossPhase,
      hepaticEventPressure: s.activeHepaticEvent?.stage === 'impact' ? 1 : s.activeHepaticEvent ? .6 : 0,
    });
  }

  private markTutorialSeen(): void {
    if (!this.settings.tutorialSeen) this.setSettings({ tutorialSeen: true });
  }

  setSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.sound.applySettings(this.settings);
    this.music.applySettings(this.settings);
    document.documentElement.classList.toggle('reduce-motion', this.settings.reducedMotion);
  }

  previewLevel(level: LevelId): void {
    this.music.previewLevel(level);
  }
}
