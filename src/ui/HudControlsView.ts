import type { Game } from '../game/Game';
import type { AbilityId, GameState, UnitTypeId } from '../game/types';
import { ABILITY, CNS, GCSF, METER, STEMCELL, UNIT } from '../game/Balance';
import { canActivate } from '../systems/AbilitySystem';
import { el } from './dom';

const GAUGE_C = 2 * Math.PI * 16;
const UNIT_IDS: UnitTypeId[] = ['bcma', 'dual', 'memory'];
const ABILITY_IDS: AbilityId[] = ['toci', 'dexa', 'anakinra', 'gcsf', 'stemcell'];
const METER_META: { id: 'burden' | 'crs' | 'neuro' | 'fitness' | 'hematotoxicity'; label: string }[] = [
  { id: 'burden', label: 'Burden' },
  { id: 'crs', label: 'CRS' },
  { id: 'neuro', label: 'Neurotoxicity' },
  { id: 'hematotoxicity', label: 'Hematotoxicity' },
  { id: 'fitness', label: 'Fitness' },
];

export class HudControlsView {
  readonly hud = el('div', 'hud');
  readonly units = el('div', 'units');
  readonly abilities = el('div', 'abilities');
  private meterFill: Record<string, SVGCircleElement> = {};
  private meterVal: Record<string, HTMLElement> = {};
  private meterBox: Record<string, HTMLElement> = {};
  private currencyEl = el('div', 'currency');
  private waveEl = el('div', 'wave');
  private cnsPanel = el('section', 'cns-hud hidden');
  private cnsBurdenFill = el('span');
  private cnsBurdenValue = el('b', undefined, '0');
  private cnsWarnings = el('div', 'cns-warnings');
  private cnsKey = '';
  private speedBtn = el('button', 'btn ghost icon-btn', '1\u00D7');
  private abilityWasCooling: Partial<Record<AbilityId, boolean>> = {};
  private abilityEls = Object.fromEntries(ABILITY_IDS.map((id) => [id, {
    btn: el('button'), state: el('span'),
  }])) as Record<AbilityId, { btn: HTMLButtonElement; state: HTMLSpanElement }>;
  private unitEls = Object.fromEntries(UNIT_IDS.map((id) => [id, el('button')])) as Record<UnitTypeId, HTMLButtonElement>;

  constructor(private game: Game, private notify: (text: string) => void) {
    const left = el('div', 'hud-left');
    for (const meter of METER_META) {
      const box = el('div', `meter m-${meter.id}`);
      box.setAttribute('aria-label', meter.label);
      box.setAttribute('role', 'progressbar');
      box.setAttribute('aria-valuemin', '0');
      box.setAttribute('aria-valuemax', '100');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 40 40');
      const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      track.setAttribute('class', 'm-track');
      track.setAttribute('cx', '20'); track.setAttribute('cy', '20'); track.setAttribute('r', '16');
      const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fill.setAttribute('class', 'm-arc');
      fill.setAttribute('cx', '20'); fill.setAttribute('cy', '20'); fill.setAttribute('r', '16');
      fill.setAttribute('stroke-dasharray', String(GAUGE_C));
      fill.setAttribute('stroke-dashoffset', String(GAUGE_C));
      svg.append(track, fill);
      const val = el('span', 'm-val', '0');
      const gauge = el('div', 'm-gauge');
      gauge.append(svg, val);
      box.append(gauge, el('span', 'm-label', meter.label));
      left.appendChild(box);
      this.meterBox[meter.id] = box; this.meterFill[meter.id] = fill; this.meterVal[meter.id] = val;
    }
    const mid = el('div', 'hud-mid');
    const cnsTitle = el('div', 'cns-burden-title');
    cnsTitle.append(document.createTextNode('CNS DISEASE BURDEN '), this.cnsBurdenValue);
    const cnsTrack = el('div', 'cns-burden-track'); cnsTrack.appendChild(this.cnsBurdenFill);
    this.cnsPanel.setAttribute('aria-label', 'CNS disease burden and interface containment');
    this.cnsPanel.append(cnsTitle, cnsTrack, this.cnsWarnings);
    mid.append(this.currencyEl, this.waveEl, this.cnsPanel);
    const right = el('div', 'hud-right');
    const pauseBtn = el('button', 'btn ghost icon-btn', '\u2758\u2758');
    pauseBtn.title = 'Pause (P)'; pauseBtn.setAttribute('aria-label', 'Pause game');
    this.speedBtn.title = 'Speed (click to cycle 1x/2x/3x)';
    pauseBtn.addEventListener('click', () => this.game.togglePause());
    this.speedBtn.addEventListener('click', () => this.game.cycleSpeed());
    right.append(this.speedBtn, pauseBtn);
    this.hud.append(left, mid, right);

    for (const id of ABILITY_IDS) {
      const def = ABILITY[id]; const control = this.abilityEls[id];
      control.btn.className = `ability a-${id}`; control.state.className = 'a-state';
      control.btn.title = def.blurb;
      control.btn.setAttribute('aria-label', `${def.name}: ${def.blurb}`);
      const name = el('span', 'a-name');
      name.append(el('span', 'shortcut', `${ABILITY_IDS.indexOf(id) + 1} · `), document.createTextNode(def.name));
      control.btn.append(el('span', 'glyph', def.glyph), name, control.state);
      control.btn.addEventListener('click', () => this.onAbilityPress(id));
      this.abilities.appendChild(control.btn);
    }
    for (const id of UNIT_IDS) {
      const def = UNIT[id]; const button = this.unitEls[id];
      button.className = `unit u-${id}`; button.title = def.blurb;
      const shortcut = ['Q', 'W', 'E'][UNIT_IDS.indexOf(id)];
      button.setAttribute('aria-label', `${shortcut}: build ${def.label}, ${def.cost} funding`);
      const icon = el('span', 'p-icon'); icon.style.background = def.color;
      const name = el('span', 'u-name');
      name.append(el('span', 'shortcut', `${shortcut} · `), document.createTextNode(def.label));
      button.append(icon, name, el('span', 'u-cost', `${def.cost}`));
      button.addEventListener('click', () => this.game.setBuildType(id));
      this.units.appendChild(button);
    }
  }

