import type { Game } from '../game/Game';
import type { GameState } from '../game/types';
import { HudControlsView } from './HudControlsView';
import { MenuView } from './MenuView';
import { StageView } from './StageView';
import { el } from './dom';

/** Public UI coordinator. View classes remain internal implementation details. */
export class UI {
  private screen = el('div', 'screen');
  private stageView: StageView;
  private hudView: HudControlsView;
  private menuView: MenuView;
  private rotateOverlay: HTMLDivElement;
  private portraitQuery: MediaQueryList | null = null;
  private pausedForOrientation = false;

  constructor(private game: Game, app: HTMLElement) {
    this.stageView = new StageView(game);
    this.hudView = new HudControlsView(game, (message) => this.stageView.showNotice(message));
    this.menuView = new MenuView(game, this.screen, game.canvas);
    this.rotateOverlay = el('div', 'rotate-overlay', '<div class="rotate-card"><div class="rotate-phone" aria-hidden="true">↻</div><strong>Rotate to landscape</strong><span>Marrow Defense is designed for a wider battlefield.</span></div>');
    this.rotateOverlay.setAttribute('role', 'status');
    this.rotateOverlay.setAttribute('aria-live', 'polite');
    this.rotateOverlay.setAttribute('aria-hidden', 'true');
    this.screen.append(this.hudView.hud, this.stageView.root, this.hudView.units, this.hudView.abilities, this.menuView.root, this.stageView.popup, this.rotateOverlay);
    app.appendChild(this.screen);
    game.cb.onSync = (state) => this.sync(state);
    game.cb.onNotice = (message) => this.stageView.showNotice(message);
    this.wireKeys();
    this.wireOrientationGuard();
  }

  private wireKeys(): void {
    window.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const state = this.game.state;
      if (event.key === 'Escape') {
        if (this.game.buildType) this.game.setBuildType(null);
        else if (this.game.selectedTower != null) this.game.clearSelection();
        else if (state.phase === 'playing' || state.phase === 'paused') this.game.togglePause();
      } else if (event.key === ' ' || event.key === 'Enter') {
        if (state.phase === 'playing' && state.subPhase === 'planning') { event.preventDefault(); this.game.startWaveNow(); }
      } else if (event.key === 'p' || event.key === 'P') {
        if (state.phase === 'playing' || state.phase === 'paused') this.game.togglePause();
      } else if (event.key === 'r' || event.key === 'R') {
        const breach = [...state.activeCnsBreaches]
          .filter((candidate) => candidate.stage === 'warning')
          .sort((a, b) => a.remaining - b.remaining)[0];
        if (breach) this.game.containCnsBreach(breach.id);
      } else if (event.key === '1') this.game.useAbility('toci');
      else if (event.key === '2') this.game.useAbility('dexa');
      else if (event.key === '3') this.game.useAbility('anakinra');
      else if (event.key === '4') this.game.useAbility('gcsf');
      else if (event.key === '5') this.game.useAbility('stemcell');
      else if (event.key === 'q' || event.key === 'Q') this.game.setBuildType('bcma');
      else if (event.key === 'w' || event.key === 'W') this.game.setBuildType('dual');
      else if (event.key === 'e' || event.key === 'E') this.game.setBuildType('memory');
    });
  }

  private wireOrientationGuard(): void {
    if (typeof window.matchMedia !== 'function') return;
    this.portraitQuery = window.matchMedia('(orientation: portrait) and (max-width: 500px)');
    this.portraitQuery.addEventListener('change', () => this.updateOrientationGuard(this.game.state));
    this.updateOrientationGuard(this.game.state);
  }

  private updateOrientationGuard(state: GameState): void {
    const portrait = this.portraitQuery?.matches ?? false;
    this.rotateOverlay.setAttribute('aria-hidden', String(!portrait));
    if (portrait && state.phase === 'playing' && !this.pausedForOrientation) { this.pausedForOrientation = true; this.game.togglePause(); }
    else if (!portrait) this.pausedForOrientation = false;
  }

  private sync(state: GameState): void {
    this.updateOrientationGuard(state);
    this.hudView.update(state);
    this.stageView.update(state);
    this.menuView.update(state);
  }
}
