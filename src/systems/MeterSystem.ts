// Body meters, passive economy, and win/lose checks. Pure.
import type { GameState } from '../game/types';
import { METER, ECONOMY, IEC_HS, STEMCELL, GCSF } from '../game/Balance';
import { clamp } from '../lib/math';

export function stepMeters(s: GameState, dt: number): void {
  const m = s.meters;
  const passive = ECONOMY.passivePerSec * dt;
  s.currency += passive;
  s.stats.fundingEarned += passive;

  const crsDecay = s.subPhase === 'wave' ? METER.crsDecayWave : METER.crsDecayPlanning;
  m.crs = clamp(m.crs - crsDecay * dt, 0, 100);

  // Inflammatory and disease pressure first accumulates in a latent injury
  // pool, then emerges gradually as hematotoxicity.
  s.hematotoxicityLoad += (
    (m.crs / 100) * METER.hematotoxicityExposure.crs +
    (m.hyperinflammation / 100) * METER.hematotoxicityExposure.hyperinflammation +
    (m.burden / 100) * METER.hematotoxicityExposure.burden
  ) * dt;
  const released = s.hematotoxicityLoad * METER.hematotoxicityRelease * dt;
  s.hematotoxicityLoad = Math.max(0, s.hematotoxicityLoad - released);
  const recovering = s.stats.time < s.stemCellRecoveryUntil;
  const gcsfSupport = s.stats.time < s.gcsfUntil;
  m.hematotoxicity = clamp(
    m.hematotoxicity + released - (
      (recovering ? STEMCELL.recoveryPerSec : 0) +
      (gcsfSupport ? GCSF.recoveryPerSec : 0)
    ) * dt,
    0,
    100,
  );

  if (s.subPhase === 'wave') {
    const durable = s.towers.some((t) => t.type === 'bcma' && t.tier >= 2);
    const fitnessFactor = durable ? 0.85 : 1;
    m.fitness = clamp(
      m.fitness -
        (METER.fitnessDecline * 0.3 + (m.crs / 100) * METER.fitnessDecline * 0.5) * dt * fitnessFactor,
      0,
      100,
    );
    m.neuro = clamp(
      m.neuro + METER.neuroDrip * dt,
      0,
      100,
    );
  } else {
    const fitnessRecoveryFactor = Math.max(0.15, 1 - m.hematotoxicity / 85);
    m.fitness = clamp(m.fitness + METER.fitnessRegen * fitnessRecoveryFactor * dt, 0, 100);
    m.neuro = clamp(m.neuro - METER.neuroDecay * dt, 0, 100);
  }

  if (s.iecHsActive) {
    const anakinra = s.stats.time < s.anakinraUntil;
    const dexaFactor = s.stats.time < s.iecHsDexaUntil ? IEC_HS.dexaMultiplier : 1;
    const generation = (s.subPhase === 'wave' ? IEC_HS.risePerSec : IEC_HS.risePerSec * 0.25) *
      (anakinra ? IEC_HS.anakinraMultiplier : 1) * dexaFactor;
    const recovery = anakinra ? IEC_HS.anakinraDecay : 0;
    const delta = (generation - recovery) * dt;
    m.hyperinflammation = clamp(m.hyperinflammation + delta, 0, 100);
    s.hyperinflammationTrend = dt > 0 ? delta / dt : 0;
    m.fitness = clamp(m.fitness - m.hyperinflammation * IEC_HS.fitnessDrainFactor * dt, 0, 100);
  } else {
    s.hyperinflammationTrend = 0;
  }

  if (!recovering && m.hematotoxicity > METER.hematotoxicityFitnessThreshold) {
    const severity = (m.hematotoxicity - METER.hematotoxicityFitnessThreshold) /
      (100 - METER.hematotoxicityFitnessThreshold);
    const supportFactor = gcsfSupport ? GCSF.fitnessDrainMultiplier : 1;
    m.fitness = clamp(m.fitness - severity * METER.hematotoxicityFitnessDrainMax * supportFactor * dt, 0, 100);
  }

  s.stats.burdenPeak = Math.max(s.stats.burdenPeak, m.burden);
  if (m.crs > s.stats.peakCrs) s.stats.peakCrs = m.crs;
  if (m.neuro > s.stats.peakNeuro) s.stats.peakNeuro = m.neuro;
  if (m.hyperinflammation > s.stats.peakHyperinflammation) s.stats.peakHyperinflammation = m.hyperinflammation;
  if (m.hematotoxicity > s.stats.peakHematotoxicity) s.stats.peakHematotoxicity = m.hematotoxicity;
  if (m.cnsBurden > s.stats.peakCnsBurden) s.stats.peakCnsBurden = m.cnsBurden;
  if (m.fitness < s.stats.lowestFitness) s.stats.lowestFitness = m.fitness;
  if (s.waveBaseline) {
    s.waveBaseline.peakCrs = Math.max(s.waveBaseline.peakCrs, m.crs);
    s.waveBaseline.peakNeuro = Math.max(s.waveBaseline.peakNeuro, m.neuro);
    s.waveBaseline.peakHyperinflammation = Math.max(s.waveBaseline.peakHyperinflammation, m.hyperinflammation);
    s.waveBaseline.peakHematotoxicity = Math.max(s.waveBaseline.peakHematotoxicity, m.hematotoxicity);
    s.waveBaseline.peakCnsBurden = Math.max(s.waveBaseline.peakCnsBurden, m.cnsBurden);
  }
  if (s.phase === 'playing') s.stats.time += dt;
}

export function checkEnd(s: GameState): 'won' | 'lost' | null {
  if (s.phase !== 'playing') return null;
  if (s.bossEscaped) return 'lost';
  const m = s.meters;
  if (m.crs >= 100 || m.neuro >= 100 || m.hyperinflammation >= 100 || m.cnsBurden >= 100 || m.fitness <= 0) return 'lost';
  if (s.wave > s.wavesTotal) return 'won';
  return null;
}
