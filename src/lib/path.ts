// Visible enemy path(s) + free-placement validation. Marrow is one winding
// stream; hepatic is three lanes (portal vein, hepatic artery, biliary branch)
// that converge on a shared inferior vena cava base.
import type { LevelId, PlacementFailure, Tower, UnitTypeId, Vec } from '../game/types';
import { CANVAS_H, CANVAS_W } from '../game/types';
import { PLACEMENT, UNIT } from '../game/Balance';

export interface PathDef {
  points: Vec[];
  cum: number[];
  length: number;
}

function makePath(points: Vec[]): PathDef {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, cum, length: cum[cum.length - 1] };
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

export function buildPath(): PathDef {
  const points: Vec[] = [];
  const start = -50;
  const end = CANVAS_W + 50;
  const step = 16;
  const midY = CANVAS_H * 0.52;
  for (let x = start; x <= end; x += step) {
    const y =
      midY +
      Math.sin(x * 0.008) * (CANVAS_H * 0.22) +
      Math.sin(x * 0.0023 + 1.2) * 46;
    points.push({ x, y });
  }
  return makePath(points);
}

interface LiverLane {
  midY: number;
  amp: number;
  secondAmp: number;
  freq: number;
  secondFreq: number;
  phase: number;
}

function laneY(lane: LiverLane, x: number): number {
  return (
    lane.midY +
    Math.sin(x * lane.freq) * lane.amp +
    Math.sin(x * lane.secondFreq + lane.phase) * lane.secondAmp
  );
}

function buildLiverPaths(): PathDef[] {
  const step = 16;
  const start = -50;
  const end = CANVAS_W + 50;
  const IVC_X = CANVAS_W + 50;
  const IVC_Y = CANVAS_H * 0.52;
  const CONVERGE_X = 1000;
  const lanes: LiverLane[] = [
    { midY: CANVAS_H * 0.27, amp: 44, secondAmp: 14, freq: 0.01, secondFreq: 0.0031, phase: 0.6 },
    { midY: CANVAS_H * 0.51, amp: 44, secondAmp: 14, freq: 0.008, secondFreq: 0.0023, phase: 1.2 },
    { midY: CANVAS_H * 0.75, amp: 38, secondAmp: 16, freq: 0.006, secondFreq: 0.004, phase: 2.4 },
  ];
  return lanes.map((lane) => {
    const pts: Vec[] = [];
    for (let x = start; x <= end; x += step) {
      let y: number;
      if (x <= CONVERGE_X) {
        y = laneY(lane, x);
      } else {
        const t = smoothstep((x - CONVERGE_X) / (IVC_X - CONVERGE_X));
        y = laneY(lane, CONVERGE_X) + (IVC_Y - laneY(lane, CONVERGE_X)) * t;
      }
      pts.push({ x, y });
    }
    return makePath(pts);
  });
}

export const CNS_ROUTE_STRUCTURES = [
  ['Spinal microvasculature', 'blood–spinal cord barrier', 'penetrating vessel', 'perivascular space', 'spinal white matter'],
  ['Choroid plexus', 'lateral ventricle', 'foramen of Monro', 'third ventricle', 'cerebral aqueduct', 'fourth ventricle', 'median and lateral apertures', 'basal cisterns', 'foramen magnum', 'spinal subarachnoid space', 'lumbar cistern'],
  ['Pial vessels', 'cerebral subarachnoid space', 'basal cisterns', 'foramen magnum', 'spinal subarachnoid space', 'lumbar cistern', 'cauda equina'],
] as const;

export type CnsRouteAnchor =
  | 'intramedullaryCore'
  | 'ventricular'
  | 'basalCisternal'
  | 'lumbarCistern';

// Named anatomical anchors keep stationary CNS objectives attached to their
// intended structures even when the presentation geometry changes.
const CNS_ANCHOR_POINTS: Record<CnsRouteAnchor, { lane: number; point: number }> = {
  intramedullaryCore: { lane: 0, point: 6 },
  ventricular: { lane: 1, point: 2 },
  basalCisternal: { lane: 1, point: 4 },
  lumbarCistern: { lane: 2, point: 10 },
};

