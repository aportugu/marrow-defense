import type { Game } from '../game/Game';
import type { EnemyTypeId, GameState, NoticeMessage, Tower, UnitTypeId } from '../game/types';
import { CANVAS_H, CANVAS_W } from '../game/types';
import { ENEMY, UNIT } from '../game/Balance';
import { LEVELS, wavesForLevel } from '../data/levels';
import { wavePreview } from '../data/waves';
import { WAVE_TITLES } from '../data/education';
import { computedTowerStats } from '../systems/CombatSystem';
import { NoticeQueue } from './NoticeQueue';
import { el } from './dom';

export class StageView {
  readonly root = el('div', 'stage');
  readonly popup = el('div', 'popup tower-sheet hidden');
  private canvas: HTMLCanvasElement;
  private banner = el('div', 'banner hidden');
  private tooltip = el('div', 'tooltip hidden');
  private notice = el('div', 'notice level-info hidden');
  private iecPanel = el('div', 'iec-panel hidden');
  private notices = new NoticeQueue();
  private lastNoticeKey = '';
  private lastBannerKey = '';
  private popupKey = '';

  constructor(private game: Game) {
    this.canvas = game.canvas;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Bone marrow defense battlefield');
    this.notice.setAttribute('role', 'status'); this.notice.setAttribute('aria-live', 'polite');
    this.iecPanel.setAttribute('role', 'status'); this.iecPanel.setAttribute('aria-live', 'polite');
    this.popup.setAttribute('role', 'dialog'); this.popup.setAttribute('aria-label', 'Selected unit details');
    this.root.append(this.canvas, this.banner, this.tooltip, this.notice, this.iecPanel);
    this.wireCanvas();
  }

  showNotice(message: NoticeMessage | string): void {
    this.notices.push(typeof message === 'string' ? { text: message, level: 'info' } : message, this.now());
  }

