import type { Game } from '../game/Game';
import type { GameState, LevelId } from '../game/types';
import { LEVELS, LEVEL_ORDER } from '../data/levels';
import { GLOSSARY, REFERENCES } from '../data/education';
import { TUTORIAL_DISCLAIMER, TUTORIAL_PAGES } from '../data/tutorial';
import { CNS_ATLAS_PANELS } from '../data/cnsAtlas';
import { computeScore } from '../systems/ScoringSystem';
import { el } from './dom';

type MenuKind = 'entry' | 'start' | 'pause' | 'win' | 'lose' | 'tutorial' | 'atlas' | 'glossary' | 'settings';
const SCORE_LABELS: Record<string, string> = { hematotoxicity: 'Hematotoxicity control', burden: 'Low burden', fitness: 'Fitness floor', crs: 'CRS control', neuro: 'Neuro control', kills: 'Cells killed', currency: 'Leftover funding', time: 'Speed', precision: 'Leak-free precision' };

export class MenuView {
  readonly root = el('div', 'menu hidden');
  private lastPhase = 'menu';
  private selectedLevel: LevelId = 'marrow';
  private nav: MenuKind | null = null;
  private lastMenuKey = '';
  private tutorialPage = 0;
  private tutorialOrigin: 'start' | 'pause' = 'start';
  private atlasPage = 0;
  private atlasOrigin: 'start' | 'pause' = 'start';

  constructor(private game: Game, private screen: HTMLElement, private canvas: HTMLCanvasElement) {}

  private action(action: string): void {
    switch (action) {
      case 'enter': this.game.enterMenu(); break;
      case 'begin': this.nav = null; this.game.begin(this.selectedLevel); break;
      case 'restart': this.nav = null; this.game.begin(this.game.state.level); break;
      case 'open-tutorial':
        this.tutorialOrigin = this.game.state.phase === 'paused' ? 'pause' : 'start';
        this.tutorialPage = 0;
        this.nav = 'tutorial';
        this.lastMenuKey = '';
        break;
      case 'tutorial-next':
        this.tutorialPage = Math.min(TUTORIAL_PAGES.length - 1, this.tutorialPage + 1);
        this.lastMenuKey = '';
        break;
      case 'tutorial-previous':
        this.tutorialPage = Math.max(0, this.tutorialPage - 1);
        this.lastMenuKey = '';
        break;
      case 'tutorial-close':
        this.nav = null;
        this.lastMenuKey = '';
        break;
      case 'tutorial-start':
        this.nav = null;
        this.game.begin(this.selectedLevel, true);
        break;
      case 'open-atlas':
        this.atlasOrigin = this.game.state.phase === 'paused' ? 'pause' : 'start';
        this.atlasPage = 0;
        this.nav = 'atlas';
        this.lastMenuKey = '';
        break;
      case 'atlas-next': this.atlasPage = Math.min(CNS_ATLAS_PANELS.length - 1, this.atlasPage + 1); this.lastMenuKey = ''; break;
      case 'atlas-previous': this.atlasPage = Math.max(0, this.atlasPage - 1); this.lastMenuKey = ''; break;
      case 'atlas-close': this.nav = null; this.lastMenuKey = ''; break;
      case 'resume': this.game.togglePause(); break;
      case 'menu': this.nav = null; this.game.toMenu(); break;
      case 'howto': this.nav = 'glossary'; break;
      case 'settings': this.nav = 'settings'; break;
      default: this.nav = null;
    }
  }

