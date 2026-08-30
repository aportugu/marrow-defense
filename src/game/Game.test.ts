// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from './GameState';
import { Game } from './Game';
import { distToLanePaths, guidedPlacementFailure, placementFailure } from '../lib/path';
import type { Settings } from '../lib/storage';

function guidedSpot(game: Game, type: 'bcma' | 'dual' | 'memory', far = false): { x: number; y: number } {
  for (let y = 40; y <= 680; y += 10) for (let x = 40; x <= 1240; x += 10) {
    if (placementFailure(game.paths, game.state.towers, x, y)) continue;
    const tooFar = guidedPlacementFailure(game.paths, game.state.towers, type, x, y) === 'lane';
    if (tooFar === far) return { x, y };
  }
  throw new Error(`No ${far ? 'far' : 'near'} placement found`);
}

function entryGame(reducedMotion = false): Game {
  const game = Object.create(Game.prototype) as Game;
  const settings: Settings = {
    sound: true,
    music: true,
    musicVolume: 0.6,
    sfxVolume: 0.6,
    speed: 3,
    reducedMotion,
    tutorialSeen: false,
  };
  Object.assign(game, {
    state: createInitialState('marrow', 1337),
    settings,
    hasEnteredMenu: false,
    music: {
      restartMenu: vi.fn(),
      unlock: vi.fn(),
      trigger: vi.fn(),
      previewLevel: vi.fn(),
      startLevel: vi.fn(),
      update: vi.fn(),
      applySettings: vi.fn(),
    },
    sound: { ensure: vi.fn(), wave: vi.fn(), place: vi.fn(), clear: vi.fn(), kill: vi.fn(), hit: vi.fn(), applySettings: vi.fn() },
    kinetic: { pushEvent: vi.fn() },
    cb: { onNotice: vi.fn() },
    shake: 0,
    heat: 0,
    lastEscapes: 0,
    crsWarned: false,
    neuroWarned: false,
    iecHsWasActive: false,
    lastHepaticCueSerial: 0,
    progress: { cleared: { marrow: false, liver: false }, best: { marrow: null, liver: null } },
    visualTime: 23,
    introStartedAt: 0,
    lastIntroCueId: null,
  });
  return game;
}

describe('menu entry gate', () => {
  it('starts audio and resets the cutscene exactly once', () => {
    const game = entryGame();
    const music = game.music;
    const sound = game.sound;

    game.enterMenu();
    game.enterMenu();

    expect(game.hasEnteredMenu).toBe(true);
    expect(game.introScene).toBe(0);
    expect(music.restartMenu).toHaveBeenCalledOnce();
    expect(music.unlock).toHaveBeenCalledOnce();
    expect(music.trigger).toHaveBeenCalledWith('introCollection');
    expect(sound.ensure).toHaveBeenCalledOnce();
  });

  it('respects reduced motion by omitting the cinematic cue', () => {
    const game = entryGame(true);
    game.enterMenu();
    expect(game.music.unlock).toHaveBeenCalledOnce();
    expect(game.music.trigger).not.toHaveBeenCalled();
  });

  it('allows starting hepatic before marrow is cleared', () => {
    const game = entryGame();
    game.begin('liver');
    expect(game.state.level).toBe('liver');
    expect(game.state.currency).toBe(220);
    expect(game.music.startLevel).toHaveBeenCalledWith('liver');
  });

  it('keeps guided onboarding active through the first wave', () => {
    const game = entryGame();
    game.begin('marrow', true);
    expect(game.state.onboarding).toEqual({ active: true, hint: 'chooseUnit' });

    game.setBuildType('bcma');
    expect(game.state.onboarding.hint).toBe('placeUnit');
    game.state.onboarding.hint = 'startWave';
    game.startWaveNow();

    expect(game.state.subPhase).toBe('wave');
    expect(game.state.onboarding).toEqual({ active: true, hint: 'monitorWave' });
    expect(game.settings.tutorialSeen).toBe(false);
  });

  it('requires useful initial placement and a second cell before wave 2', () => {
    const game = entryGame();
    game.begin('marrow', true);
    const initialCountdown = game.state.countdown;

    game.update(2);
    expect(game.state.countdown).toBe(initialCountdown);
    game.startWaveNow();
    expect(game.state.subPhase).toBe('planning');

    game.setBuildType('bcma');
    const farInitial = guidedSpot(game, 'bcma', true);
    expect(distToLanePaths(game.paths, farInitial.x, farInitial.y)).toBeGreaterThan(104);
    expect(game.tryPlace(farInitial.x, farInitial.y, 'bcma')).toEqual({ ok: false, reason: 'lane' });
    const initial = guidedSpot(game, 'bcma');
    expect(game.tryPlace(initial.x, initial.y, 'bcma').ok).toBe(true);
    expect(game.state.onboarding.hint).toBe('startWave');

    game.startWaveNow();
    expect(game.state.subPhase).toBe('wave');
    game.state.waveSpawnQueue = [];
    game.state.enemies = [{
      id: 99, type: 'standard', lane: 0, x: 0, y: 0, pathPos: 0,
      hp: 0, maxHp: 10, speed: 0, baseSpeed: 0, reward: 0, alive: false,
    }];
    game.update(0.01);

    expect(game.state.wave).toBe(2);
    expect(game.state.onboarding).toEqual({ active: true, hint: 'reinforce' });
    const heldCountdown = game.state.countdown;
    game.update(2);
    expect(game.state.countdown).toBe(heldCountdown);
    game.startWaveNow();
    expect(game.state.subPhase).toBe('planning');

    const farReinforcement = guidedSpot(game, 'memory', true);
    expect(game.tryPlace(farReinforcement.x, farReinforcement.y, 'memory')).toEqual({ ok: false, reason: 'lane' });
    const reinforcement = guidedSpot(game, 'memory');
    expect(game.tryPlace(reinforcement.x, reinforcement.y, 'memory').ok).toBe(true);
    expect(game.state.onboarding).toEqual({ active: false, hint: null });
    expect(game.settings.tutorialSeen).toBe(true);

    game.update(1);
    expect(game.state.countdown).toBeLessThan(heldCountdown);
  });

  it('leaves legal off-lane placement available outside guided play', () => {
    const game = entryGame();
    game.begin('marrow', false);
    const far = guidedSpot(game, 'bcma', true);
    expect(game.tryPlace(far.x, far.y, 'bcma').ok).toBe(true);
  });
});
