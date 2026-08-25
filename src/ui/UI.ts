// Consolidated DOM UI: HUD, ability bar, menus, onboarding hints, banner and
// the build/unit popup. The game's simulation renders itself to game.canvas;
// everything around it is DOM synced from the same frame callback.
import type { Game } from '../game/Game';
import type {
  GameState,
  UnitTypeId,
  AbilityId,
  EnemyTypeId,
  Tower,
} from '../game/types';
import { CANVAS_W, CANVAS_H } from '../game/types';
import { UNIT, ABILITY, ENEMY, GCSF, METER } from '../game/Balance';
import { WAVES, wavePreview } from '../data/waves';
import { computeScore } from '../systems/ScoringSystem';
import { canActivate } from '../systems/AbilitySystem';
import { computedTowerStats } from '../systems/CombatSystem';
import { GLOSSARY, REFERENCES, WAVE_TITLES } from '../data/education';

type MenuKind = 'entry' | 'start' | 'pause' | 'win' | 'lose' | 'glossary' | 'settings';

const METER_META: { id: 'burden' | 'crs' | 'neuro' | 'fitness' | 'hematotoxicity'; label: string }[] = [
  { id: 'burden', label: 'Burden' },
  { id: 'crs', label: 'CRS' },
  { id: 'neuro', label: 'Neurotoxicity' },
  { id: 'hematotoxicity', label: 'Hematotoxicity' },
  { id: 'fitness', label: 'Fitness' },
];

const GAUGE_C = 2 * Math.PI * 16;

const UNIT_IDS: UnitTypeId[] = ['bcma', 'dual', 'memory'];
const ABILITY_IDS: AbilityId[] = ['toci', 'dexa', 'anakinra', 'gcsf', 'stemcell'];

