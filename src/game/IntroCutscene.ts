import { CANVAS_H, CANVAS_W } from './types';
import {
  INTRO_LOOP_SECONDS,
  INTRO_SCENE_SECONDS,
} from '../lib/introTiming';

export { INTRO_LOOP_SECONDS, INTRO_SCENE_SECONDS } from '../lib/introTiming';

export const INTRO_SCENES = [
  { title: 'LEUKAPHERESIS', caption: 'Collect white blood cells · return remaining blood components' },
  { title: 'T-CELL SELECTION', caption: 'Enrich and activate the patient’s T cells' },
  { title: 'CAR ENGINEERING', caption: 'Introduce the CAR instructions · express new receptors' },
  { title: 'EXPANSION + CHECKS', caption: 'Grow the engineered cells · confirm product quality' },
  { title: 'RETURN + INFUSION', caption: 'Deliver the CAR-T product back to the patient' },
] as const;

export interface IntroTimeline {
  cycle: number;
  scene: number;
  nextScene: number;
  sceneProgress: number;
  transitionProgress: number;
  act: 'buildup' | 'reveal' | 'transition';
  transition: 'flow' | 'vortex' | 'energy' | 'cascade' | 'tunnel';
  camera: { x: number; y: number; zoom: number };
  audioCue: IntroAudioCue;
  audioCueId: string;
  battleTeaser: boolean;
}

export type IntroAudioCue =
  | 'introCollection'
  | 'introActivation'
  | 'introEngineering'
  | 'introExpansion'
  | 'introInfusion'
  | 'introBattle';