  private onAbilityPress(id: AbilityId): void {
    const state = this.game.state;
    if (state.phase !== 'playing') return;
    if (canActivate(state, id)) { this.game.useAbility(id); return; }
    const reason = this.abilityBlockReason(state, id);
    if (reason) this.notify(reason);
  }

  private abilityBlockReason(state: GameState, id: AbilityId): string | null {
    const def = ABILITY[id]; const ability = state.abilities[id];
    const stemRecovery = state.stats.time < state.stemCellRecoveryUntil;
    const gcsfSupport = state.stats.time < state.gcsfUntil;
    if (id === 'anakinra' && !state.iecHsActive) return 'Anakinra is only available during IEC-HS';
    if (id === 'stemcell') {
      if (state.meters.hematotoxicity < STEMCELL.minHematotoxicity) return 'No hematologic need for Stem-Cell Boost';
      if (gcsfSupport) return 'Stem-Cell Boost is paused while G-CSF is active';
    }
    if (id === 'gcsf') {
      if (state.meters.hematotoxicity < GCSF.minHematotoxicity) return `G-CSF needs hematotoxicity ${GCSF.minHematotoxicity}+`;
      if (stemRecovery || gcsfSupport) return 'G-CSF support already active';
    }
    if (def.once && ability.used) return `${def.name} already used`;
    if (ability.cooldown > 0) return `${def.name} recharging (${Math.ceil(ability.cooldown)}s)`;
    if (state.currency < def.cost) return `${def.name} needs ${def.cost} funding`;
    return null;
  }

