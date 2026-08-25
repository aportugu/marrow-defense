// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../game/Game';
import type { Tower } from '../game/types';
import { createInitialState, startGame } from '../game/GameState';
import { UI } from './UI';

function setup() {
  document.body.innerHTML = '<main id="app"></main>';
  const state = createInitialState(4);
  startGame(state, false);
  const game = {
    canvas: document.createElement('canvas'),
    state,
    cb: {},
    hasEnteredMenu: true,
    settings: { sound: true, music: true, musicVolume: 0.6, sfxVolume: 0.6, speed: 1, reducedMotion: false, tutorialSeen: true },
    highScore: 0,
    buildType: null,
    selectedTower: null,
    setBuildType: vi.fn(),
    useAbility: vi.fn(),
    togglePause: vi.fn(),
    cycleSpeed: vi.fn(),
    startWaveNow: vi.fn(),
    setCursor: vi.fn(),
    tryPlace: vi.fn(() => ({ ok: false, reason: 'path' })),
    selectTower: vi.fn(),
    clearSelection: vi.fn(),
    upgradeSelected: vi.fn(),
    begin: vi.fn(),
    enterMenu: vi.fn(),
    toMenu: vi.fn(),
    setSettings: vi.fn(),
    loseReason: vi.fn(() => 'lost'),
  } as unknown as Game;
  new UI(game, document.getElementById('app')!);
  game.cb.onSync?.(state);
  return { game, state };
}