function buildCnsPaths(): PathDef[] {
  return [
    // BBB/perivascular route entering the cord from a lateral microvascular
    // interface. The upstream cerebral origin is intentionally off-field.
    makePath([
      { x: -55, y: 160 }, { x: 100, y: 150 }, { x: 260, y: 180 },
      { x: 420, y: 210 }, { x: 580, y: 240 }, { x: 650, y: 280 },
      { x: 590, y: 350 }, { x: 690, y: 420 }, { x: 590, y: 500 },
      { x: 690, y: 580 }, { x: 640, y: 760 },
    ]),
    // Blood-CSF disease arrives from an upstream cranial origin at the top of
    // the field, then descends through the left spinal subarachnoid space.
    makePath([
      { x: -55, y: 70 }, { x: 100, y: 60 }, { x: 260, y: 80 },
      { x: 430, y: 110 }, { x: 550, y: 160 }, { x: 490, y: 250 },
      { x: 590, y: 340 }, { x: 490, y: 430 }, { x: 590, y: 520 },
      { x: 490, y: 610 }, { x: 520, y: 760 },
    ]),
    // Leptomeningeal disease enters from pial vessels on the opposite side and
    // spreads along the right spinal surface toward the cauda equina.
    makePath([
      { x: 1335, y: 70 }, { x: 1170, y: 60 }, { x: 1000, y: 80 },
      { x: 840, y: 110 }, { x: 730, y: 160 }, { x: 810, y: 240 },
      { x: 690, y: 320 }, { x: 810, y: 400 }, { x: 690, y: 480 },
      { x: 810, y: 560 }, { x: 690, y: 640 }, { x: 720, y: 760 },
    ]),
  ];
}

export function cnsRouteAnchor(paths: PathDef[], anchor: CnsRouteAnchor): { lane: number; pathPos: number; point: Vec } {
  const definition = CNS_ANCHOR_POINTS[anchor];
  const path = paths[definition.lane];
  const pointIndex = Math.min(definition.point, path.points.length - 1);
  return { lane: definition.lane, pathPos: path.cum[pointIndex], point: path.points[pointIndex] };
}

export function buildPaths(level: LevelId): PathDef[] {
  if (level === 'marrow') return [buildPath()];
  if (level === 'liver') return buildLiverPaths();
  return buildCnsPaths();
}

// Position (and implicit heading) at distance `d` along the path.
export function posAt(path: PathDef, d: number): Vec {
  const pts = path.points;
  if (d <= 0) return pts[0];
  if (d >= path.length) return pts[pts.length - 1];
  let lo = 0;
  let hi = path.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const a = pts[i - 1];
  const b = pts[i];
  const segLen = path.cum[i] - path.cum[i - 1] || 1;
  const t = (d - path.cum[i - 1]) / segLen;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// Distance from a point to the nearest point on the path polyline.
export function distToPath(path: PathDef, x: number, y: number): number {
  const pts = path.points;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((x - a.x) * abx + (y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) best = d;
  }
  return best;
}

// Distance from a point to the nearest of several lane polylines.
export function distToLanePaths(paths: PathDef[], x: number, y: number): number {
  let best = Infinity;
  for (const p of paths) {
    const d = distToPath(p, x, y);
    if (d < best) best = d;
  }
  return best;
}

// Whether a unit may be placed at (x, y) given the current towers.
export function canPlaceAt(
  paths: PathDef[],
  towers: Tower[],
  x: number,
  y: number,
): boolean {
  return placementFailure(paths, towers, x, y) === null;
}

export function placementFailure(
  paths: PathDef[],
  towers: Tower[],
  x: number,
  y: number,
): Exclude<PlacementFailure, 'funding'> | null {
  const { margin, pathClearance, unitGap } = PLACEMENT;
  if (x < margin || x > CANVAS_W - margin) return 'bounds';
  if (y < margin || y > CANVAS_H - margin) return 'bounds';
  if (distToLanePaths(paths, x, y) < pathClearance) return 'path';
  for (const t of towers) {
    if (Math.hypot(t.x - x, t.y - y) < unitGap) return 'overlap';
  }
  return null;
}

// Guided placements must be close enough to a lane to put the selected cell's
// firing range to immediate use. Normal play intentionally remains unrestricted.
export function guidedPlacementFailure(
  paths: PathDef[],
  towers: Tower[],
  type: UnitTypeId,
  x: number,
  y: number,
): Exclude<PlacementFailure, 'funding'> | null {
  const invalid = placementFailure(paths, towers, x, y);
  if (invalid) return invalid;
  if (distToLanePaths(paths, x, y) > UNIT[type].range * 0.8) return 'lane';
  return null;
}