  update(state: GameState): void {
    for (const meter of METER_META) {
      const value = state.meters[meter.id];
      this.meterFill[meter.id].setAttribute('stroke-dashoffset', String(GAUGE_C * (1 - value / 100)));
      this.meterVal[meter.id].textContent = String(Math.round(value));
      this.meterBox[meter.id].setAttribute('aria-valuenow', String(Math.round(value)));
    }
    this.meterBox.crs.classList.toggle('warn', state.meters.crs >= METER.crsWarn);
    this.meterBox.neuro.classList.toggle('warn', state.meters.neuro >= METER.neuroWarn);
    this.meterBox.burden.classList.toggle('warn', state.meters.burden >= 60);
    const hematotoxicity = state.meters.hematotoxicity;
    const stemRecovery = state.stats.time < state.stemCellRecoveryUntil;
    const gcsfSupport = state.stats.time < state.gcsfUntil;
    this.meterBox.hematotoxicity.classList.toggle('warn', hematotoxicity >= METER.hematotoxicityWarn);
    this.meterBox.hematotoxicity.classList.toggle('danger', hematotoxicity >= METER.hematotoxicityDanger);
    const label = this.meterBox.hematotoxicity.querySelector<HTMLElement>('.m-label');
    if (label) label.textContent = stemRecovery ? 'Hematopoietic recovery' : gcsfSupport ? 'G-CSF SUPPORT' : hematotoxicity >= METER.hematotoxicityWarn ? 'ICAHT pressure' : 'Hematotoxicity';
    this.meterBox.hematotoxicity.setAttribute('aria-label', stemRecovery ? 'Hematopoietic recovery active' : gcsfSupport ? 'G-CSF support active' : `Hematotoxicity ${Math.round(hematotoxicity)}`);
    this.meterBox.fitness.classList.toggle('warn', state.meters.fitness <= 30);
    this.currencyEl.textContent = `\u25C9 ${Math.floor(state.currency)}`;
    this.waveEl.textContent = `Wave ${Math.min(state.wave, state.wavesTotal)} / ${state.wavesTotal}`;
    this.speedBtn.textContent = `${this.game.settings.speed}\u00D7`;

    this.cnsPanel.classList.toggle('hidden', state.level !== 'cns');
    if (state.level === 'cns') {
      const burden = Math.round(state.meters.cnsBurden);
      this.cnsBurdenValue.textContent = String(burden);
      this.cnsBurdenFill.style.width = `${burden}%`;
      this.cnsPanel.classList.toggle('warn', burden >= 70);
      const warnings = state.activeCnsBreaches.filter((event) => event.stage === 'warning');
      const key = `${state.cnsContainmentUsed}:${Math.floor(state.currency)}:${warnings.map((event) => `${event.id}:${Math.ceil(event.remaining)}:${event.contained}`).join('|')}`;
      if (key !== this.cnsKey) {
        this.cnsKey = key;
        this.cnsWarnings.innerHTML = '';
        if (warnings.length === 0) {
          this.cnsWarnings.appendChild(el('span', 'cns-quiet', state.cnsContainmentUsed ? 'Containment used this wave' : 'Interfaces monitored'));
        } else {
          for (const warning of warnings) {
            const names = {
              bloodCsf: 'CHOROID PLEXUS',
              bbb: 'CORTICAL BBB',
              leptomeningeal: 'LEPTOMENINGEAL',
            } as const;
            const button = el('button', `cns-contain route-${warning.interface}`);
            button.type = 'button';
            button.disabled = state.cnsContainmentUsed || state.currency < CNS.containmentCost || warning.contained;
            button.setAttribute('aria-label', `Contain ${names[warning.interface].toLowerCase()} entry, ${Math.max(0, Math.ceil(warning.remaining))} seconds, costs ${CNS.containmentCost} funding`);
            button.innerHTML = `<span class="route-symbol" aria-hidden="true">${warning.interface === 'bloodCsf' ? 'VENT' : warning.interface === 'bbb' ? 'BBB' : 'PIA'}</span><span>${names[warning.interface]} · ${Math.max(0, Math.ceil(warning.remaining))}s</span><b>${warning.contained ? 'DELAYED' : state.cnsContainmentUsed ? 'USED' : `CONTAIN ${CNS.containmentCost}`}</b>`;
            button.addEventListener('click', () => this.game.containCnsBreach(warning.id));
            this.cnsWarnings.appendChild(button);
          }
        }
      }
    } else {
      this.cnsKey = '';
    }

    for (const id of ABILITY_IDS) {
      const def = ABILITY[id]; const ability = state.abilities[id]; const control = this.abilityEls[id];
      const can = canActivate(state, id); const live = state.phase === 'playing';
      control.btn.disabled = !live; control.btn.classList.toggle('ready', can); control.btn.classList.toggle('poor', live && !can);
      const remaining = Math.max(0, state.gcsfUntil - state.stats.time);
      const guidedMonitoring = state.onboarding.active && state.onboarding.hint === 'monitorWave';
      const concerning = (id === 'toci' && (state.meters.crs >= METER.crsWarn || (guidedMonitoring && state.meters.crs > 0))) || (id === 'dexa' && (state.meters.neuro >= METER.neuroWarn || state.meters.hyperinflammation >= 55 || (guidedMonitoring && state.meters.neuro > 0))) || (id === 'stemcell' && hematotoxicity >= METER.hematotoxicityWarn) || (id === 'gcsf' && hematotoxicity >= GCSF.minHematotoxicity) || (id === 'anakinra' && state.iecHsActive);
      control.btn.classList.toggle('hint', can && concerning);
      control.state.textContent = id === 'anakinra' && !state.iecHsUnlocked ? 'locked' : id === 'gcsf' && remaining > 0 ? `support ${Math.ceil(remaining)}s` : id === 'gcsf' && hematotoxicity < GCSF.minHematotoxicity ? `HEM ${GCSF.minHematotoxicity}+` : def.once && ability.used ? 'used' : ability.cooldown > 0 ? `${Math.ceil(ability.cooldown)}s` : def.cost === 0 ? 'ready' : `${def.cost}`;
      if (ability.cooldown > 0) this.abilityWasCooling[id] = true;
      else if (this.abilityWasCooling[id]) { this.abilityWasCooling[id] = false; this.notify(`${def.name} is ready`); }
    }
    for (const id of UNIT_IDS) {
      const def = UNIT[id]; const button = this.unitEls[id];
      const selected = this.game.buildType === id; const poor = state.currency < def.cost;
      button.disabled = state.phase !== 'playing'; button.classList.toggle('poor', poor);
      button.classList.toggle('active', selected && !poor); button.classList.toggle('preview', selected && poor);
      const guidedChoice = state.onboarding.active
        && ((state.onboarding.hint === 'chooseUnit' && id === 'bcma') || state.onboarding.hint === 'reinforce');
      button.classList.toggle('hint', guidedChoice && !poor);
    }
  }
}
