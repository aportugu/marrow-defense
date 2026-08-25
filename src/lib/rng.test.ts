import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';

describe('deterministic RNG', () => {
  it('repeats a sequence from the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
