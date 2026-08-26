import { describe, expect, it } from 'vitest';
import { buildPaths, canPlaceAt, distToLanePaths, distToPath, placementFailure, posAt } from './path';

describe('path', () => {
  const [p] = buildPaths('marrow');
  const marrow = [p];

  it('builds a long path with cumulative distances', () => {
    expect(p.points.length).toBeGreaterThan(50);
    expect(p.length).toBeGreaterThan(1000);
    expect(p.cum[0]).toBe(0);
    expect(p.cum[p.cum.length - 1]).toBeCloseTo(p.length);
  });

  it('posAt clamps to the path endpoints', () => {
    expect(posAt(p, -5)).toEqual(p.points[0]);
    expect(posAt(p, p.length + 5)).toEqual(p.points[p.points.length - 1]);
    expect(posAt(p, 0)).toEqual(p.points[0]);
  });

  it('distToPath is ~0 on the path and bounded by distance to any path point', () => {
    const onPath = posAt(p, 50);
    expect(distToPath(p, onPath.x, onPath.y)).toBeLessThan(1);
    for (let d = 0; d <= 100; d += 10) {
      const px = onPath.x + d;
      const py = onPath.y + d / 2;
      const toKnown = Math.hypot(d, d / 2);
      expect(distToPath(p, px, py)).toBeLessThanOrEqual(toKnown + 1);
    }
  });

  it('canPlaceAt enforces margins and path clearance', () => {
    expect(canPlaceAt(marrow, [], 20, 20)).toBe(false);
    expect(canPlaceAt(marrow, [], 1280, 720)).toBe(false);
    const onPath = posAt(p, 50);
    expect(canPlaceAt(marrow, [], onPath.x, onPath.y)).toBe(false);
    const off = posAt(p, 50);
    let fx = off.x;
    let fy = off.y;
    for (let d = 60; d < 400; d += 2) {
      fx = off.x + d;
      fy = off.y;
      if (distToLanePaths(marrow, fx, fy) > 48) break;
    }
    expect(canPlaceAt(marrow, [], fx, fy)).toBe(true);
  });

  it('canPlaceAt enforces spacing between units', () => {
    const anchor = posAt(p, 300);
    let x = anchor.x;
    for (let d = 60; d < 400; d += 2) {
      x = anchor.x + d;
      if (distToLanePaths(marrow, x, anchor.y) > 48) break;
    }
    if (!canPlaceAt(marrow, [], x, anchor.y)) return;
    const tower = {
      id: 1,
      type: 'bcma' as const,
      x,
      y: anchor.y,
      tier: 0 as const,
      cd: 0,
      targetId: null,
      strength: 1,
      wavesSurvived: 0,
      buffPower: 0,
    };
    expect(canPlaceAt(marrow, [tower], x + 20, anchor.y)).toBe(false);
    expect(canPlaceAt(marrow, [tower], x + 40, anchor.y)).toBe(true);
  });

  it('reports why placement is invalid', () => {
    expect(placementFailure(marrow, [], 10, 10)).toBe('bounds');
    const onPath = posAt(p, 200);
    expect(placementFailure(marrow, [], onPath.x, onPath.y)).toBe('path');
  });

  it('builds three converging lanes for the liver level', () => {
    const liver = buildPaths('liver');
    expect(liver.length).toBe(3);
    for (const lane of liver) {
      expect(lane.length).toBeGreaterThan(900);
      const end = posAt(lane, lane.length);
      expect(end.x).toBeGreaterThan(1200);
      expect(Math.abs(end.y - 720 * 0.52)).toBeLessThan(40);
    }
  });

  it('distToLanePaths returns the nearest lane distance', () => {
    const liver = buildPaths('liver');
    const [portal, artery] = liver;
    const onArtery = posAt(artery, 200);
    expect(distToLanePaths(liver, onArtery.x, onArtery.y)).toBeLessThan(1);
    expect(distToLanePaths(liver, onArtery.x, onArtery.y)).toBeLessThanOrEqual(distToPath(portal, onArtery.x, onArtery.y) + 1e-6);
  });
});
