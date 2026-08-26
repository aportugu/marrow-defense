// Visible enemy path(s) + free-placement validation. Marrow is one winding
// stream; hepatic is three lanes (portal vein, hepatic artery, biliary branch)
// that converge on a shared inferior vena cava base.
import type { LevelId, PlacementFailure, Tower, Vec } from '../game/types';
import { CANVAS_H, CANVAS_W } from '../game/types';
import { PLACEMENT } from '../game/Balance';

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

export function buildPaths(level: LevelId): PathDef[] {
  if (level === 'marrow') return [buildPath()];
  return buildLiverPaths();
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
