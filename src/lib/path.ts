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
  ['Cerebral microvasculature', 'blood–brain barrier', 'penetrating cortical vessel', 'perivascular space', 'periventricular white matter'],
  ['Choroid plexus', 'lateral ventricle', 'foramen of Monro', 'third ventricle', 'cerebral aqueduct', 'fourth ventricle', 'median and lateral apertures', 'basal cisterns'],
  ['Pial vessels', 'cerebral subarachnoid space', 'basal cisterns', 'foramen magnum', 'spinal subarachnoid space', 'lumbar cistern', 'cauda equina'],
] as const;

function buildCnsPaths(): PathDef[] {
  return [
    makePath([
      { x: -50, y: 150 }, { x: 120, y: 146 }, { x: 245, y: 165 },
      { x: 360, y: 205 }, { x: 485, y: 245 }, { x: 620, y: 280 },
      { x: 760, y: 300 }, { x: 900, y: 330 }, { x: 1060, y: 350 }, { x: 1330, y: 378 },
    ]),
    makePath([
      { x: -50, y: 300 }, { x: 120, y: 292 }, { x: 260, y: 305 },
      { x: 390, y: 325 }, { x: 500, y: 344 }, { x: 590, y: 360 },
      { x: 680, y: 390 }, { x: 760, y: 425 }, { x: 850, y: 455 },
      { x: 965, y: 470 }, { x: 1110, y: 492 }, { x: 1330, y: 520 },
    ]),
    makePath([
      { x: -50, y: 82 }, { x: 130, y: 90 }, { x: 285, y: 102 },
      { x: 455, y: 112 }, { x: 625, y: 135 }, { x: 790, y: 180 },
      { x: 900, y: 245 }, { x: 965, y: 315 }, { x: 1015, y: 400 },
      { x: 1060, y: 500 }, { x: 1130, y: 590 }, { x: 1330, y: 640 },
    ]),
  ];
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