  private render(kind: MenuKind, state: GameState): void {
    this.root.innerHTML = '';
    const card = el('div', 'menu-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.tabIndex = -1;
    const actions = el('div', 'menu-actions');
    const addButton = (label: string, action: string, ghost = false, mobileLabel?: string): void => {
      const button = el('button', `btn${ghost ? ' ghost' : ''}`, label);
      if (mobileLabel) {
        button.dataset.mobileLabel = mobileLabel;
        button.setAttribute('aria-label', mobileLabel);
      }
      button.addEventListener('click', () => this.action(action)); actions.appendChild(button);
    };
    if (kind === 'entry') {
      card.classList.add('entry-card');
      const description = el('p', 'sr-only', 'Opening frame of the CAR-T journey, ready to begin with synchronized music and animation.');
      description.id = 'entry-cutscene-description'; card.setAttribute('aria-describedby', description.id);
      card.append(el('h1', undefined, 'MARROW DEFENSE'), el('p', 'tag', 'A CAR-T tower defense'), description);
      addButton('Enter', 'enter');
    } else if (kind === 'start') {
      card.classList.add('start-card');
      const description = el('p', 'sr-only', 'Background illustration: the CAR-T journey from leukapheresis through T-cell selection, CAR engineering, expansion and quality checks, to return infusion.');
      description.id = 'intro-cutscene-description'; card.setAttribute('aria-describedby', description.id);
      const levelRow = el('div', 'level-row');
      for (const id of LEVEL_ORDER) {
        const definition = LEVELS[id]; const selected = this.selectedLevel === id;
        const button = el('button', `level-card level-${id}${id === 'liver' ? ' advanced' : ''}${id === 'cns' ? ' expert' : ''}${selected ? ' selected' : ''}`);
        button.setAttribute('aria-pressed', String(selected));
        button.innerHTML = `<div class="lc-head"><span class="lc-name">${definition.name}</span><span class="lc-difficulty">${definition.difficulty}</span></div><div class="lc-tag">${definition.tagline}</div><div class="lc-summary">10 WAVES · ${definition.difficultySummary}</div>${definition.recommendedText ? `<div class="lc-recommended">${definition.recommendedText}</div>` : ''}<div class="lc-footer"><span class="lc-best">${this.game.progress.best[id] ? `Best: ${this.game.progress.best[id]!.response} · ${this.game.progress.best[id]!.score} pts` : 'Best: —'}</span><span class="lc-state">${selected ? 'SELECTED' : 'SELECT'}</span></div>`;
        button.addEventListener('click', () => { this.selectedLevel = id; this.game.previewLevel(id); this.lastMenuKey = ''; });
        levelRow.appendChild(button);
      }
      card.append(el('p', 'menu-kicker', 'CHOOSE YOUR BATTLEFIELD'), el('h1', undefined, 'MARROW DEFENSE'), el('p', 'tag', 'Defend the patient with engineered CAR-T cells across three distinct plasmacytoma campaigns.'), el('p', 'hs', `RUN HIGH SCORE · ${this.game.highScore} pts`), levelRow, description);
      const startLabel = this.selectedLevel === 'liver' ? 'Start Hepatic — Advanced' : this.selectedLevel === 'cns' ? 'Start Neuroaxis — Expert' : 'Start Marrow';
      addButton(startLabel, 'begin');
      addButton('Tutorial', 'open-tutorial', true, 'Tutorial'); addButton('Neuroaxis Anatomy Atlas', 'open-atlas', true, 'CNS Atlas'); addButton('Clinical Glossary', 'howto', true, 'Glossary'); addButton('Settings', 'settings', true, 'Settings');
      card.append(actions, el('p', 'keys', 'Q/W/E build · 1–5 abilities · SPACE start wave · P pause · ESC cancel'));
    } else if (kind === 'pause') {
      card.append(el('h1', undefined, 'PAUSED')); addButton('Resume', 'resume'); addButton('Restart', 'restart', true); addButton('Tutorial', 'open-tutorial', true); if (state.level === 'cns') addButton('Neuroaxis Anatomy Atlas', 'open-atlas', true); addButton('Clinical Glossary', 'howto', true); addButton('Settings', 'settings', true); addButton('Quit to menu', 'menu', true);
    } else if (kind === 'win' || kind === 'lose') {
      this.selectedLevel = state.level; const result = computeScore(state);
      if (kind === 'win') card.append(el('h1', undefined, `${LEVELS[state.level].name.toUpperCase()} CLEARED`));
      else card.append(el('h1', undefined, 'INFUSION FAILED'), el('p', 'reason', this.game.loseReason()));
      const badge = el('div', `response-badge response-${result.response.style}`, result.response.id); badge.setAttribute('aria-label', `${result.response.id}: ${result.response.fullName}`);
      card.append(badge, el('div', 'response-name', result.response.fullName), el('p', 'response-description', result.response.description), el('div', 'score-big', `${result.score} pts`));
      const table = el('table', 'parts');
      for (const [key, value] of Object.entries(result.parts)) { if (value <= 0) continue; const row = el('tr'); row.append(el('td', undefined, SCORE_LABELS[key] ?? key), el('td', undefined, String(value))); table.appendChild(row); }
      card.append(table, el('p', 'response-disclaimer', 'Simulated gameplay response — not an actual clinical IMWG assessment.'));
      addButton(kind === 'win' ? 'Play again' : 'Try again', 'begin'); addButton('Menu', 'menu', true);
    } else if (kind === 'tutorial') {
      card.classList.add('tutorial-card');
      if (this.tutorialOrigin === 'start') card.classList.add('start-card');
      const page = TUTORIAL_PAGES[this.tutorialPage];
      const title = el('h1', undefined, page.title);
      title.id = 'tutorial-title';
      card.setAttribute('aria-labelledby', title.id);
      const body = el('div', 'tutorial-body');
      body.setAttribute('role', 'region');
      body.setAttribute('aria-live', 'polite');
      body.appendChild(el('p', 'tutorial-summary', page.summary));
      const grid = el('div', 'tutorial-grid');
      for (const item of page.items) {
        const itemEl = el('section', `tutorial-item${item.tone ? ` tutorial-${item.tone}` : ''}`);
        itemEl.append(el('h2', undefined, item.heading), el('p', undefined, item.text));
        grid.appendChild(itemEl);
      }
      body.appendChild(grid);
      const progress = el('div', 'tutorial-progress');
      progress.setAttribute('aria-label', `Tutorial page ${this.tutorialPage + 1} of ${TUTORIAL_PAGES.length}`);
      progress.append(el('span', 'sr-only', `Page ${this.tutorialPage + 1} of ${TUTORIAL_PAGES.length}`));
      for (let index = 0; index < TUTORIAL_PAGES.length; index += 1) {
        const dot = el('span', `tutorial-dot${index === this.tutorialPage ? ' active' : ''}`);
        dot.setAttribute('aria-hidden', 'true');
        progress.appendChild(dot);
      }
      card.append(el('p', 'menu-kicker', `TUTORIAL · ${this.tutorialPage + 1}/${TUTORIAL_PAGES.length}`), title, body, progress, el('p', 'tutorial-disclaimer', TUTORIAL_DISCLAIMER));
      const finalPage = this.tutorialPage === TUTORIAL_PAGES.length - 1;
      if (!(this.tutorialOrigin === 'pause' && finalPage)) addButton(this.tutorialOrigin === 'pause' ? 'Back to paused game' : 'Back to menu', 'tutorial-close', true);
      if (this.tutorialPage > 0) addButton('Previous', 'tutorial-previous', true);
      if (!finalPage) addButton('Next', 'tutorial-next');
      else if (this.tutorialOrigin === 'start') addButton(`Start Guided ${LEVELS[this.selectedLevel].name} Run`, 'tutorial-start');
      else addButton('Return to paused game', 'tutorial-close');
    } else if (kind === 'atlas') {
      card.classList.add('atlas-card');
      if (this.atlasOrigin === 'start') card.classList.add('start-card');
      const panel = CNS_ATLAS_PANELS[this.atlasPage];
      const title = el('h1', undefined, panel.title); title.id = 'atlas-title';
      card.setAttribute('aria-labelledby', title.id);
      const body = el('div', 'atlas-body'); body.setAttribute('role', 'region'); body.setAttribute('aria-live', 'polite');
      body.appendChild(el('p', 'atlas-summary', panel.summary));
      for (const point of panel.points) {
        const section = el('section', 'atlas-item');
        section.append(el('h2', undefined, point.heading), el('p', undefined, point.text));
        body.appendChild(section);
      }
      const refs = el('div', 'atlas-references'); refs.appendChild(el('h2', undefined, 'Sources'));
      for (const reference of panel.references) { const link = el('a', undefined, reference.label); link.href = reference.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; refs.appendChild(link); }
      body.appendChild(refs);
      card.append(el('p', 'menu-kicker', `NEUROAXIS ATLAS · ${this.atlasPage + 1}/${CNS_ATLAS_PANELS.length}`), title, body, el('p', 'education-disclaimer', 'Educational anatomy and simplified gameplay—not medical or dosing guidance.'));
      addButton(this.atlasOrigin === 'pause' ? 'Back to paused game' : 'Back to menu', 'atlas-close', true);
      if (this.atlasPage > 0) addButton('Previous', 'atlas-previous', true);
      if (this.atlasPage < CNS_ATLAS_PANELS.length - 1) addButton('Next', 'atlas-next');
    } else if (kind === 'glossary') {
      card.append(el('h1', undefined, 'CLINICAL GLOSSARY')); const list = el('div', 'glossary-list');
      for (const entry of GLOSSARY) {
        const details = document.createElement('details'); details.className = 'glossary-entry';
        details.append(el('summary', undefined, entry.term), el('p', undefined, entry.summary)); const refs = el('div', 'references');
        for (const refId of entry.references) { const ref = REFERENCES.find((item) => item.id === refId); if (!ref) continue; const link = el('a', undefined, ref.citation); link.href = ref.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; refs.appendChild(link); }
        details.appendChild(refs); list.appendChild(details);
      }
      card.append(list, el('p', 'education-disclaimer', 'Simplified simulation only—not diagnostic, dosing, or patient-specific guidance.')); addButton('Back', 'back');
    } else {
      card.append(el('h1', undefined, 'SETTINGS'));
      const checkboxRow = (label: string, checked: boolean, update: (checked: boolean) => void): HTMLLabelElement => { const row = el('label', 'set-row'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked; input.addEventListener('change', () => update(input.checked)); row.append(input, document.createTextNode(` ${label}`)); return row; };
      const volumeRow = (label: string, value: number, update: (value: number) => void): HTMLLabelElement => { const row = el('label', 'set-row'); const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = '1'; range.step = '0.05'; range.value = String(value); range.setAttribute('aria-label', label); range.addEventListener('input', () => update(Number(range.value))); row.append(document.createTextNode(`${label} `), range); return row; };
      card.append(checkboxRow('Sound', this.game.settings.sound, (sound) => this.game.setSettings({ sound })), checkboxRow('Music', this.game.settings.music, (music) => this.game.setSettings({ music })), volumeRow('Music volume', this.game.settings.musicVolume, (musicVolume) => this.game.setSettings({ musicVolume })), volumeRow('Effects volume', this.game.settings.sfxVolume, (sfxVolume) => this.game.setSettings({ sfxVolume })), checkboxRow('Reduced motion', this.game.settings.reducedMotion, (reducedMotion) => this.game.setSettings({ reducedMotion })));
      addButton('Back', 'back');
    }
    card.appendChild(actions); this.root.appendChild(card);
    window.requestAnimationFrame(() => { if (kind === 'glossary' || kind === 'tutorial') card.focus(); else card.querySelector<HTMLButtonElement>('button')?.focus(); });
  }

  update(state: GameState): void {
    if (state.phase !== this.lastPhase) { if (state.phase !== 'playing') this.nav = null; this.lastPhase = state.phase; }
    let kind: MenuKind | null = null;
    if (state.phase === 'menu') kind = this.game.hasEnteredMenu ? this.nav ?? 'start' : 'entry';
    else if (state.phase === 'paused') kind = this.nav ?? 'pause'; else if (state.phase === 'won') kind = 'win'; else if (state.phase === 'lost') kind = 'lose';
    if (!kind) { this.screen.classList.remove('opening-menu'); this.root.classList.add('hidden'); this.root.classList.remove('menu-start'); this.canvas.removeAttribute('aria-hidden'); this.lastMenuKey = ''; return; }
    const opening = kind === 'entry' || kind === 'start' || (kind === 'tutorial' && this.tutorialOrigin === 'start') || (kind === 'atlas' && this.atlasOrigin === 'start'); this.screen.classList.toggle('opening-menu', opening); this.root.classList.toggle('menu-start', opening); this.root.classList.toggle('menu-entry', kind === 'entry'); this.root.classList.toggle('menu-tutorial', kind === 'tutorial'); this.root.classList.toggle('menu-atlas', kind === 'atlas');
    if (opening) this.root.dataset.introScene = String(this.game.introScene); else delete this.root.dataset.introScene;
    if (opening) this.canvas.setAttribute('aria-hidden', 'true'); else this.canvas.removeAttribute('aria-hidden');
    const page = kind === 'tutorial' ? this.tutorialPage : kind === 'atlas' ? this.atlasPage : '';
    const key = `${kind}:${page}:${state.lastWaveReport?.wave ?? ''}`; if (key !== this.lastMenuKey) { this.lastMenuKey = key; this.render(kind, state); }
    this.root.classList.remove('hidden');
  }
}
