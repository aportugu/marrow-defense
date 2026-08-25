// Orchestrator: owns state, path, input, the rAF loop, sound and high score.
// Calls the pure systems each tick, then renders + syncs the UI.
import type {
  GameState,
  Vec,
  UnitTypeId,
  AbilityId,
  Tower,
  PlacementResult,
} from './types';
import { CANVAS_W, CANVAS_H } from './types';
import { ABILITY, UNIT } from './Balance';
import { createInitialState, startGame } from './GameState';
import { buildPath, placementFailure, type PathDef } from '../lib/path';
import { stepTowers, stepProjectiles, stepEnemies } from '../systems/CombatSystem';
import { stepWave, startWave } from '../systems/WaveSystem';
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
  type Settings,
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
  onNotice?: (message: string) => void;
}

export class Game {
  state: GameState;
  path: PathDef;
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

  constructor(canvas: HTMLCanvasElement | null = null, cb: GameCallbacks = {}) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.cb = cb;
    this.path = buildPath();
    this.state = createInitialState(1337);
    this.settings = loadSettings();
    this.sound.applySettings(this.settings);
    this.music.applySettings(this.settings);
    // Start immediately where autoplay is permitted. Browsers that suspend
    // WebAudio are resumed by the first pointer or keyboard interaction below.
    this.music.unlock();
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
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.unlockHomeAudio, { once: true });
      window.addEventListener('keydown', this.unlockHomeAudio, { once: true });
    }
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.unlockHomeAudio);
      window.removeEventListener('keydown', this.unlockHomeAudio);
    }
  }

  private unlockHomeAudio = (): void => {
    this.music.unlock();
    this.sound.ensure();
    window.removeEventListener('pointerdown', this.unlockHomeAudio);
    window.removeEventListener('keydown', this.unlockHomeAudio);
  };

  render(): void {
    const s = this.state;
    render(this.ctx, this.state, {
      cursor: this.cursor,
      selectedTower: this.selectedTower,
      buildType: this.buildType,
      path: this.path,
      shake: this.shake,
      time: this.visualTime,
      introTime: Math.max(0, this.visualTime - this.introStartedAt),
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

    this.shake = Math.max(0, this.shake - dt * 28);
    this.syncMusic(dt);

    if (s.phase !== 'playing') {
      return;
    }

    const killsBefore = s.stats.kills;
    const escBefore = s.stats.escapes;
    const subPhaseBefore = s.subPhase;

    if (s.subPhase === 'wave') {
      stepEnemies(s, dt, this.path);
      stepTowers(s, dt);
      stepProjectiles(s, dt);
    }
    stepAbilities(s, dt);
    stepMeters(s, dt);
    stepWave(s, dt, this.path);
    if (subPhaseBefore === 'planning' && s.subPhase === 'wave') {
      if (s.onboarding.active) {
        s.onboarding.active = false;
        s.onboarding.hint = null;
        this.markTutorialSeen();
      }
      this.kinetic.pushEvent('waveStart', this.visualTime);
      this.music.trigger('waveStart');
    } else if (subPhaseBefore === 'wave' && s.subPhase === 'planning') {
      this.kinetic.pushEvent('waveClear', this.visualTime);
      this.music.trigger('waveClear');
      this.sound.clear();
      this.cb.onNotice?.(`Wave ${s.lastWaveReport?.wave ?? s.wave - 1} cleared`);
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
    const { score } = computeScore(this.state);
    this.highScore = saveHighScore(score);
  }

  score(): ScoreResult {
    return computeScore(this.state);
  }

  get introScene(): number {
    return introTimeline(Math.max(0, this.visualTime - this.introStartedAt)).scene;
  }

  loseReason(): string {
    const m = this.state.meters;
    if (m.crs >= 100) return 'Severe CRS — a cytokine storm took the T cells down.';
    if (m.neuro >= 100) return 'Irreversible neurotoxicity silenced the nervous system.';
    if (m.hyperinflammation >= 100) return 'IEC-HS hyperinflammation progressed to critical organ stress.';
    if (m.fitness <= 0) return 'The patient lost all fitness — the body gave up.';
    return 'The marrow was overrun.';
  }

  // ---- Public input API (called by the UI) ----

  begin(forceTutorial = false): void {
    this.state = createInitialState(1337);
    startGame(this.state, forceTutorial || !this.settings.tutorialSeen);
    this.selectedTower = null;
    this.buildType = null;
    this.cursor = null;
    this.heat = 0;
    this.lastEscapes = 0;
    this.crsWarned = false;
    this.neuroWarned = false;
    this.iecHsWasActive = false;
    this.music.unlock();
    this.sound.ensure();
    this.sound.wave();
  }

  toMenu(): void {
    this.state = createInitialState(1337);
    this.state.onboarding.active = false;
    this.state.onboarding.hint = null;
    this.selectedTower = null;
    this.buildType = null;
    this.cursor = null;
    this.heat = 0;
    this.lastEscapes = 0;
    this.iecHsWasActive = false;
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
    const invalid = placementFailure(this.path, s.towers, x, y);
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
    if (s.onboarding.active && s.onboarding.hint === 'placeUnit') s.onboarding.hint = 'startWave';
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
      this.cb.onNotice?.(`${ABILITY[id].name} activated`);
    }
  }

  startWaveNow(): void {
    const s = this.state;
    if (s.phase !== 'playing' || s.subPhase !== 'planning' || s.wave > s.wavesTotal)
      return;
    startWave(s);
    if (s.onboarding.active) {
      s.onboarding.active = false;
      s.onboarding.hint = null;
      this.markTutorialSeen();
    }
    this.kinetic.pushEvent('waveStart', this.visualTime);
    this.punch(5);
    this.sound.wave();
    this.music.trigger('waveStart');
  }

  setCursor(x: number, y: number, on: boolean): void {
    this.cursor = on ? { x, y } : null;
  }

  punch(n: number): void {
    this.shake = Math.max(this.shake, n);
  }

  private syncMusic(dt: number): void {
    const p = this.state.phase;
    const s = this.state;
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
      this.cb.onNotice?.('IEC-HS ACTIVE');
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
      this.cb.onNotice?.('CRS is entering the danger zone');
    } else if (s.meters.crs < 45) {
      this.crsWarned = false;
    }
    if (s.meters.neuro >= 60 && !this.neuroWarned) {
      this.neuroWarned = true;
      this.music.trigger('warning');
      this.cb.onNotice?.('Neurotoxicity is entering the danger zone');
    } else if (s.meters.neuro < 45) {
      this.neuroWarned = false;
    }
    const waveT = (s.wave - 1) / Math.max(1, s.wavesTotal - 1);
    const battle = Math.min(1, 0.2 + 0.45 * waveT + 0.3 * (s.meters.crs / 100) + 0.3 * (s.meters.neuro / 100) + 0.25 * (s.meters.hematotoxicity / 100) + 0.45 * this.heat + 0.2 * (this.settings.speed - 1));
    let scene: MusicScene;
    if (p === 'menu') scene = 'menu';
    else if (p === 'paused') scene = 'paused';
    else if (p === 'won') scene = 'victory';
    else if (p === 'lost') scene = 'loss';
    else if (s.iecHsActive) scene = 'iecHs';
    else scene = s.subPhase === 'wave' ? 'wave' : 'planning';
    this.music.update({
      scene,
      wave: s.wave,
      intensity: p === 'menu' ? 0.5 : battle,
      crs: s.meters.crs,
      neuro: s.meters.neuro,
      hematotoxicity: s.meters.hematotoxicity,
      fitness: s.meters.fitness,
      leakHeat: this.heat,
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
}
