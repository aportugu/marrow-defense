import { describe, expect, it } from 'vitest';
import { receptorCountForEnemy, shouldRenderIntro } from './Renderer';

describe('observable target biology', () => {
  it('renders standard cells with many receptors and BCMA-low cells sparsely', () => {
    expect(receptorCountForEnemy('standard')).toBe(12);
    expect(receptorCountForEnemy('bcmaLow')).toBe(3);
    expect(receptorCountForEnemy('standard')).toBeGreaterThan(receptorCountForEnemy('bcmaLow') * 3);
  });
});

describe('intro rendering selection', () => {
  it('uses the cutscene only for the initial menu phase', () => {
    expect(shouldRenderIntro('menu')).toBe(true);
    expect(shouldRenderIntro('playing')).toBe(false);
    expect(shouldRenderIntro('paused')).toBe(false);
    expect(shouldRenderIntro('won')).toBe(false);
    expect(shouldRenderIntro('lost')).toBe(false);
  });
});
