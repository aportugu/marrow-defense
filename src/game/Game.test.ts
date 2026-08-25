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
    state: createInitialState(1337),
    settings,
    hasEnteredMenu: false,
    music: {
      restartMenu: vi.fn(),
      unlock: vi.fn(),
      trigger: vi.fn(),
    },
    sound: { ensure: vi.fn() },
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
});
