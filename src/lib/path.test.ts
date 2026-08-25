import { describe, expect, it } from 'vitest';
import { buildPath, canPlaceAt, distToPath, placementFailure, posAt } from './path';

describe('path', () => {
  const p = buildPath();

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
    expect(canPlaceAt(p, [], 20, 20)).toBe(false);
    expect(canPlaceAt(p, [], 1280, 720)).toBe(false);
    const onPath = posAt(p, 50);
    expect(canPlaceAt(p, [], onPath.x, onPath.y)).toBe(false);
    const off = posAt(p, 50);
    let fx = off.x;
    let fy = off.y;
    for (let d = 60; d < 400; d += 2) {
      fx = off.x + d;
      fy = off.y;
      if (distToPath(p, fx, fy) > 48) break;
    }
    expect(canPlaceAt(p, [], fx, fy)).toBe(true);
  });

  it('canPlaceAt enforces spacing between units', () => {
    const anchor = posAt(p, 300);
    let x = anchor.x;
    for (let d = 60; d < 400; d += 2) {
      x = anchor.x + d;
      if (distToPath(p, x, anchor.y) > 48) break;
    }
    if (!canPlaceAt(p, [], x, anchor.y)) return;
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
    expect(canPlaceAt(p, [tower], x + 20, anchor.y)).toBe(false);
    expect(canPlaceAt(p, [tower], x + 40, anchor.y)).toBe(true);
  });

  it('reports why placement is invalid', () => {
    expect(placementFailure(p, [], 10, 10)).toBe('bounds');
    const onPath = posAt(p, 200);
    expect(placementFailure(p, [], onPath.x, onPath.y)).toBe('path');
  });
});
