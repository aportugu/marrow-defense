// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from './GameState';
import { Game } from './Game';
import type { Settings } from '../lib/storage';

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
    },
    sound: { ensure: vi.fn(), wave: vi.fn() },
    kinetic: { pushEvent: vi.fn() },
    shake: 0,
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
});