const SCORE_LABELS: Record<string, string> = {
  hematotoxicity: 'Hematotoxicity control',
  burden: 'Low burden',
  fitness: 'Fitness floor',
  crs: 'CRS control',
  neuro: 'Neuro control',
  kills: 'Cells killed',
  currency: 'Leftover funding',
  time: 'Speed',
  precision: 'Leak-free precision',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

export class UI {
  private game: Game;
  private canvas: HTMLCanvasElement;
  private stage: HTMLDivElement;
  private banner: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private menu: HTMLDivElement;
  private popup: HTMLDivElement;
  private notice: HTMLDivElement;
  private iecPanel: HTMLDivElement;
  private meterFill: Record<string, SVGCircleElement> = {};
  private meterVal: Record<string, HTMLElement> = {};
  private meterBox: Record<string, HTMLElement> = {};
  private currencyEl: HTMLDivElement;
  private waveEl: HTMLDivElement;
  private speedBtn: HTMLButtonElement;
  private abilityEls: Record<AbilityId, { btn: HTMLButtonElement; state: HTMLSpanElement }> =
    {
      toci: { btn: el('button'), state: el('span') },
      dexa: { btn: el('button'), state: el('span') },
      stemcell: { btn: el('button'), state: el('span') },
      anakinra: { btn: el('button'), state: el('span') },
      gcsf: { btn: el('button'), state: el('span') },
    };
  private unitEls: Record<UnitTypeId, HTMLButtonElement> = {
    bcma: el('button'),
    dual: el('button'),
    memory: el('button'),
  };

  private lastPhase: string = 'menu';
  private nav: MenuKind | null = null;
  private lastMenuKey = '';
  private lastBannerKey = '';
  private popupKey = '';
  private abilityWasCooling: Partial<Record<AbilityId, boolean>> = {};

  constructor(game: Game, app: HTMLElement) {
    this.game = game;
    this.canvas = game.canvas;
    game.cb.onSync = (s) => this.sync(s);
    game.cb.onNotice = (message) => this.showNotice(message);

    const screen = el('div', 'screen');

    const hud = el('div', 'hud');
    const left = el('div', 'hud-left');
    for (const m of METER_META) {
      const box = el('div', `meter m-${m.id}`);
      box.setAttribute('aria-label', m.label);
      box.setAttribute('role', 'progressbar');
      box.setAttribute('aria-valuemin', '0');
      box.setAttribute('aria-valuemax', '100');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 40 40');
      const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      track.setAttribute('class', 'm-track');
      track.setAttribute('cx', '20');
      track.setAttribute('cy', '20');
      track.setAttribute('r', '16');
      const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fill.setAttribute('class', 'm-arc');
      fill.setAttribute('cx', '20');
      fill.setAttribute('cy', '20');
      fill.setAttribute('r', '16');
      fill.setAttribute('stroke-dasharray', String(GAUGE_C));
      fill.setAttribute('stroke-dashoffset', String(GAUGE_C));
      svg.append(track, fill);
      const val = el('span', 'm-val', '0');
      const gauge = el('div', 'm-gauge');
      gauge.append(svg, val);
      box.append(gauge, el('span', 'm-label', m.label));
      left.appendChild(box);
      this.meterBox[m.id] = box;
      this.meterFill[m.id] = fill;
      this.meterVal[m.id] = val;
    }
    const mid = el('div', 'hud-mid');
    this.currencyEl = el('div', 'currency');
    this.waveEl = el('div', 'wave');
    mid.append(this.currencyEl, this.waveEl);
    const right = el('div', 'hud-right');
    const pauseBtn = el('button', 'btn ghost icon-btn', '\u2758\u2758');
    this.speedBtn = el('button', 'btn ghost icon-btn', '1\u00D7');
    pauseBtn.title = 'Pause (P)';
    pauseBtn.setAttribute('aria-label', 'Pause game');
    this.speedBtn.title = 'Speed (click to cycle 1x/2x/3x)';
    pauseBtn.addEventListener('click', () => this.game.togglePause());
    this.speedBtn.addEventListener('click', () => this.game.cycleSpeed());
    right.appendChild(this.speedBtn);
    right.appendChild(pauseBtn);
    hud.append(left, mid, right);

    this.stage = el('div', 'stage');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Bone marrow defense battlefield');
    this.stage.appendChild(this.canvas);
    this.banner = el('div', 'banner hidden');
    this.tooltip = el('div', 'tooltip hidden');
    this.notice = el('div', 'notice hidden');
    this.notice.setAttribute('role', 'status');
    this.notice.setAttribute('aria-live', 'polite');
    this.iecPanel = el('div', 'iec-panel hidden');
    this.iecPanel.setAttribute('role', 'status');
    this.iecPanel.setAttribute('aria-live', 'polite');
    this.stage.append(this.banner, this.tooltip, this.notice, this.iecPanel);

    const abilities = el('div', 'abilities');
    for (const id of ABILITY_IDS) {
      const def = ABILITY[id];
      const a = this.abilityEls[id];
      a.btn.className = `ability a-${id}`;
      a.state.className = 'a-state';
      a.btn.title = def.blurb;
      a.btn.setAttribute('aria-label', `${def.name}: ${def.blurb}`);
      const shortcut = String(ABILITY_IDS.indexOf(id) + 1);
      a.btn.append(el('span', 'glyph', def.glyph), el('span', 'a-name', `${shortcut} · ${def.name}`), a.state);
      a.btn.addEventListener('click', () => this.game.useAbility(id));
      abilities.appendChild(a.btn);
    }

    const units = el('div', 'units');
    for (const u of UNIT_IDS) {
      const def = UNIT[u];
      const b = this.unitEls[u];
      b.className = `unit u-${u}`;
      b.title = def.blurb;
      b.setAttribute('aria-label', `${['Q', 'W', 'E'][UNIT_IDS.indexOf(u)]}: build ${def.label}, ${def.cost} funding`);
      const ic = el('span', 'p-icon');
      ic.style.background = def.color;
      const shortcut = ['Q', 'W', 'E'][UNIT_IDS.indexOf(u)];
      b.append(ic, el('span', 'u-name', `${shortcut} · ${def.label}`), el('span', 'u-cost', `${def.cost}`));
      b.addEventListener('click', () => this.game.setBuildType(u));
      units.appendChild(b);
    }

    this.menu = el('div', 'menu hidden');
    this.popup = el('div', 'popup hidden');
    screen.append(hud, this.stage, units, abilities, this.menu, this.popup);
    app.appendChild(screen);

    this.wireCanvas();
    this.wireKeys();
  }

  /* ------------------------------------------------ canvas input */

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * CANVAS_W,
      y: ((e.clientY - r.top) / r.height) * CANVAS_H,
    };
  }

  private nearestTower(x: number, y: number, max: number): Tower | null {
    let best: Tower | null = null;
    let bd = max * max;
    for (const t of this.game.state.towers) {
      const d = (t.x - x) ** 2 + (t.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }

  private wireCanvas(): void {
    const cv = this.canvas;
    cv.addEventListener('click', (e) => {
      const { x, y } = this.canvasPos(e);
      const g = this.game;
      if (g.buildType) {
        const result = g.tryPlace(x, y, g.buildType);
        if (result.ok) g.setBuildType(null);
        else this.showNotice({
          path: 'Too close to the marrow stream',
          overlap: 'Too close to another unit',
          bounds: 'Build inside the marrow boundary',
          funding: 'Not enough funding',
        }[result.reason]);
        return;
      }
      const t = this.nearestTower(x, y, 26);
      if (t) g.selectTower(t.id);
      else g.clearSelection();
    });
    cv.addEventListener('mousemove', (e) => {
      const { x, y } = this.canvasPos(e);
      this.game.setCursor(x, y, true);
      this.updateTooltip(e, x, y);
    });
    cv.addEventListener('mouseleave', () => {
      this.game.setCursor(0, 0, false);
      this.tooltip.classList.add('hidden');
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.game.setBuildType(null);
      this.game.clearSelection();
    });
  }

  private enemyTip(type: EnemyTypeId, hpFrac: number): string {
    const d = ENEMY[type];
    const hp = Math.round(hpFrac * 100);
    return `<div class="tt-name" style="color:${d.color}">${d.icon} ${d.label}</div>
      <div class="tt-row">HP ${hp}% · Speed ${d.speed}</div>
      <div class="tt-row">Leak: +${d.escapeBurden} burden, +${d.escapeHematotoxicity} delayed hematotoxicity</div>`;
  }

  private towerTip(type: UnitTypeId, tier: number): string {
    const u = UNIT[type];
    const up = tier < u.upgrades.length ? u.upgrades[tier].name : 'Max tier';
    return `<div class="tt-name" style="color:${u.color}">${u.icon} ${u.label}</div>
      <div class="tt-row">Tier ${tier + 1} — ${up}</div>
      <div class="tt-row">Range ${Math.round(u.range * 10) / 10} · Interval ${Math.round((u.interval * 10) / 10) / 10}s</div>`;
  }

  private updateTooltip(e: MouseEvent, x: number, y: number): void {
    const s = this.game.state;
    let html = '';
    let found: { id: number } | null = null;
    let bestD = Infinity;
    for (const en of s.enemies) {
      if (!en.alive) continue;
      const def = ENEMY[en.type];
      const d = (en.x - x) ** 2 + (en.y - y) ** 2;
      const r = def.size + 8;
      if (d < r * r && d < bestD) {
        bestD = d;
        found = { id: en.id };
        html = this.enemyTip(en.type, en.hp / en.maxHp);
      }
    }
    if (!found) {
      for (const t of s.towers) {
        const d = (t.x - x) ** 2 + (t.y - y) ** 2;
        if (d < 400 && d < bestD) {
          bestD = d;
          found = { id: t.id };
          html = this.towerTip(t.type, t.tier);
        }
      }
    }
    if (found) {
      this.tooltip.innerHTML = html;
      this.tooltip.classList.remove('hidden');
      const sr = this.stage.getBoundingClientRect();
      this.tooltip.style.left = `${e.clientX - sr.left + 14}px`;
      this.tooltip.style.top = `${e.clientY - sr.top + 14}px`;
    } else {
      this.tooltip.classList.add('hidden');
    }
  }

  /* ------------------------------------------------ keyboard */

  private wireKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const g = this.game;
      const st = g.state;
      if (e.key === 'Escape') {
        if (g.buildType) g.setBuildType(null);
        else if (g.selectedTower != null) g.clearSelection();
        else if (st.phase === 'playing' || st.phase === 'paused') g.togglePause();
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (st.phase === 'playing' && st.subPhase === 'planning') {
          e.preventDefault();
          g.startWaveNow();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        if (st.phase === 'playing' || st.phase === 'paused') g.togglePause();
      } else if (e.key === '1') g.useAbility('toci');
      else if (e.key === '2') g.useAbility('dexa');
      else if (e.key === '3') g.useAbility('anakinra');
      else if (e.key === '4') g.useAbility('gcsf');
      else if (e.key === '5') g.useAbility('stemcell');
      else if (e.key === 'q' || e.key === 'Q') g.setBuildType('bcma');
      else if (e.key === 'w' || e.key === 'W') g.setBuildType('dual');
      else if (e.key === 'e' || e.key === 'E') g.setBuildType('memory');
    });
  }

  private showNotice(message: string): void {
    this.notice.textContent = message;
    this.notice.classList.remove('hidden');
    window.setTimeout(() => {
      if (this.notice.textContent === message) this.notice.classList.add('hidden');
    }, 1800);
  }

  /* ------------------------------------------------ per-frame sync */

  private sync(s: GameState): void {
    for (const m of METER_META) {
      const v = s.meters[m.id];
      this.meterFill[m.id].setAttribute('stroke-dashoffset', String(GAUGE_C * (1 - v / 100)));
      this.meterVal[m.id].textContent = String(Math.round(v));
      this.meterBox[m.id].setAttribute('aria-valuenow', String(Math.round(v)));
    }
    this.meterBox.crs.classList.toggle('warn', s.meters.crs >= METER.crsWarn);
    this.meterBox.neuro.classList.toggle('warn', s.meters.neuro >= METER.neuroWarn);
    this.meterBox.burden.classList.toggle('warn', s.meters.burden >= 60);
    const hematotoxicity = s.meters.hematotoxicity;
    const stemRecovery = s.stats.time < s.stemCellRecoveryUntil;
    const gcsfSupport = s.stats.time < s.gcsfUntil;
    this.meterBox.hematotoxicity.classList.toggle('warn', hematotoxicity >= METER.hematotoxicityWarn);
    this.meterBox.hematotoxicity.classList.toggle('danger', hematotoxicity >= METER.hematotoxicityDanger);
    const hematotoxicityLabel = this.meterBox.hematotoxicity.querySelector<HTMLElement>('.m-label');
    if (hematotoxicityLabel) hematotoxicityLabel.textContent = stemRecovery
      ? 'Hematopoietic recovery'
      : gcsfSupport ? 'G-CSF SUPPORT'
      : hematotoxicity >= METER.hematotoxicityWarn ? 'ICAHT pressure' : 'Hematotoxicity';
    this.meterBox.hematotoxicity.setAttribute('aria-label', stemRecovery
      ? 'Hematopoietic recovery active'
      : gcsfSupport ? 'G-CSF support active'
      : `Hematotoxicity ${Math.round(hematotoxicity)}`);
    this.meterBox.fitness.classList.toggle('warn', s.meters.fitness <= 30);

    if (s.iecHsUnlocked) {
      this.iecPanel.innerHTML = `<div class="iec-title">IEC-HS · HYPERINFLAMMATION <b>${Math.round(s.meters.hyperinflammation)}</b></div>
        <div class="iec-track"><span style="width:${s.meters.hyperinflammation}%"></span></div>
        <div class="iec-status"><b>IEC-HS ACTIVE</b>${s.stats.time < s.anakinraUntil ? '<span>IL-1 BLOCKADE</span>' : ''}${s.stats.time < s.iecHsDexaUntil ? '<span>STEROID EFFECT</span>' : ''}</div>`;
      this.iecPanel.classList.remove('hidden');
    } else {
      this.iecPanel.classList.add('hidden');
    }

    this.currencyEl.textContent = `\u25C9 ${Math.floor(s.currency)}`;
    this.waveEl.textContent = `Wave ${Math.min(s.wave, s.wavesTotal)} / ${s.wavesTotal}`;
    this.speedBtn.textContent = `${this.game.settings.speed}\u00D7`;

    for (const id of ABILITY_IDS) {
      const def = ABILITY[id];
      const st = s.abilities[id];
      const a = this.abilityEls[id];
      const can = canActivate(s, id);
      a.btn.disabled = !can;
      a.btn.classList.toggle('ready', can);
      const gcsfRemaining = Math.max(0, s.gcsfUntil - s.stats.time);
      const concerning = (id === 'toci' && s.meters.crs >= METER.crsWarn) ||
        (id === 'dexa' && (s.meters.neuro >= METER.neuroWarn || s.meters.hyperinflammation >= 55)) ||
        (id === 'stemcell' && s.meters.hematotoxicity >= METER.hematotoxicityWarn) ||
        (id === 'gcsf' && s.meters.hematotoxicity >= GCSF.minHematotoxicity) ||
        (id === 'anakinra' && s.iecHsActive);
      a.btn.classList.toggle('hint', can && concerning);
      a.state.textContent =
        id === 'anakinra' && !s.iecHsUnlocked
          ? 'locked'
          : id === 'gcsf' && gcsfRemaining > 0
            ? `support ${Math.ceil(gcsfRemaining)}s`
          : id === 'gcsf' && s.meters.hematotoxicity < GCSF.minHematotoxicity
            ? `HEM ${GCSF.minHematotoxicity}+`
          : def.once && st.used
          ? 'used'
          : st.cooldown > 0
            ? `${Math.ceil(st.cooldown)}s`
            : def.cost === 0 ? 'ready' : `${def.cost}`;
      if (st.cooldown > 0) this.abilityWasCooling[id] = true;
      else if (this.abilityWasCooling[id]) {
        this.abilityWasCooling[id] = false;
        this.showNotice(`${def.name} is ready`);
      }
    }
    for (const u of UNIT_IDS) {
      const def = UNIT[u];
      const b = this.unitEls[u];
      b.disabled = s.phase !== 'playing' || s.currency < def.cost;
      b.classList.toggle('active', this.game.buildType === u);
      b.classList.toggle('hint', u === 'bcma' && s.onboarding.active && s.onboarding.hint === 'chooseUnit');
    }

    this.updateBanner(s);
    this.updateMenu(s);
    this.updatePopup(s);
  }

  private updateBanner(s: GameState): void {
    if (s.phase !== 'playing') {
      this.banner.classList.add('hidden');
      this.lastBannerKey = '';
      return;
    }
    this.banner.classList.remove('hidden');
    if (s.subPhase === 'planning' && s.wave <= s.wavesTotal) {
      const secs = Math.max(0, Math.ceil(s.countdown));
      const key = `p${s.wave}-${secs}-${s.lastWaveReport?.wave ?? 0}-${s.onboarding.hint ?? ''}`;
      if (key !== this.lastBannerKey) {
        this.lastBannerKey = key;
        const prev = wavePreview(WAVES[s.wave - 1]);
        const chips = (Object.keys(prev) as EnemyTypeId[])
          .filter((k) => prev[k] > 0)
          .map((k) => `<span class="chip c-${k}">${prev[k]} ${ENEMY[k].icon}</span>`)
          .join('');
        const report = s.lastWaveReport
          ? `<div class="wave-report">Wave ${s.lastWaveReport.wave}: ${s.lastWaveReport.kills} cleared · ${s.lastWaveReport.escapes} escaped · +${s.lastWaveReport.fundingEarned} funding · peaks CRS/ICANS/IEC-HS/HEM ${s.lastWaveReport.peakCrs}/${s.lastWaveReport.peakNeuro}/${s.lastWaveReport.peakHyperinflammation}/${s.lastWaveReport.peakHematotoxicity}</div>`
          : '';
        const title = WAVE_TITLES[s.wave];
        const hint = s.onboarding.active && s.onboarding.hint === 'placeUnit'
          ? '<div class="placement-hint">LEGAL PLACEMENT SPACE HIGHLIGHTED</div>' : '';
        this.banner.innerHTML = `${report}<div class="b-line">WAVE ${s.wave}${title ? ` · ${title}` : ''} IN <b>${secs}s</b></div>
          <div class="b-chips">${chips}</div>
          ${hint}
          <button class="btn small${s.onboarding.hint === 'startWave' ? ' hint' : ''}">Start now</button>`;
        this.banner.querySelector<HTMLButtonElement>('.btn.small')!.addEventListener('click', () => {
          this.game.startWaveNow();
        });
      }
    } else {
      const key = `w${s.wave}`;
      if (key !== this.lastBannerKey) {
        this.lastBannerKey = key;
        const title = WAVE_TITLES[s.wave];
        this.banner.innerHTML = `<div class="b-line big">WAVE ${Math.min(s.wave, s.wavesTotal)}${title ? ` · ${title}` : ''}</div>`;
      }
    }
  }

  /* ------------------------------------------------ menus */

  private menuAction(act: string): void {
    const g = this.game;
    switch (act) {
      case 'enter':
        g.enterMenu();
        break;
      case 'begin':
      case 'restart':
        this.nav = null;
        g.begin();
        break;
      case 'tutorial':
        this.nav = null;
        g.begin(true);
        break;
      case 'resume':
        g.togglePause();
        break;
      case 'menu':
        this.nav = null;
        g.toMenu();
        break;
      case 'howto':
        this.nav = 'glossary';
        break;
      case 'settings':
        this.nav = 'settings';
        break;
      default:
        this.nav = null;
    }
  }

  private renderMenu(kind: MenuKind, s: GameState): void {
    const g = this.game;
    this.menu.innerHTML = '';
    const card = el('div', 'menu-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.tabIndex = -1;
    const actions = el('div', 'menu-actions');

    const addBtn = (label: string, act: string, ghost = false): void => {
      const b = el('button', `btn${ghost ? ' ghost' : ''}`, label);
      b.addEventListener('click', () => this.menuAction(act));
      actions.appendChild(b);
    };

    if (kind === 'entry') {
      card.classList.add('entry-card');
      const description = el(
        'p',
        'sr-only',
        'Opening frame of the CAR-T journey, ready to begin with synchronized music and animation.',
      );
      description.id = 'entry-cutscene-description';
      card.setAttribute('aria-describedby', description.id);
      card.append(
        el('h1', undefined, 'MARROW DEFENSE'),
        el('p', 'tag', 'A CAR-T tower defense'),
        description,
      );
      addBtn('Enter', 'enter');
    } else if (kind === 'start') {
      card.classList.add('start-card');
      const description = el(
        'p',
        'sr-only',
        'Background illustration: the CAR-T journey from leukapheresis through T-cell selection, CAR engineering, expansion and quality checks, to return infusion.',
      );
      description.id = 'intro-cutscene-description';
      card.setAttribute('aria-describedby', description.id);
      card.append(
        el('h1', undefined, 'MARROW DEFENSE'),
        el('p', 'tag', 'A CAR-T tower defense: route your engineered cells through 10 waves of myeloma while managing the patient\u2019s body.'),
        el('p', 'hs', `Best score: ${g.highScore}`),
        description,
      );
      addBtn('Start run', 'begin');
      addBtn('Show control hints', 'tutorial', true);
      addBtn('Clinical Glossary', 'howto', true);
      addBtn('Settings', 'settings', true);
      card.append(
        actions,
        el('p', 'keys', 'Q/W/E build · 1–5 abilities · SPACE start wave · P pause · ESC cancel'),
      );
    } else if (kind === 'pause') {
      card.append(el('h1', undefined, 'PAUSED'));
      addBtn('Resume', 'resume');
      addBtn('Restart', 'restart', true);
      addBtn('Clinical Glossary', 'howto', true);
      addBtn('Settings', 'settings', true);
      addBtn('Quit to menu', 'menu', true);
    } else if (kind === 'win' || kind === 'lose') {
      const r = computeScore(s);
      if (kind === 'win') {
        card.append(
          el('h1', undefined, 'MARROW CLEARED'),
          el('div', `grade g-${r.grade}`, r.grade),
          el('div', 'score-big', `${r.score} pts`),
        );
        const tbl = el('table', 'parts');
        for (const [k, v] of Object.entries(r.parts)) {
          if (v <= 0) continue;
          const tr = el('tr');
          tr.appendChild(el('td', undefined, SCORE_LABELS[k] ?? k));
          tr.appendChild(el('td', undefined, String(v)));
          tbl.appendChild(tr);
        }
        card.appendChild(tbl);
        addBtn('Play again', 'begin');
        addBtn('Menu', 'menu', true);
      } else {
        card.append(
          el('h1', undefined, 'INFUSION FAILED'),
          el('p', 'reason', g.loseReason()),
          el('div', 'score-big', `${r.score} pts`),
        );
        addBtn('Try again', 'begin');
        addBtn('Menu', 'menu', true);
      }
    } else if (kind === 'glossary') {
      card.append(el('h1', undefined, 'CLINICAL GLOSSARY'));
      const list = el('div', 'glossary-list');
      for (const entry of GLOSSARY) {
        const details = document.createElement('details');
        details.className = 'glossary-entry';
        details.appendChild(el('summary', undefined, entry.term));
        details.appendChild(el('p', undefined, entry.summary));
        const refs = el('div', 'references');
        for (const refId of entry.references) {
          const ref = REFERENCES.find((item) => item.id === refId);
          if (!ref) continue;
          const link = el('a', undefined, ref.citation);
          link.href = ref.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          refs.appendChild(link);
        }
        details.appendChild(refs);
        list.appendChild(details);
      }
      card.append(list, el('p', 'education-disclaimer', 'Simplified simulation only—not diagnostic, dosing, or patient-specific guidance.'));
      addBtn('Back', 'back');
    } else {
      // settings
      card.append(el('h1', undefined, 'SETTINGS'));
      const row1 = el('label', 'set-row');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = g.settings.sound;
      chk.addEventListener('change', () => {
        g.setSettings({ sound: chk.checked });
      });
      row1.append(chk, document.createTextNode(' Sound'));
      const rowM = el('label', 'set-row');
      const chkM = document.createElement('input');
      chkM.type = 'checkbox';
      chkM.checked = g.settings.music;
      chkM.addEventListener('change', () => {
        g.setSettings({ music: chkM.checked });
      });
      rowM.append(chkM, document.createTextNode(' Music'));
      const volumeRow = (label: string, value: number, update: (value: number) => void): HTMLLabelElement => {
        const row = el('label', 'set-row');
        const range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = '1';
        range.step = '0.05';
        range.value = String(value);
        range.setAttribute('aria-label', label);
        range.addEventListener('input', () => update(Number(range.value)));
        row.append(document.createTextNode(`${label} `), range);
        return row;
      };
      const rowMusicVolume = volumeRow('Music volume', g.settings.musicVolume, (value) => {
        g.setSettings({ musicVolume: value });
      });
      const rowSfxVolume = volumeRow('Effects volume', g.settings.sfxVolume, (value) => {
        g.setSettings({ sfxVolume: value });
      });
      const rowR = el('label', 'set-row');
      const chkR = document.createElement('input');
      chkR.type = 'checkbox';
      chkR.checked = g.settings.reducedMotion;
      chkR.addEventListener('change', () => {
        g.setSettings({ reducedMotion: chkR.checked });
      });
      rowR.append(chkR, document.createTextNode(' Reduced motion'));
      card.append(row1, rowM, rowMusicVolume, rowSfxVolume, rowR);
      addBtn('Back', 'back');
    }

    card.appendChild(actions);
    this.menu.appendChild(card);
    window.requestAnimationFrame(() => {
      if (kind === 'glossary') card.focus();
      else card.querySelector<HTMLButtonElement>('button')?.focus();
    });
  }

  private updateMenu(s: GameState): void {
    if (s.phase !== this.lastPhase) {
      if (s.phase !== 'playing') this.nav = null;
      this.lastPhase = s.phase;
    }
    let kind: MenuKind | null = null;
    if (s.phase === 'menu') kind = this.game.hasEnteredMenu ? this.nav ?? 'start' : 'entry';
    else if (s.phase === 'paused') kind = this.nav ?? 'pause';
    else if (s.phase === 'won') kind = 'win';
    else if (s.phase === 'lost') kind = 'lose';

    if (!kind) {
      this.menu.classList.add('hidden');
      this.menu.classList.remove('menu-start');
      this.canvas.removeAttribute('aria-hidden');
      this.lastMenuKey = '';
      return;
    }
    const isOpening = kind === 'entry' || kind === 'start';
    this.menu.classList.toggle('menu-start', isOpening);
    this.menu.classList.toggle('menu-entry', kind === 'entry');
    if (isOpening) this.menu.dataset.introScene = String(this.game.introScene);
    else delete this.menu.dataset.introScene;
    if (isOpening) this.canvas.setAttribute('aria-hidden', 'true');
    else this.canvas.removeAttribute('aria-hidden');
    const menuKey = `${kind}:${s.lastWaveReport?.wave ?? ''}`;
    if (menuKey !== this.lastMenuKey) {
      this.lastMenuKey = menuKey;
      this.renderMenu(kind, s);
    }
    this.menu.classList.remove('hidden');
  }

  /* ------------------------------------------------ build/unit popup */

  private placePopup(cx: number, cy: number): void {
    const r = this.canvas.getBoundingClientRect();
    const px = (cx / CANVAS_W) * r.width + (r.left - this.stage.getBoundingClientRect().left);
    const py = (cy / CANVAS_H) * r.height + (r.top - this.stage.getBoundingClientRect().top);
    let left = px + 18;
    if (left + 220 > r.width) left = px - 220 - 18;
    if (left < 4) left = 4;
    let top = py - 20;
    if (top + 150 > r.height) top = r.height - 150;
    if (top < 4) top = 4;
    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
  }

  private renderTowerPopup(t: Tower, s: GameState): void {
    const g = this.game;
    const u = UNIT[t.type];
    const up = t.tier === 2 ? null : u.upgrades[t.tier];
    const actual = computedTowerStats(t, s);
    this.popup.innerHTML = `<div class="p-title">${u.label} — TIER ${t.tier + 1}</div>`;
    const stats = el('div');
    for (const [k, v] of [
      ['Damage', `${actual.standardDamage.toFixed(1)} (${actual.bcmaLowDamage.toFixed(1)} BCMA-low)`],
      ['Range', String(Math.round(actual.range))],
      ['Fire rate', `${actual.attacksPerSecond.toFixed(1)}/s`],
      ['CRS factor', `${Math.round(actual.crsFactor * 100)}%`],
      ...(t.type === 'memory'
        ? [['Support', `+${Math.round(actual.supportPower * 100)}% · radius ${Math.round(actual.supportRadius)}`] as [string, string]]
        : []),
    ] as [string, string][]) {
      const row = el('div', 'p-stat');
      row.appendChild(el('span', undefined, k));
      row.appendChild(el('b', undefined, v));
      stats.appendChild(row);
    }
    this.popup.appendChild(stats);
    if (up) {
      const poor = s.currency < up.cost ? ' poor' : '';
      const b = el('button', `p-unit${poor}${poor ? '' : ' hint'}`);
      b.innerHTML = `<div class="p-head"><span>Upgrade: ${up.name}</span><span class="p-cost">${up.cost}</span></div>
        <div class="p-blurb">${up.desc}</div>`;
      b.addEventListener('click', () => g.upgradeSelected());
      this.popup.appendChild(b);
    } else {
      this.popup.appendChild(el('div', 'p-blurb', 'Max tier reached.'));
    }
    const close = el('button', 'btn small ghost', 'Close');
    close.style.width = '100%';
    close.style.marginTop = '8px';
    close.addEventListener('click', () => g.clearSelection());
    this.popup.appendChild(close);
  }

  private updatePopup(s: GameState): void {
    const g = this.game;
    if (s.phase !== 'playing' || g.buildType) {
      this.popup.classList.add('hidden');
      this.popupKey = '';
      return;
    }
    const tower =
      g.selectedTower != null ? s.towers.find((t) => t.id === g.selectedTower) : undefined;
    if (!tower) {
      this.popup.classList.add('hidden');
      this.popupKey = '';
      return;
    }
    const up = tower.tier === 2 ? null : UNIT[tower.type].upgrades[tower.tier];
    const key = `t${tower.id}-${tower.tier}-${up ? s.currency >= up.cost : 'max'}-${Math.round(tower.buffPower * 100)}-${Math.round(s.meters.fitness)}-${s.stats.time < s.dexaUntil}`;
    if (key !== this.popupKey) {
      this.popupKey = key;
      this.renderTowerPopup(tower, s);
      this.placePopup(tower.x, tower.y);
      this.popup.classList.remove('hidden');
    } else {
      this.popup.classList.remove('hidden');
    }
  }
}