const AUDIO_CUES: readonly IntroAudioCue[] = [
  'introCollection', 'introActivation', 'introEngineering', 'introExpansion', 'introInfusion',
];
const TRANSITIONS: readonly IntroTimeline['transition'][] = [
  'flow', 'vortex', 'energy', 'cascade', 'tunnel',
];
const CAMERA_DRIFT = [
  { x: -8, y: 3 }, { x: 10, y: -5 }, { x: -16, y: 2 }, { x: 8, y: 7 }, { x: -4, y: -4 },
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

/** Resolve a time to a deterministic point in the five-scene looping timeline. */
export function introTimeline(time: number): IntroTimeline {
  const safeTime = Number.isFinite(time) ? time : 0;
  const cycle = Math.floor(Math.max(0, safeTime) / INTRO_LOOP_SECONDS);
  const loopTime = ((safeTime % INTRO_LOOP_SECONDS) + INTRO_LOOP_SECONDS) % INTRO_LOOP_SECONDS;
  const scene = Math.floor(loopTime / INTRO_SCENE_SECONDS);
  const sceneProgress = (loopTime - scene * INTRO_SCENE_SECONDS) / INTRO_SCENE_SECONDS;
  // Act changes land on musical subdivisions: 2 beats of buildup, 4 beats of
  // reveal, then a 2-beat transition within each eight-beat phrase.
  const transitionProgress = smoothstep((sceneProgress - 0.75) / 0.25);
  const battleTeaser = scene === 4 && sceneProgress >= 0.5;
  const cameraEase = smoothstep(sceneProgress);
  const drift = CAMERA_DRIFT[scene];
  return {
    cycle,
    scene,
    nextScene: (scene + 1) % INTRO_SCENES.length,
    sceneProgress,
    transitionProgress,
    act: sceneProgress < 0.25 ? 'buildup' : sceneProgress < 0.75 ? 'reveal' : 'transition',
    transition: TRANSITIONS[scene],
    camera: {
      x: drift.x * cameraEase,
      y: drift.y * cameraEase,
      zoom: 0.96 + cameraEase * (scene === 4 ? 0.15 : 0.08),
    },
    audioCue: battleTeaser ? 'introBattle' : AUDIO_CUES[scene],
    audioCueId: `${cycle}:${scene}:${battleTeaser ? 'battle' : 'entry'}`,
    battleTeaser,
  };
}

export function shouldTriggerIntroCue(previousCueId: string | null, timeline: IntroTimeline): boolean {
  return previousCueId !== timeline.audioCueId;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function line(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  width: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}

function cell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  engineered = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = engineered ? '#22d3ee' : '#d8b4fe';
  ctx.shadowBlur = 16;
  ctx.fillStyle = engineered ? '#155e75' : '#6b215e';
  ctx.strokeStyle = engineered ? '#a5f3fc' : '#e9d5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(22,6,16,.66)';
  ctx.beginPath();
  ctx.arc(-radius * 0.12, radius * 0.08, radius * 0.43, 0, Math.PI * 2);
  ctx.fill();
  if (engineered) {
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle) * (radius + 8);
      const y2 = Math.sin(angle) * (radius + 8);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 + Math.cos(angle + 1.1) * 5, y2 + Math.sin(angle + 1.1) * 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPatient(ctx: CanvasRenderingContext2D, x: number, y: number, glow = '#b06bff'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24;
  ctx.fillStyle = 'rgba(216,180,254,.2)';
  ctx.strokeStyle = '#d8b4fe';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -84, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  roundedRect(ctx, -42, -48, 84, 126, 38);
  ctx.fill();
  ctx.stroke();
  line(ctx, [[-30, 70], [-42, 142]], '#d8b4fe', 8);
  line(ctx, [[30, 70], [42, 142]], '#d8b4fe', 8);
  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, time: number, reducedMotion: boolean): void {
  const gradient = ctx.createRadialGradient(930, 350, 30, 850, 350, 700);
  gradient.addColorStop(0, '#31102d');
  gradient.addColorStop(0.52, '#1f0a20');
  gradient.addColorStop(1, '#10050d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const t = reducedMotion ? 0 : time;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const sweep = Math.sin(t * 0.18 + i * 1.7) * 55;
    const ray = ctx.createLinearGradient(540 + i * 150, 0, 760 + i * 120 + sweep, CANVAS_H);
    ray.addColorStop(0, 'rgba(34,211,238,0)');
    ray.addColorStop(0.5, i % 2 ? 'rgba(176,107,255,.035)' : 'rgba(34,211,238,.028)');
    ray.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(650 + i * 105, 0);
    ctx.lineTo(720 + i * 105, 0);
    ctx.lineTo(970 + i * 70 + sweep, CANVAS_H);
    ctx.lineTo(780 + i * 70 + sweep, CANVAS_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Deep cellular silhouettes provide a moving sense of scale.
  for (let i = 0; i < 10; i++) {
    const x = 590 + ((i * 181 + t * (4 + i % 3)) % 760);
    const y = 75 + ((i * 113) % 590) + Math.sin(t * 0.2 + i) * 14;
    ctx.globalAlpha = 0.025 + (i % 4) * 0.012;
    ctx.fillStyle = i % 2 ? '#7a1f5c' : '#164e63';
    ctx.beginPath();
    ctx.ellipse(x, y, 38 + (i % 3) * 19, 22 + (i % 4) * 8, i * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 42; i++) {
    const depth = 0.35 + (i % 7) / 10;
    const x = (i * 173 + t * (7 + i % 5) * depth) % (CANVAS_W + 80) - 40;
    const y = 40 + ((i * 97) % 640) + Math.sin(t * 0.35 + i) * 9;
    ctx.globalAlpha = 0.035 + depth * 0.035;
    ctx.fillStyle = i % 3 === 0 ? '#a5f3fc' : i % 3 === 1 ? '#d8b4fe' : '#f9a8d4';
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const vignette = ctx.createRadialGradient(880, 360, 210, 880, 360, 760);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawLeukapheresis(ctx: CanvasRenderingContext2D, p: number, reduced: boolean): void {
  drawPatient(ctx, 740, 350);
  ctx.save();
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(8,47,73,.82)';
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 3;
  roundedRect(ctx, 905, 220, 190, 250, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(165,243,252,.08)';
  ctx.beginPath();
  ctx.arc(1000, 325, 61, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(1000, 325, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.translate(1000, 325);
  ctx.rotate(reduced ? 0.35 : p * Math.PI * 8);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.fillStyle = i % 2 ? 'rgba(251,113,133,.75)' : 'rgba(196,181,253,.75)';
    roundedRect(ctx, 13, -5, 35, 10, 5);
    ctx.fill();
  }
  ctx.restore();
  line(ctx, [[770, 325], [835, 285], [905, 285]], '#f472b6', 7);
  line(ctx, [[905, 405], [845, 438], [770, 402]], '#a78bfa', 7);
  for (let i = 0; i < 9; i++) {
    const travel = reduced ? (i + 0.5) / 9 : (p * 2.1 + i / 9) % 1;
    const outward = i % 2 === 0;
    const fromX = outward ? 770 : 905;
    const toX = outward ? 905 : 770;
    const fromY = outward ? 325 : 405;
    const toY = outward ? 285 : 402;
    ctx.fillStyle = outward ? '#fb7185' : '#c4b5fd';
    ctx.beginPath();
    ctx.arc(fromX + (toX - fromX) * travel, fromY + (toY - fromY) * travel, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '600 16px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CELL SEPARATOR', 1000, 500);

  const fill = reduced ? 0.72 : smoothstep(p);
  ctx.fillStyle = 'rgba(34,211,238,.18)';
  roundedRect(ctx, 1118, 255 + 145 * (1 - fill), 48, 145 * fill, 10);
  ctx.fill();
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 2;
  roundedRect(ctx, 1118, 255, 48, 145, 10);
  ctx.stroke();
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.fillText('T CELLS', 1142, 424);
}

function drawSelection(ctx: CanvasRenderingContext2D, p: number, reduced: boolean): void {
  ctx.save();
  ctx.translate(900, 360);
  ctx.strokeStyle = '#d8b4fe';
  ctx.lineWidth = 6;
  ctx.fillStyle = 'rgba(76,29,80,.55)';
  ctx.beginPath();
  ctx.ellipse(0, 42, 220, 92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(0, 14, 220, 92, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 12; i++) {
    const angle = i * 2.399 + (reduced ? 0 : p * 0.3);
    const radius = 28 + (i % 4) * 42;
    cell(ctx, 900 + Math.cos(angle) * radius, 380 + Math.sin(angle) * radius * 0.42, 13 + i % 3, false);
  }
  const scan = reduced ? 0.5 : (p * 1.4) % 1;
  const scanX = 705 + scan * 390;
  const scanGlow = ctx.createLinearGradient(scanX - 35, 0, scanX + 35, 0);
  scanGlow.addColorStop(0, 'rgba(57,217,138,0)');
  scanGlow.addColorStop(0.5, 'rgba(57,217,138,.36)');
  scanGlow.addColorStop(1, 'rgba(57,217,138,0)');
  ctx.fillStyle = scanGlow;
  ctx.fillRect(scanX - 35, 220, 70, 300);
  const pulse = reduced ? 1 : 1 + Math.sin(p * Math.PI * 6) * 0.08;
  ctx.strokeStyle = '#39d98a';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(900, 380, 170 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (p > 0.42 || reduced) {
    const reveal = reduced ? 1 : smoothstep((p - 0.42) / 0.35);
    ctx.globalAlpha = reveal;
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 4;
    for (const [x, y] of [[900, 380], [830, 354], [966, 407]]) {
      ctx.beginPath();
      ctx.arc(x, y, 24 + reveal * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#bbf7d0';
    ctx.font = '800 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ACTIVATED', 900, 552);
    ctx.globalAlpha = 1;
  }
}

function drawEngineering(ctx: CanvasRenderingContext2D, p: number, reduced: boolean): void {
  const cellX = 950;
  const cellY = 365;
  cell(ctx, cellX, cellY, 92, p > 0.43 || reduced);
  const surge = reduced ? 1 : smoothstep((p - 0.38) / 0.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = surge * (reduced ? 0.25 : 0.7 * (1 - Math.max(0, p - 0.75) / 0.25));
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = i % 2 ? '#f5c518' : '#22d3ee';
    ctx.lineWidth = 5 - i;
    ctx.beginPath();
    ctx.arc(cellX, cellY, 105 + surge * (40 + i * 36), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.17;
    const progress = reduced ? 0.72 : clamp01(p * 1.8 - (i % 3) * 0.12);
    const startX = 660 + Math.cos(angle) * 76;
    const startY = 365 + Math.sin(angle) * 76;
    const x = startX + (cellX - startX) * progress;
    const y = startY + (cellY - startY) * progress;
    ctx.fillStyle = '#f5c518';
    ctx.shadowColor = '#f5c518';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 7, y + 5);
    ctx.lineTo(x - 7, y + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fcd34d';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAR', 660, 480);
  line(ctx, [[700, 465], [830, 410]], 'rgba(245,197,24,.65)', 2);

  // A stylized instruction helix feeds toward the cell before the receptor reveal.
  ctx.save();
  ctx.globalAlpha = 0.65;
  for (let i = 0; i < 18; i++) {
    const x = 590 + i * 10;
    const wave = Math.sin(i * 0.9 + (reduced ? 0 : p * 7)) * 22;
    ctx.fillStyle = i % 2 ? '#fcd34d' : '#c4b5fd';
    ctx.beginPath();
    ctx.arc(x, 330 + wave, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, 330 - wave, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawExpansion(ctx: CanvasRenderingContext2D, p: number, reduced: boolean): void {
  ctx.save();
  ctx.translate(875, 350);
  ctx.fillStyle = 'rgba(8,47,73,.52)';
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-165, -155);
  ctx.lineTo(-125, 155);
  ctx.quadraticCurveTo(0, 215, 125, 155);
  ctx.lineTo(165, -155);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(34,211,238,.13)';
  ctx.fillRect(-137, 40, 274, 110);
  ctx.restore();
  const visible = reduced ? 18 : 5 + Math.floor(p * 20);
  for (let i = 0; i < visible; i++) {
    const x = 750 + ((i * 67) % 250);
    const y = 392 + ((i * 43) % 108);
    const bob = reduced ? 0 : Math.sin(p * Math.PI * 4 + i) * 5;
    cell(ctx, x, y + bob, 8 + i % 3, true);
  }
  for (let i = 0; i < 14; i++) {
    const rise = reduced ? (i + 1) / 15 : (p * 1.7 + i / 14) % 1;
    ctx.globalAlpha = 0.18 + rise * 0.28;
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(760 + ((i * 71) % 235), 500 - rise * 250, 3 + i % 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const scanY = reduced ? 340 : 245 + ((p * 2) % 1) * 245;
  const scanGlow = ctx.createLinearGradient(720, scanY, 1030, scanY);
  scanGlow.addColorStop(0, 'rgba(134,239,172,0)');
  scanGlow.addColorStop(0.5, 'rgba(134,239,172,.58)');
  scanGlow.addColorStop(1, 'rgba(134,239,172,0)');
  ctx.fillStyle = scanGlow;
  ctx.fillRect(720, scanY - 2, 310, 4);
  ctx.save();
  ctx.translate(1095, 275);
  ctx.fillStyle = 'rgba(22,101,52,.65)';
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 3;
  roundedRect(ctx, -46, -46, 92, 92, 18);
  ctx.fill();
  ctx.stroke();
  line(ctx, [[-20, 1], [-4, 18], [26, -20]], '#bbf7d0', 7);
  ctx.restore();
  if (p > 0.58 || reduced) {
    ctx.globalAlpha = reduced ? 1 : smoothstep((p - 0.58) / 0.2);
    ctx.fillStyle = '#86efac';
    ctx.font = '800 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRODUCT RELEASED', 1095, 350);
    ctx.globalAlpha = 1;
  }
}

function drawBattle(ctx: CanvasRenderingContext2D, progress: number, reduced: boolean): void {
  const p = reduced ? 0.72 : clamp01(progress);
  const targetX = 1025;
  const targetY = 365;
  ctx.save();
  ctx.globalAlpha = smoothstep(p / 0.22);
  const tunnel = ctx.createRadialGradient(900, 360, 55, 900, 360, 420);
  tunnel.addColorStop(0, 'rgba(34,211,238,.04)');
  tunnel.addColorStop(0.62, 'rgba(122,31,92,.18)');
  tunnel.addColorStop(1, 'rgba(122,31,92,0)');
  ctx.fillStyle = tunnel;
  ctx.fillRect(520, 80, 760, 560);
  for (let i = 0; i < 26; i++) {
    const angle = i * 2.399;
    const length = 80 + (i % 7) * 42 + p * 90;
    line(ctx, [
      [900 + Math.cos(angle) * 60, 360 + Math.sin(angle) * 35],
      [900 + Math.cos(angle) * length, 360 + Math.sin(angle) * length * 0.58],
    ], i % 2 ? 'rgba(34,211,238,.19)' : 'rgba(244,114,182,.16)', 2 + i % 3);
  }
  // Myeloma target with sparse receptors.
  ctx.shadowColor = '#ff5b5b';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#7f1d3f';
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(20,6,16,.62)';
  ctx.beginPath();
  ctx.arc(targetX - 8, targetY + 5, 34, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4;
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(targetX + Math.cos(a) * 74, targetY + Math.sin(a) * 74, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const attack = smoothstep((p - 0.18) / 0.5);
  for (let i = 0; i < 4; i++) {
    const startX = 620 + i * 24;
    const startY = 285 + i * 62;
    const travel = clamp01(attack * 1.35 - i * 0.09);
    cell(ctx, startX + (930 - startX) * travel, startY + (targetY - startY) * travel, 20, true);
  }
  if (p > 0.68) {
    const impact = smoothstep((p - 0.68) / 0.22);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - impact) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 38 + impact * 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1 - impact;
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI * 2 / 18;
      line(ctx, [
        [targetX + Math.cos(a) * 35, targetY + Math.sin(a) * 35],
        [targetX + Math.cos(a) * (90 + impact * 110), targetY + Math.sin(a) * (90 + impact * 110)],
      ], i % 2 ? '#22d3ee' : '#f5c518', 3);
    }
  }
  ctx.restore();
}

function drawInfusion(ctx: CanvasRenderingContext2D, p: number, reduced: boolean): void {
  const battleMix = reduced ? 0 : smoothstep((p - 0.42) / 0.08);
  ctx.save();
  ctx.globalAlpha = 1 - battleMix * 0.96;
  ctx.save();
  ctx.translate(765, 305);
  ctx.fillStyle = 'rgba(8,47,73,.7)';
  ctx.strokeStyle = '#a5f3fc';
  ctx.lineWidth = 4;
  roundedRect(ctx, -75, -120, 150, 205, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(34,211,238,.17)';
  roundedRect(ctx, -62, -12, 124, 82, 12);
  ctx.fill();
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '700 17px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAR-T', 0, 35);
  ctx.restore();
  drawPatient(ctx, 1050, 380, '#22d3ee');
  line(ctx, [[765, 390], [805, 500], [1008, 405]], '#67e8f9', 6);
  for (let i = 0; i < 8; i++) {
    const travel = reduced ? (i + 0.5) / 8 : (p * 1.5 + i / 8) % 1;
    const x = travel < 0.22
      ? 765 + (805 - 765) * (travel / 0.22)
      : 805 + (1008 - 805) * ((travel - 0.22) / 0.78);
    const y = travel < 0.22
      ? 390 + (500 - 390) * (travel / 0.22)
      : 500 + (405 - 500) * ((travel - 0.22) / 0.78);
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (battleMix > 0) drawBattle(ctx, (p - 0.5) / 0.5, false);
}

type SceneDrawer = (ctx: CanvasRenderingContext2D, progress: number, reduced: boolean) => void;
const DRAW_SCENE: SceneDrawer[] = [
  drawLeukapheresis,
  drawSelection,
  drawEngineering,
  drawExpansion,
  drawInfusion,
];

function drawSceneWithCamera(
  ctx: CanvasRenderingContext2D,
  scene: number,
  progress: number,
  alpha: number,
  camera: IntroTimeline['camera'],
  entering = false,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(900 + camera.x + (entering ? 55 * (1 - alpha) : 0), 360 + camera.y);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-900, -360);
  DRAW_SCENE[scene](ctx, progress, false);
  ctx.restore();
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  kind: IntroTimeline['transition'],
  progress: number,
): void {
  if (progress <= 0) return;
  const p = clamp01(progress);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (kind === 'flow' || kind === 'cascade') {
    for (let i = 0; i < 28; i++) {
      const y = 110 + ((i * 71) % 500);
      const x = 570 + p * 760 + (i % 5) * 26;
      line(ctx, [[x - 125, y], [x, y + Math.sin(i) * 22]], i % 2 ? 'rgba(34,211,238,.28)' : 'rgba(216,180,254,.24)', 2 + i % 3);
    }
  } else if (kind === 'vortex') {
    ctx.translate(900, 360);
    ctx.rotate(p * Math.PI * 1.4);
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI * 2 / 18;
      const radius = 70 + p * 360;
      ctx.fillStyle = i % 2 ? 'rgba(245,197,24,.45)' : 'rgba(34,211,238,.38)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius * 0.55, 3 + i % 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'energy') {
    ctx.strokeStyle = `rgba(134,239,172,${0.5 * (1 - p)})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(900, 360, 80 + p * 470, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI * 2 / 24;
      const inner = 35 + p * 130;
      const outer = inner + 180 + p * 260;
      line(ctx, [
        [900 + Math.cos(a) * inner, 360 + Math.sin(a) * inner * 0.58],
        [900 + Math.cos(a) * outer, 360 + Math.sin(a) * outer * 0.58],
      ], i % 3 ? 'rgba(34,211,238,.28)' : 'rgba(245,197,24,.3)', 2 + i % 4);
    }
  }
  const flash = Math.sin(p * Math.PI);
  ctx.globalAlpha = flash * (kind === 'energy' || kind === 'tunnel' ? 0.13 : 0.06);
  ctx.fillStyle = kind === 'energy' ? '#a5f3fc' : '#d8b4fe';
  ctx.fillRect(520, 0, 760, CANVAS_H);
  ctx.restore();
}

function drawCinematicChrome(ctx: CanvasRenderingContext2D, scene: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(165,243,252,.18)';
  ctx.lineWidth = 1;
  line(ctx, [[585, 55], [635, 55]], 'rgba(165,243,252,.42)', 2);
  line(ctx, [[1165, 55], [1215, 55], [1215, 105]], 'rgba(165,243,252,.22)', 1);
  line(ctx, [[585, 665], [635, 665]], 'rgba(165,243,252,.22)', 1);
  ctx.fillStyle = 'rgba(165,243,252,.52)';
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`STAGE 0${scene + 1} / 05`, 1205, 78);
  ctx.restore();
}

function drawSceneLabel(ctx: CanvasRenderingContext2D, scene: number, alpha: number): void {
  const info = INTRO_SCENES[scene];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '800 24px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(info.title, 900, 92);
  ctx.fillStyle = '#c4b5fd';
  ctx.font = '500 15px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '0px';
  ctx.fillText(info.caption, 900, 122);
  ctx.restore();
}

function drawProgress(ctx: CanvasRenderingContext2D, active: number): void {
  const startX = 720;
  const y = 630;
  for (let i = 0; i < INTRO_SCENES.length; i++) {
    ctx.fillStyle = i === active ? '#22d3ee' : 'rgba(216,180,254,.28)';
    roundedRect(ctx, startX + i * 78, y, i === active ? 54 : 34, 4, 2);
    ctx.fill();
  }
}

function drawStaticOverview(ctx: CanvasRenderingContext2D): void {
  const y = 350;
  const xs = [655, 775, 895, 1015, 1135];
  for (let i = 0; i < xs.length; i++) {
    cell(ctx, xs[i], y, i === 0 ? 20 : 18, i >= 2);
    if (i < xs.length - 1) {
      line(ctx, [[xs[i] + 30, y], [xs[i + 1] - 30, y]], 'rgba(103,232,249,.6)', 3);
      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(xs[i + 1] - 30, y);
      ctx.lineTo(xs[i + 1] - 42, y - 7);
      ctx.lineTo(xs[i + 1] - 42, y + 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = i === 4 ? '#86efac' : '#d8b4fe';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(['COLLECT', 'SELECT', 'ENGINEER', 'EXPAND', 'INFUSE'][i], xs[i], y + 58);
  }
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '800 24px Inter, system-ui, sans-serif';
  ctx.fillText('THE CAR-T JOURNEY', 895, 170);
  ctx.fillStyle = '#c4b5fd';
  ctx.font = '500 15px Inter, system-ui, sans-serif';
  ctx.fillText('Collection · manufacturing · return to the patient', 895, 202);
}

export class IntroCutscene {
  render(ctx: CanvasRenderingContext2D, time: number, reducedMotion: boolean): void {
    drawBackdrop(ctx, time, reducedMotion);
    if (reducedMotion) {
      drawStaticOverview(ctx);
      return;
    }

    const timeline = introTimeline(time);
    const blend = timeline.transitionProgress;
    drawSceneWithCamera(
      ctx,
      timeline.scene,
      timeline.sceneProgress,
      1 - blend,
      timeline.camera,
    );
    if (blend > 0) {
      drawSceneWithCamera(
        ctx,
        timeline.nextScene,
        Math.max(0, (timeline.sceneProgress - 0.78) / 0.22),
        blend,
        { x: 0, y: 0, zoom: 0.96 + blend * 0.04 },
        true,
      );
    }
    drawTransition(ctx, timeline.transition, blend);
    drawSceneLabel(ctx, timeline.scene, 1 - blend);
    if (blend > 0) drawSceneLabel(ctx, timeline.nextScene, blend);
    drawProgress(ctx, blend > 0.5 ? timeline.nextScene : timeline.scene);
    drawCinematicChrome(ctx, blend > 0.5 ? timeline.nextScene : timeline.scene);
  }
}