describe('UI', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders five accessible abilities and handles build/ability shortcuts', () => {
    const { game } = setup();
    expect(document.querySelectorAll('.ability')).toHaveLength(5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
    expect(game.setBuildType).toHaveBeenCalledWith('bcma');
    expect(game.useAbility).toHaveBeenCalledWith('anakinra');
    expect(game.useAbility).toHaveBeenCalledWith('gcsf');
  });

  it('refreshes computed tower statistics after an upgrade', () => {
    const { game, state } = setup();
    const tower: Tower = {
      id: 9, type: 'dual', x: 400, y: 300, tier: 0, cd: 0,
      targetId: null, strength: 0, wavesSurvived: 0, buffPower: 0,
    };
    state.towers = [tower];
    game.selectedTower = tower.id;
    game.cb.onSync?.(state);
    expect(document.querySelector('.p-title')?.textContent).toContain('TIER 1');
    tower.tier = 1;
    game.cb.onSync?.(state);
    expect(document.querySelector('.p-title')?.textContent).toContain('TIER 2');
    expect(document.querySelector('.popup')?.textContent).toContain('142');
  });

  it('exposes a persisted reduced-motion control in settings', () => {
    const { game, state } = setup();
    game.state.phase = 'menu';
    state.phase = 'menu';
    game.cb.onSync?.(state);
    const settings = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Settings');
    settings?.click();
    game.cb.onSync?.(state);
    const row = [...document.querySelectorAll('label')].find((label) => label.textContent?.includes('Reduced motion'));
    const checkbox = row?.querySelector('input');
    expect(checkbox).toBeTruthy();
    checkbox?.click();
    expect(game.setSettings).toHaveBeenCalledWith({ reducedMotion: true });
  });

  it('presents the start menu over an accessible decorative cutscene', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const { game, state } = setup();
    state.phase = 'menu';
    game.cb.onSync?.(state);
    expect(document.querySelector('.menu')?.classList.contains('menu-start')).toBe(true);
    expect(document.querySelector('.start-card')?.getAttribute('aria-describedby')).toBe('intro-cutscene-description');
    expect(document.querySelector('#intro-cutscene-description')?.textContent).toContain('leukapheresis');
    expect(game.canvas.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement?.textContent).toBe('Start run');
  });

  it('requires an accessible entry click before revealing the main menu', () => {
    const { game, state } = setup();
    game.hasEnteredMenu = false;
    state.phase = 'menu';
    game.cb.onSync?.(state);

    const enter = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Enter');
    expect(enter).toBeTruthy();
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Start run')).toBe(false);
    expect(document.querySelector('.entry-card')?.getAttribute('aria-describedby')).toBe('entry-cutscene-description');

    enter?.click();
    expect(game.enterMenu).toHaveBeenCalledOnce();

    game.hasEnteredMenu = true;
    game.cb.onSync?.(state);
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Start run')).toBe(true);
  });

  it('keeps the entry copy neutral when music is disabled', () => {
    const { game, state } = setup();
    game.hasEnteredMenu = false;
    game.settings.music = false;
    state.phase = 'menu';
    game.cb.onSync?.(state);
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Enter')).toBe(true);
    expect(document.body.textContent).not.toContain('Start Music');
  });

  it('exposes independent music and effects volume controls', () => {
    const { game, state } = setup();
    state.phase = 'menu';
    game.cb.onSync?.(state);
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Settings')?.click();
    game.cb.onSync?.(state);
    const music = document.querySelector<HTMLInputElement>('input[aria-label="Music volume"]')!;
    const effects = document.querySelector<HTMLInputElement>('input[aria-label="Effects volume"]')!;
    music.value = '0.25';
    music.dispatchEvent(new Event('input'));
    effects.value = '0.8';
    effects.dispatchEvent(new Event('input'));
    expect(game.setSettings).toHaveBeenCalledWith({ musicVolume: 0.25 });
    expect(game.setSettings).toHaveBeenCalledWith({ sfxVolume: 0.8 });
  });

  it('provides a keyboard-accessible cited glossary outside play', () => {
    const { game, state } = setup();
    state.phase = 'menu';
    game.cb.onSync?.(state);
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Clinical Glossary')?.click();
    game.cb.onSync?.(state);
    expect(document.querySelector('.education-disclaimer')?.textContent).toContain('Simplified simulation');
    expect(document.querySelectorAll('.references a').length).toBeGreaterThan(0);
    expect(document.querySelector('details summary')?.textContent).toBe('BCMA');
    expect(document.querySelector('.tutorial')).toBeNull();
  });

  it('shows the IEC-HS trend panel without invented lab values', () => {
    const { game, state } = setup();
    state.iecHsUnlocked = true;
    state.iecHsActive = true;
    state.meters.hyperinflammation = 58;
    state.hyperinflammationTrend = 0.7;
    game.cb.onSync?.(state);
    const panel = document.querySelector('.iec-panel')!;
    expect(panel.textContent).toContain('HYPERINFLAMMATION 58');
    expect(panel.textContent).toContain('IEC-HS ACTIVE');
    expect(panel.textContent).not.toContain('Ferritin');
  });

  it('uses non-blocking onboarding highlights', () => {
    const { game, state } = setup();
    state.onboarding = { active: true, hint: 'chooseUnit' };
    game.cb.onSync?.(state);
    expect(document.querySelector('.u-bcma')?.classList.contains('hint')).toBe(true);
    expect(document.querySelector('.menu:not(.hidden)')).toBeNull();
  });

  it('shows hematotoxicity direction, ICAHT pressure, and Stem-Cell recovery status', () => {
    const { game, state } = setup();
    state.currency = 300;
    state.meters.hematotoxicity = 55;
    game.cb.onSync?.(state);
    const meter = document.querySelector('.m-hematotoxicity')!;
    expect(meter.textContent).toContain('ICAHT pressure');
    expect(document.querySelector('.a-stemcell')?.classList.contains('hint')).toBe(true);
    state.stemCellRecoveryUntil = state.stats.time + 10;
    game.cb.onSync?.(state);
    expect(meter.textContent).toContain('Hematopoietic recovery');
  });

  it('highlights G-CSF for ICAHT pressure and shows its active status', () => {
    const { game, state } = setup();
    state.currency = 300;
    state.meters.hematotoxicity = 20;
    game.cb.onSync?.(state);
    expect(document.querySelector('.a-gcsf')?.classList.contains('hint')).toBe(true);
    state.gcsfUntil = state.stats.time + 6;
    game.cb.onSync?.(state);
    expect(document.querySelector('.m-hematotoxicity')?.textContent).toContain('G-CSF SUPPORT');
    expect(document.querySelector('.a-gcsf .a-state')?.textContent).toBe('support 6s');
  });

  it('shows the G-CSF hematotoxicity requirement while unavailable', () => {
    const { game, state } = setup();
    state.meters.hematotoxicity = 19;
    game.cb.onSync?.(state);
    expect(document.querySelector('.a-gcsf .a-state')?.textContent).toBe('HEM 20+');
  });
});
