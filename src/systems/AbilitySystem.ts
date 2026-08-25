// Support abilities (tocilizumab, dexamethasone, stem-cell boost). Pure.
import type { GameState, AbilityId } from '../game/types';
import { ABILITY, TOCI, DEXA, STEMCELL, GCSF, IEC_HS } from '../game/Balance';
import { clamp } from '../lib/math';

function recordHematotoxicityPeak(s: GameState): void {
  s.stats.peakHematotoxicity = Math.max(s.stats.peakHematotoxicity, s.meters.hematotoxicity);
  if (s.waveBaseline) {
    s.waveBaseline.peakHematotoxicity = Math.max(
      s.waveBaseline.peakHematotoxicity,
      s.meters.hematotoxicity,
    );
  }
}

export function canActivate(s: GameState, id: AbilityId): boolean {
  if (s.phase !== 'playing') return false;
  if (id === 'anakinra' && !s.iecHsActive) return false;
  const stemRecovery = s.stats.time < s.stemCellRecoveryUntil;
  const gcsfSupport = s.stats.time < s.gcsfUntil;
  if (id === 'stemcell' && (s.meters.hematotoxicity < STEMCELL.minHematotoxicity || gcsfSupport)) return false;
  if (id === 'gcsf' && (s.meters.hematotoxicity < GCSF.minHematotoxicity || stemRecovery || gcsfSupport)) return false;
  const a = ABILITY[id];
  const st = s.abilities[id];
  if (st.cooldown > 0) return false;
  if (a.once && st.used) return false;
  if (s.currency < a.cost) return false;
  return true;
}

export function stepAbilities(s: GameState, dt: number): void {
  for (const id of Object.keys(s.abilities) as AbilityId[]) {
    const st = s.abilities[id];
    if (!ABILITY[id].once) st.cooldown = Math.max(0, st.cooldown - dt);
  }
}

export function activate(s: GameState, id: AbilityId): void {
  if (!canActivate(s, id)) return;
  const a = ABILITY[id];
  const st = s.abilities[id];
  s.currency -= a.cost;
  st.cooldown = a.cost === 0 || a.once ? 0 : a.cooldown;
  if (a.once) st.used = true;
  if (id === 'toci') {
    s.meters.crs = clamp(s.meters.crs - TOCI.crsDrop, 0, 100);
    s.stats.tociUses++;
    st.cooldown = a.cooldown;
  } else if (id === 'dexa') {
    s.meters.neuro = clamp(s.meters.neuro - DEXA.neuroDrop, 0, 100);
    s.crsSuppressedUntil = s.stats.time + DEXA.suppressFor;
    s.dexaUntil = s.stats.time + DEXA.slowFor;
    s.meters.fitness = clamp(s.meters.fitness - DEXA.fitnessHit, 0, 100);
    s.stats.dexaUses++;
    if (s.iecHsActive) {
      s.meters.hyperinflammation = clamp(s.meters.hyperinflammation - IEC_HS.dexaDrop, 0, 100);
      s.iecHsDexaUntil = s.stats.time + IEC_HS.dexaDuration;
    }
  } else if (id === 'stemcell') {
    recordHematotoxicityPeak(s);
    s.meters.hematotoxicity = clamp(s.meters.hematotoxicity - STEMCELL.hematotoxicityDrop, 0, 100);
    s.hematotoxicityLoad *= STEMCELL.latentLoadMultiplier;
    s.stemCellRecoveryUntil = s.stats.time + STEMCELL.duration;
    s.stats.stemcellUses++;
  } else if (id === 'gcsf') {
    recordHematotoxicityPeak(s);
    s.meters.hematotoxicity = clamp(s.meters.hematotoxicity - GCSF.hematotoxicityDrop, 0, 100);
    s.hematotoxicityLoad *= GCSF.latentLoadMultiplier;
    s.gcsfUntil = s.stats.time + GCSF.duration;
    st.cooldown = a.cooldown;
    s.stats.gcsfUses++;
  } else if (id === 'anakinra') {
    s.anakinraUntil = s.stats.time + IEC_HS.anakinraDuration;
    st.cooldown = a.cooldown;
    s.stats.anakinraUses++;
  }
}
