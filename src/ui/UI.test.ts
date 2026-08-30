// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Game } from '../game/Game';
import type { Tower } from '../game/types';
import { createInitialState, startGame } from '../game/GameState';
import { UI } from './UI';

function setup() {
  document.body.innerHTML = '<main id="app"></main>';
  const state = createInitialState('marrow', 4);
  startGame(state, false);
  const game = {
    canvas: document.createElement('canvas'),
    state,
    cb: {},
    hasEnteredMenu: true,
    settings: { sound: true, music: true, musicVolume: 0.6, sfxVolume: 0.6, speed: 1, reducedMotion: false, tutorialSeen: true },
    highScore: 0,
    progress: { cleared: { marrow: false, liver: false }, best: { marrow: null, liver: null } },
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
    previewLevel: vi.fn(),
    loseReason: vi.fn(() => 'lost'),
  } as unknown as Game;
  new UI(game, document.getElementById('app')!);
  game.cb.onSync?.(state);
  return { game, state };
}

describe('UI', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders five accessible abilities and handles build/ability shortcuts', () => {
    const { game } = setup();
    expect(document.querySelectorAll('.ability')).toHaveLength(5);
    expect([...document.querySelectorAll('.ability .a-name')].map((node) => node.textContent)).toEqual([
      '1 · Tocilizumab',
      '2 · Dexamethasone',
      '3 · Anakinra',
      '4 · G-CSF',
      '5 · Stem-Cell Boost',
    ]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
    expect(game.setBuildType).toHaveBeenCalledWith('bcma');
    expect(game.useAbility).toHaveBeenCalledWith('anakinra');
    expect(game.useAbility).toHaveBeenCalledWith('gcsf');
    expect(game.useAbility).toHaveBeenCalledWith('stemcell');
  });

  it('maps pointer taps to canvas coordinates for touch placement', () => {
    const { game } = setup();
    game.buildType = 'bcma';
    vi.spyOn(game.canvas, 'getBoundingClientRect').mockReturnValue({
      x: 10, y: 20, left: 10, top: 20, right: 650, bottom: 380,
      width: 640, height: 360, toJSON: () => ({}),
    });
    game.canvas.dispatchEvent(new MouseEvent('pointerup', {
      bubbles: true,
      clientX: 330,
      clientY: 200,
    }));
    expect(game.tryPlace).toHaveBeenCalledWith(640, 360, 'bcma');
  });

  it('selects a tower with a pointer tap', () => {
    const { game, state } = setup();
    state.towers = [{
      id: 8, type: 'memory', x: 640, y: 360, tier: 0, cd: 0,
      targetId: null, strength: 1, wavesSurvived: 0, buffPower: 0,
    }];
    vi.spyOn(game.canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 360,
      width: 640, height: 360, toJSON: () => ({}),
    });
    game.canvas.dispatchEvent(new MouseEvent('pointerup', {
      bubbles: true,
      clientX: 320,
      clientY: 180,
    }));
    expect(game.selectTower).toHaveBeenCalledWith(8);
  });

  it('pauses active play behind the portrait rotation guard', () => {
    const listeners: Array<() => void> = [];
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(orientation: portrait) and (max-width: 500px)',
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const { game } = setup();
    expect(game.togglePause).toHaveBeenCalledOnce();
    expect(document.querySelector('.rotate-overlay')?.getAttribute('aria-hidden')).toBe('false');
    expect(listeners).toHaveLength(1);
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
    expect(document.querySelector('.popup')?.classList.contains('tower-sheet')).toBe(true);
    expect(document.querySelector('.popup .p-unit')).toBeTruthy();
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
    expect(document.querySelector('.screen')?.classList.contains('opening-menu')).toBe(true);
    expect(document.activeElement?.classList.contains('level-card')).toBe(true);
    expect([...document.querySelectorAll('.level-card')].map((n) => n.classList.contains('selected'))).toEqual([true, false]);
    expect([...document.querySelectorAll('.level-card')].map((n) => n.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(document.querySelector('.menu-kicker')?.textContent).toBe('CHOOSE YOUR BATTLEFIELD');
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Start Marrow')).toBe(true);
    expect([...document.querySelectorAll<HTMLButtonElement>('.menu-actions [data-mobile-label]')]
      .map((button) => button.dataset.mobileLabel)).toEqual(['Tutorial', 'Glossary', 'Settings']);
  });

  it('explains the game and treatment matching in a four-page tutorial', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const { game, state } = setup();
    state.phase = 'menu';
    game.cb.onSync?.(state);
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Tutorial')?.click();
    game.cb.onSync?.(state);

    const card = document.querySelector('.tutorial-card')!;
    expect(card.textContent).toContain('Mission and game loop');
    expect(card.textContent).toContain('Defend the patient through 10 waves');
    expect(document.activeElement).toBe(card);

    const pageText = [card.textContent ?? ''];
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Next')?.click();
    game.cb.onSync?.(state);
    expect(document.querySelector('.tutorial-card h1')?.textContent).toBe('Build your CAR-T defense');
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Previous')?.click();
    game.cb.onSync?.(state);
    expect(document.querySelector('.tutorial-card h1')?.textContent).toBe('Mission and game loop');

    for (const title of ['Build your CAR-T defense', 'Match toxicity to treatment', 'Read the battlefield']) {
      [...document.querySelectorAll('button')].find((button) => button.textContent === 'Next')?.click();
      game.cb.onSync?.(state);
      expect(document.querySelector('.tutorial-card h1')?.textContent).toBe(title);
      pageText.push(document.querySelector('.tutorial-card')?.textContent ?? '');
    }

    const tutorial = document.querySelector('.tutorial-card')!;
    const completeTutorial = pageText.join(' ');
    expect(completeTutorial).toContain('Tocilizumab → CRS');
    expect(completeTutorial).toContain('Dexamethasone → Neurotoxicity');
    expect(completeTutorial).toContain('Anakinra → IEC-HS');
    expect(completeTutorial).toContain('G-CSF → Hematotoxicity');
    expect(completeTutorial).toContain('Stem-Cell Boost → Major recovery');
    expect(tutorial.textContent).toContain('not medical advice');
    expect(tutorial.textContent).toContain('CRS, neurotoxicity, or IEC-HS reaching 100');
    expect(document.querySelector('.tutorial-progress')?.getAttribute('aria-label')).toBe('Tutorial page 4 of 4');
  });

  it('starts the selected level as a guided run from the tutorial', () => {
    const { game, state } = setup();
    state.phase = 'menu';
    game.cb.onSync?.(state);
    const liver = [...document.querySelectorAll<HTMLButtonElement>('.level-card')].find((button) => button.textContent?.startsWith('Hepatic'))!;
    liver.click();
    game.cb.onSync?.(state);
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Tutorial')?.click();
    game.cb.onSync?.(state);
    for (let page = 1; page < 4; page += 1) {
      [...document.querySelectorAll('button')].find((button) => button.textContent === 'Next')?.click();
      game.cb.onSync?.(state);
    }
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Start Guided Hepatic Run')?.click();
    expect(game.begin).toHaveBeenCalledWith('liver', true);
  });

  it('returns from the pause tutorial without restarting or resuming', () => {
    const { game, state } = setup();
    state.phase = 'paused';
    game.cb.onSync?.(state);
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Tutorial')?.click();
    game.cb.onSync?.(state);
    expect(document.querySelector('.tutorial-card')).toBeTruthy();
    [...document.querySelectorAll('button')].find((button) => button.textContent === 'Back to paused game')?.click();
    game.cb.onSync?.(state);
    expect(document.querySelector('.menu-card h1')?.textContent).toBe('PAUSED');
    expect(game.begin).not.toHaveBeenCalled();
    expect(game.togglePause).not.toHaveBeenCalled();
  });

  it('restores the gameplay layout after leaving the opening menu', () => {
    const { game, state } = setup();
    state.phase = 'menu';
    game.cb.onSync?.(state);
    expect(document.querySelector('.screen')?.classList.contains('opening-menu')).toBe(true);
    state.phase = 'playing';
    game.cb.onSync?.(state);
    expect(document.querySelector('.screen')?.classList.contains('opening-menu')).toBe(false);
  });

  it('requires an accessible entry click before revealing the main menu', () => {
    const { game, state } = setup();
    game.hasEnteredMenu = false;
    state.phase = 'menu';
    game.cb.onSync?.(state);

    const enter = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Enter');
    expect(enter).toBeTruthy();
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Start Marrow')).toBe(false);
    expect(document.querySelector('.entry-card')?.getAttribute('aria-describedby')).toBe('entry-cutscene-description');

    enter?.click();
    expect(game.enterMenu).toHaveBeenCalledOnce();

    game.hasEnteredMenu = true;
    game.cb.onSync?.(state);
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'Start Marrow')).toBe(true);
  });

  it('selects a level from the start menu and starts that level', () => {
    const { game, state } = setup();
    game.progress.cleared.marrow = true;
    game.progress.best.liver = { score: 684, response: 'VGPR' };
    state.phase = 'menu';
    game.cb.onSync?.(state);
    const marrowCard = [...document.querySelectorAll<HTMLButtonElement>('.level-card')].find((n) => n.textContent?.startsWith('Marrow'))!;
    marrowCard.click();
    game.cb.onSync?.(state);
    const liverCard = [...document.querySelectorAll<HTMLButtonElement>('.level-card')].find((n) => n.textContent?.startsWith('Hepatic'))!;
    expect(liverCard.disabled).toBe(false);
    expect(liverCard.textContent).toContain('Best: VGPR · 684 pts');
    liverCard.click();
    game.cb.onSync?.(state);
    const start = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Start Hepatic — Advanced');
    expect(start).toBeTruthy();
    start?.click();
    expect(game.begin).toHaveBeenCalledWith('liver');
  });

  it('offers hepatic immediately and clearly marks it as advanced', () => {
    const { game, state } = setup();
    game.progress.cleared.marrow = false;
    state.phase = 'menu';
    game.cb.onSync?.(state);
    const liverCard = [...document.querySelectorAll<HTMLButtonElement>('.level-card')].find((n) => n.textContent?.startsWith('Hepatic'))!;
    expect(liverCard.disabled).toBe(false);
    expect(liverCard.textContent).toContain('ADVANCED');
    expect(liverCard.textContent).toContain('3 CONVERGING LANES');
    expect(liverCard.textContent).toContain('Recommended after Marrow');
    liverCard.click();
    expect(game.previewLevel).toHaveBeenCalledWith('liver');
  });

  it('briefs the hepatic lane identities and updates the battlefield description', () => {
    const { game, state } = setup();
    state.level = 'liver';
    state.phase = 'playing';
    state.subPhase = 'planning';
    state.wave = 1;
    game.cb.onSync?.(state);
    expect(document.querySelector('.hepatic-briefing')?.textContent).toContain('PORTAL VEIN');
    expect(document.querySelector('.hepatic-briefing')?.textContent).toContain('BILIARY BRANCH');
    expect(game.canvas.getAttribute('aria-label')).toContain('hepatic plasmacytoma');
  });

  it('shows a timed anatomical warning for an active hepatic surge', () => {
    const { game, state } = setup();
    state.level = 'liver';
    state.subPhase = 'wave';
    state.activeHepaticEvent = { id: 401, kind: 'surge', lane: 1, stage: 'warning', remaining: 2.4 };
    game.cb.onSync?.(state);
    const warning = document.querySelector('.hepatic-event');
    expect(warning?.textContent).toContain('PLASMA-CELL SURGE — HEPATIC ARTERY');
    expect(warning?.textContent).toContain('IMPACT IN 3s');
    expect(warning?.textContent).not.toMatch(/VOLUME|SPEED|RESISTANCE/);
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
    expect(document.body.textContent).toContain('IMWG response categories');
    expect(document.querySelector('.tutorial')).toBeNull();
  });

  it('shows the simulated response, full name, score, and disclaimer after a win', () => {
    const { game, state } = setup();
    state.phase = 'won';
    state.meters = { burden: 0, crs: 0, neuro: 0, fitness: 100, hematotoxicity: 0, hyperinflammation: 0 };
    state.stats.peakCrs = 0;
    state.stats.peakNeuro = 0;
    state.stats.peakHematotoxicity = 0;
    state.stats.lowestFitness = 100;
    state.stats.kills = 999;
    state.stats.time = 100;
    state.currency = 400;
    game.cb.onSync?.(state);
    expect(document.querySelector('.response-badge')?.textContent).toBe('sCR');
    expect(document.querySelector('.response-name')?.textContent).toBe('Stringent complete response');
    expect(document.querySelector('.score-big')?.textContent).toContain('pts');
    expect(document.querySelector('.response-disclaimer')?.textContent).toContain('not an actual clinical IMWG assessment');
    expect(document.querySelector('.grade')).toBeNull();
  });

  it('shows PD on the defeat screen when the hepatic core escapes', () => {
    const { game, state } = setup();
    state.level = 'liver';
    state.phase = 'lost';
    state.bossEscaped = true;
    game.cb.onSync?.(state);
    expect(document.querySelector('.response-badge')?.textContent).toBe('PD');
    expect(document.querySelector('.response-name')?.textContent).toBe('Progressive disease');
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

  it('provides four contextual guided-run steps and treatment highlights', () => {
    const { game, state } = setup();
    state.onboarding = { active: true, hint: 'chooseUnit' };
    game.cb.onSync?.(state);
    expect(document.querySelector('.guided-hint')?.textContent).toContain('1/4 · CHOOSE A UNIT');

    state.onboarding.hint = 'placeUnit';
    game.cb.onSync?.(state);
    expect(document.querySelector('.guided-hint')?.textContent).toContain('2/4 · PLACE IT');

    state.onboarding.hint = 'startWave';
    game.cb.onSync?.(state);
    expect(document.querySelector('.guided-hint')?.textContent).toContain('3/4 · START THE WAVE');

    state.subPhase = 'wave';
    state.onboarding.hint = 'monitorWave';
    state.meters.crs = 10;
    state.meters.neuro = 8;
    game.cb.onSync?.(state);
    expect(document.querySelector('.guided-hint')?.textContent).toContain('4/4 · MONITOR AND TREAT');
    expect(document.querySelector('.guided-hint')?.textContent).toContain('Tocilizumab for CRS');
    expect(document.querySelector('.guided-hint')?.textContent).toContain('Dexamethasone for neurotoxicity');
    expect(document.querySelector('.a-toci')?.classList.contains('hint')).toBe(true);
    expect(document.querySelector('.a-dexa')?.classList.contains('hint')).toBe(true);
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

  it('renders a notice as a click-through status toast with a read-tier class', () => {
    const { game, state } = setup();
    game.cb.onNotice?.({ text: 'IEC-HS ACTIVE', level: 'critical' });
    game.cb.onSync?.(state);
    const notice = document.querySelector('.notice')!;
    expect(notice.textContent).toBe('IEC-HS ACTIVE');
    expect(notice.classList.contains('hidden')).toBe(false);
    expect(notice.classList.contains('level-critical')).toBe(true);
  });

  it('lets a critical alert preempt a routine info notice', () => {
    const { game, state } = setup();
    game.cb.onNotice?.({ text: 'G-CSF is ready', level: 'info' });
    game.cb.onSync?.(state);
    expect(document.querySelector('.notice')?.textContent).toBe('G-CSF is ready');
    game.cb.onNotice?.({ text: 'PLASMA-CELL SURGE — PORTAL VEIN', level: 'critical' });
    game.cb.onSync?.(state);
    const notice = document.querySelector('.notice')!;
    expect(notice.textContent).toBe('PLASMA-CELL SURGE — PORTAL VEIN');
    expect(notice.classList.contains('level-critical')).toBe(true);
  });

  it('does not let a routine info notice replace a warning already on screen', () => {
    const { game, state } = setup();
    game.cb.onNotice?.({ text: 'CRS is entering the danger zone', level: 'warning' });
    game.cb.onSync?.(state);
    game.cb.onNotice?.({ text: 'TOCI is ready', level: 'info' });
    game.cb.onSync?.(state);
    expect(document.querySelector('.notice')?.textContent).toBe('CRS is entering the danger zone');
  });

  it('hides the notice when play is not active', () => {
    const { game, state } = setup();
    game.cb.onNotice?.({ text: 'IEC-HS ACTIVE', level: 'critical' });
    game.cb.onSync?.(state);
    expect(document.querySelector('.notice')?.classList.contains('hidden')).toBe(false);
    state.phase = 'lost';
    game.cb.onSync?.(state);
    expect(document.querySelector('.notice')?.classList.contains('hidden')).toBe(true);
  });

  it('keeps an unaffordable build cell selectable for preview', () => {
    const { game, state } = setup(); // currency 120 < Dual-Target cost 170
    game.cb.onSync?.(state);
    const dual = document.querySelector('.u-dual') as HTMLButtonElement;
    expect(dual.disabled).toBe(false);
    expect(dual.classList.contains('poor')).toBe(true);
    dual.click();
    expect(game.setBuildType).toHaveBeenCalledWith('dual');
  });

  it('flags only the units you cannot yet afford as poor', () => {
    const { game, state } = setup();
    game.cb.onSync?.(state);
    expect(document.querySelector('.u-bcma')?.classList.contains('poor')).toBe(false);
    expect(document.querySelector('.u-dual')?.classList.contains('poor')).toBe(true);
  });

  it('surfaces a reason instead of firing when an ability is unaffordable', () => {
    const { game, state } = setup();
    state.currency = 10;
    game.cb.onSync?.(state);
    const toci = document.querySelector('.a-toci') as HTMLButtonElement;
    expect(toci.disabled).toBe(false);
    expect(toci.classList.contains('poor')).toBe(true);
    toci.click();
    expect(game.useAbility).not.toHaveBeenCalled();
    game.cb.onSync?.(state);
    expect(document.querySelector('.notice')?.textContent).toBe('Tocilizumab needs 55 funding');
  });

  it('still fires an affordable ability on tap', () => {
    const { game, state } = setup(); // currency 120 >= Tocilizumab cost 55
    game.cb.onSync?.(state);
    const toci = document.querySelector('.a-toci') as HTMLButtonElement;
    expect(toci.classList.contains('ready')).toBe(true);
    toci.click();
    expect(game.useAbility).toHaveBeenCalledWith('toci');
  });
});