  private now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  private canvasPos(event: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * CANVAS_W, y: ((event.clientY - rect.top) / rect.height) * CANVAS_H };
  }
  private nearestTower(x: number, y: number, max: number): Tower | null {
    let best: Tower | null = null; let distance = max * max;
    for (const tower of this.game.state.towers) {
      const candidate = (tower.x - x) ** 2 + (tower.y - y) ** 2;
      if (candidate < distance) { distance = candidate; best = tower; }
    }
    return best;
  }
  private wireCanvas(): void {
    this.canvas.addEventListener('pointerup', (event) => {
      const { x, y } = this.canvasPos(event); const game = this.game;
      if (game.buildType) {
        const result = game.tryPlace(x, y, game.buildType);
        if (result.ok) game.setBuildType(null);
        else this.showNotice({ text: { path: game.state.level === 'liver' ? 'Too close to a vascular stream' : 'Too close to the marrow stream', lane: 'Place this cell closer to a lane so enemies enter its firing range.', overlap: 'Too close to another unit', bounds: 'Build inside the boundary', funding: 'Not enough funding' }[result.reason], level: 'warning' });
        return;
      }
      const tower = this.nearestTower(x, y, 26);
      if (tower) game.selectTower(tower.id); else game.clearSelection();
    });
    this.canvas.addEventListener('pointermove', (event) => {
      const { x, y } = this.canvasPos(event); this.game.setCursor(x, y, true);
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') this.updateTooltip(event, x, y);
      else this.tooltip.classList.add('hidden');
    });
    this.canvas.addEventListener('pointerleave', () => { this.game.setCursor(0, 0, false); this.tooltip.classList.add('hidden'); });
    this.canvas.addEventListener('contextmenu', (event) => { event.preventDefault(); this.game.setBuildType(null); this.game.clearSelection(); });
  }
  private enemyTip(type: EnemyTypeId, hpFraction: number): string {
    const enemy = ENEMY[type];
    return `<div class="tt-name" style="color:${enemy.color}">${enemy.icon} ${enemy.label}</div><div class="tt-row">HP ${Math.round(hpFraction * 100)}% · Speed ${enemy.speed}</div><div class="tt-row">Leak: +${enemy.escapeBurden} burden, +${enemy.escapeHematotoxicity} delayed hematotoxicity</div>`;
  }
  private towerTip(type: UnitTypeId, tier: number): string {
    const unit = UNIT[type]; const upgrade = tier < unit.upgrades.length ? unit.upgrades[tier].name : 'Max tier';
    return `<div class="tt-name" style="color:${unit.color}">${unit.icon} ${unit.label}</div><div class="tt-row">Tier ${tier + 1} — ${upgrade}</div><div class="tt-row">Range ${Math.round(unit.range * 10) / 10} · Interval ${Math.round((unit.interval * 10) / 10) / 10}s</div>`;
  }
  private updateTooltip(event: MouseEvent, x: number, y: number): void {
    let html = ''; let found = false; let bestDistance = Infinity;
    for (const enemy of this.game.state.enemies) {
      if (!enemy.alive) continue;
      const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2; const radius = ENEMY[enemy.type].size + 8;
      if (distance < radius * radius && distance < bestDistance) { bestDistance = distance; found = true; html = this.enemyTip(enemy.type, enemy.hp / enemy.maxHp); }
    }
    if (!found) for (const tower of this.game.state.towers) {
      const distance = (tower.x - x) ** 2 + (tower.y - y) ** 2;
      if (distance < 400 && distance < bestDistance) { bestDistance = distance; found = true; html = this.towerTip(tower.type, tower.tier); }
    }
    if (!found) { this.tooltip.classList.add('hidden'); return; }
    this.tooltip.innerHTML = html; this.tooltip.classList.remove('hidden');
    const stageRect = this.root.getBoundingClientRect();
    this.tooltip.style.left = `${event.clientX - stageRect.left + 14}px`; this.tooltip.style.top = `${event.clientY - stageRect.top + 14}px`;
  }

  private updateNotice(state: GameState): void {
    if (state.phase !== 'playing') { this.notices.reset(); this.notice.className = 'notice level-info hidden'; this.lastNoticeKey = ''; return; }
    this.notices.advance(this.now()); const current = this.notices.current();
    if (!current) { this.notice.className = 'notice level-info hidden'; this.lastNoticeKey = ''; return; }
    const key = `${current.id}:${current.text}`;
    if (key !== this.lastNoticeKey) { this.lastNoticeKey = key; this.notice.textContent = current.text; this.notice.className = `notice level-${current.level}`; }
  }

  private guidedHint(state: GameState): string {
    if (!state.onboarding.active || !state.onboarding.hint) return '';
    const hints = {
      chooseUnit: ['1/5 · CHOOSE A UNIT', 'Select an affordable defender from the unit rail.', 'Choose a unit'],
      placeUnit: ['2/5 · PLACE NEAR A LANE', 'Place inside the green band so enemies enter the cell’s firing range.', 'Place in the green lane band'],
      startWave: ['3/5 · START THE WAVE', 'Review the incoming cells, then launch the wave when ready.', 'Start the wave'],
      monitorWave: ['4/5 · MONITOR AND TREAT', 'Units fire automatically. Use Tocilizumab for CRS, Dexamethasone for neurotoxicity, and marrow support for hematotoxicity.', 'Watch meters and match treatment'],
      reinforce: ['5/5 · REINFORCE', 'Reinvest your funding—construct another cell near a lane before wave 2.', 'Build another cell near a lane'],
    } as const;
    const [title, detail, mobile] = hints[state.onboarding.hint];
    return `<div class="guided-hint"><b>${title}</b><span class="guided-detail">${detail}</span><span class="guided-mobile">${mobile}</span></div>`;
  }

  private updateBanner(state: GameState): void {
    if (state.phase !== 'playing') { this.banner.classList.add('hidden'); this.lastBannerKey = ''; return; }
    this.banner.classList.remove('hidden');
    this.banner.classList.toggle('guided', state.onboarding.active);
    const guidedHint = this.guidedHint(state);
    if (state.subPhase === 'planning' && state.wave <= state.wavesTotal) {
      const seconds = Math.max(0, Math.ceil(state.countdown));
      const key = `${state.level}-p${state.wave}-${seconds}-${state.lastWaveReport?.wave ?? 0}-${state.onboarding.hint ?? ''}`;
      if (key === this.lastBannerKey) return;
      this.lastBannerKey = key;
      const preview = wavePreview(wavesForLevel(state.level)[state.wave - 1]);
      const chips = (Object.keys(preview) as EnemyTypeId[]).filter((id) => preview[id] > 0).map((id) => `<span class="chip c-${id}">${preview[id]} ${ENEMY[id].icon}</span>`).join('');
      const wave = wavesForLevel(state.level)[state.wave - 1]; const behaviors = new Set(wave.groups.map((group) => group.behavior).filter(Boolean));
      const special = state.level === 'liver' ? `${wave.events?.length ? '<span class="chip hepatic-threat">SURGE EVENT</span>' : ''}${behaviors.has('mitotic') ? '<span class="chip hepatic-threat">MITOTIC</span>' : ''}${behaviors.has('obstruction') ? '<span class="chip hepatic-threat">OBSTRUCTION</span>' : ''}${state.wave === 10 ? '<span class="chip hepatic-threat">3-PHASE CORE</span>' : ''}` : '';
      const report = state.lastWaveReport ? `<div class="wave-report">Wave ${state.lastWaveReport.wave}: ${state.lastWaveReport.kills} cleared · ${state.lastWaveReport.escapes} escaped · +${state.lastWaveReport.fundingEarned} funding · peaks CRS/ICANS/IEC-HS/HEM ${state.lastWaveReport.peakCrs}/${state.lastWaveReport.peakNeuro}/${state.lastWaveReport.peakHyperinflammation}/${state.lastWaveReport.peakHematotoxicity}</div>` : '';
      const title = WAVE_TITLES[state.level][state.wave];
      const guidedConstruction = state.onboarding.active && (state.onboarding.hint === 'chooseUnit' || state.onboarding.hint === 'placeUnit' || state.onboarding.hint === 'reinforce');
      const placing = state.onboarding.hint === 'placeUnit' || state.onboarding.hint === 'reinforce';
      const hint = placing ? '<div class="placement-hint">GREEN BAND = EFFECTIVE PLACEMENT RANGE</div>' : '';
      const briefing = state.level === 'liver' && state.wave === 1 ? '<div class="hepatic-briefing"><b>CLEAR INVADING PLASMA-CELL CLUSTERS FROM THE LIVER</b><span>PORTAL VEIN · HEPATIC ARTERY · BILIARY BRANCH</span></div>' : '';
      const timing = guidedConstruction ? '<b>WAITING FOR CONSTRUCTION</b>' : `IN <b>${seconds}s</b>`;
      this.banner.innerHTML = `${guidedHint}${report}${briefing}<div class="b-line">WAVE ${state.wave}${title ? ` · ${title}` : ''} ${timing}</div><div class="b-chips">${chips}${special}</div>${hint}<button class="btn small${state.onboarding.hint === 'startWave' ? ' hint' : ''}"${guidedConstruction ? ' disabled' : ''}>${guidedConstruction ? 'Build to continue' : 'Start now'}</button>`;
      this.banner.querySelector<HTMLButtonElement>('.btn.small')!.addEventListener('click', () => this.game.startWaveNow());
      return;
    }
    const event = state.activeHepaticEvent; const seconds = event ? Math.max(0, Math.ceil(event.remaining)) : 0;
    const key = `${state.level}-w${state.wave}-${event?.id ?? 0}-${event?.stage ?? ''}-${seconds}`;
    if (key === this.lastBannerKey) return;
    this.lastBannerKey = key; const title = WAVE_TITLES[state.level][state.wave];
    const eventLabel = event ? `<div class="hepatic-event ${event.stage}"><b>${event.stage === 'warning' ? 'PLASMA-CELL SURGE' : 'SURGE ACTIVE'} — ${LEVELS.liver.lanes[event.lane].name.toUpperCase()}</b>${event.stage === 'warning' ? `<span>IMPACT IN ${seconds}s</span>` : ''}</div>` : '';
    this.banner.innerHTML = `${guidedHint}${eventLabel}<div class="b-line big">WAVE ${Math.min(state.wave, state.wavesTotal)}${title ? ` · ${title}` : ''}</div>`;
  }

  private placePopup(x: number, y: number): void {
    const rect = this.canvas.getBoundingClientRect(); const stageRect = this.root.getBoundingClientRect();
    const px = (x / CANVAS_W) * rect.width + rect.left - stageRect.left; const py = (y / CANVAS_H) * rect.height + rect.top - stageRect.top;
    let left = px + 18; if (left + 220 > rect.width) left = px - 238; if (left < 4) left = 4;
    let top = py - 20; if (top + 150 > rect.height) top = rect.height - 150; if (top < 4) top = 4;
    this.popup.style.left = `${left}px`; this.popup.style.top = `${top}px`;
  }
  private renderPopup(tower: Tower, state: GameState): void {
    const unit = UNIT[tower.type]; const upgrade = tower.tier === 2 ? null : unit.upgrades[tower.tier]; const actual = computedTowerStats(tower, state);
    this.popup.innerHTML = `<div class="p-title">${unit.label} — TIER ${tower.tier + 1}</div>`;
    const stats = el('div');
    const rows: [string, string][] = [['Damage', `${actual.standardDamage.toFixed(1)} (${actual.bcmaLowDamage.toFixed(1)} BCMA-low)`], ['Range', String(Math.round(actual.range))], ['Fire rate', `${actual.attacksPerSecond.toFixed(1)}/s`], ['CRS factor', `${Math.round(actual.crsFactor * 100)}%`]];
    if (tower.type === 'memory') rows.push(['Support', `+${Math.round(actual.supportPower * 100)}% · radius ${Math.round(actual.supportRadius)}`]);
    for (const [label, value] of rows) { const row = el('div', 'p-stat'); row.append(el('span', undefined, label), el('b', undefined, value)); stats.appendChild(row); }
    this.popup.appendChild(stats);
    if (upgrade) { const poor = state.currency < upgrade.cost ? ' poor' : ''; const button = el('button', `p-unit${poor}${poor ? '' : ' hint'}`); button.innerHTML = `<div class="p-head"><span>Upgrade: ${upgrade.name}</span><span class="p-cost">${upgrade.cost}</span></div><div class="p-blurb">${upgrade.desc}</div>`; button.addEventListener('click', () => this.game.upgradeSelected()); this.popup.appendChild(button); }
    else this.popup.appendChild(el('div', 'p-blurb', 'Max tier reached.'));
    const close = el('button', 'btn small ghost', 'Close'); close.style.width = '100%'; close.style.marginTop = '8px'; close.addEventListener('click', () => this.game.clearSelection()); this.popup.appendChild(close);
  }
  private updatePopup(state: GameState): void {
    if (state.phase !== 'playing' || this.game.buildType) { this.popup.classList.add('hidden'); this.popupKey = ''; return; }
    const tower = this.game.selectedTower == null ? undefined : state.towers.find((item) => item.id === this.game.selectedTower);
    if (!tower) { this.popup.classList.add('hidden'); this.popupKey = ''; return; }
    const upgrade = tower.tier === 2 ? null : UNIT[tower.type].upgrades[tower.tier];
    const key = `t${tower.id}-${tower.tier}-${upgrade ? state.currency >= upgrade.cost : 'max'}-${Math.round(tower.buffPower * 100)}-${Math.round(state.meters.fitness)}-${state.stats.time < state.dexaUntil}`;
    if (key !== this.popupKey) { this.popupKey = key; this.renderPopup(tower, state); this.placePopup(tower.x, tower.y); }
    this.popup.classList.remove('hidden');
  }

  update(state: GameState): void {
    this.updateNotice(state);
    const event = state.activeHepaticEvent ? `, ${state.activeHepaticEvent.stage === 'warning' ? 'incoming' : 'active'} plasma-cell surge in ${LEVELS.liver.lanes[state.activeHepaticEvent.lane].name}` : '';
    this.canvas.setAttribute('aria-label', state.level === 'liver' ? `Advanced hepatic plasmacytoma defense battlefield with portal, arterial, and biliary lanes${event}` : 'Bone marrow defense battlefield');
    if (state.iecHsUnlocked) {
      this.iecPanel.innerHTML = `<div class="iec-title">IEC-HS · HYPERINFLAMMATION <b>${Math.round(state.meters.hyperinflammation)}</b></div><div class="iec-track"><span style="width:${state.meters.hyperinflammation}%"></span></div><div class="iec-status"><b>IEC-HS ACTIVE</b>${state.stats.time < state.anakinraUntil ? '<span>IL-1 BLOCKADE</span>' : ''}${state.stats.time < state.iecHsDexaUntil ? '<span>STEROID EFFECT</span>' : ''}</div>`;
      this.iecPanel.classList.remove('hidden');
    } else this.iecPanel.classList.add('hidden');
    this.updateBanner(state); this.updatePopup(state);
  }
}
