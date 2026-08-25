import { describe, expect, it } from 'vitest';
import {
  INTRO_LOOP_SECONDS,
  INTRO_SCENE_SECONDS,
  introTimeline,
  shouldTriggerIntroCue,
} from './IntroCutscene';

describe('intro cutscene timeline', () => {
  it('selects each eight-beat scene at deterministic boundaries', () => {
    expect(introTimeline(0).scene).toBe(0);
    expect(introTimeline(INTRO_SCENE_SECONDS - 0.01).scene).toBe(0);
    expect(introTimeline(INTRO_SCENE_SECONDS + 0.001).scene).toBe(1);
    expect(introTimeline(INTRO_SCENE_SECONDS * 2 + 0.001).scene).toBe(2);
    expect(introTimeline(INTRO_SCENE_SECONDS * 3 + 0.001).scene).toBe(3);
    expect(introTimeline(INTRO_SCENE_SECONDS * 4 + 0.001).scene).toBe(4);
  });

  it('loops cleanly and supports negative or invalid time', () => {
    expect(introTimeline(INTRO_LOOP_SECONDS).scene).toBe(0);
    expect(introTimeline(INTRO_LOOP_SECONDS + INTRO_SCENE_SECONDS + 0.001).scene).toBe(1);
    expect(introTimeline(-0.01).scene).toBe(4);
    expect(introTimeline(Number.NaN).scene).toBe(0);
  });

  it('only blends near the end of a scene', () => {
    const sceneSeconds = INTRO_SCENE_SECONDS;
    expect(introTimeline(sceneSeconds * 0.5).transitionProgress).toBe(0);
    expect(introTimeline(sceneSeconds * 0.875).transitionProgress).toBeGreaterThan(0);
    expect(introTimeline(sceneSeconds - 0.01).transitionProgress).toBeGreaterThan(0.99);
    expect(introTimeline(sceneSeconds + 0.001).transitionProgress).toBe(0);
  });

  it('provides deterministic acts, transitions, and cinematic camera motion', () => {
    const sceneSeconds = INTRO_SCENE_SECONDS;
    expect(introTimeline(sceneSeconds * 0.1).act).toBe('buildup');
    expect(introTimeline(sceneSeconds * 0.5).act).toBe('reveal');
    expect(introTimeline(sceneSeconds * 0.875).act).toBe('transition');
    expect(introTimeline(sceneSeconds * 0.875).transition).toBe('flow');
    expect(introTimeline(sceneSeconds * 1.875).transition).toBe('vortex');
    expect(introTimeline(sceneSeconds * 0.5).camera.zoom).toBeGreaterThan(introTimeline(0).camera.zoom);
  });

  it('reserves the battle teaser for the final part of infusion', () => {
    const finalStart = INTRO_SCENE_SECONDS * 4;
    const sceneSeconds = INTRO_LOOP_SECONDS / 5;
    expect(introTimeline(finalStart).battleTeaser).toBe(false);
    expect(introTimeline(finalStart + sceneSeconds * 0.49).battleTeaser).toBe(false);
    expect(introTimeline(finalStart + sceneSeconds * 0.5 + 0.001).battleTeaser).toBe(true);
    expect(introTimeline(finalStart + sceneSeconds * 0.5 + 0.001).audioCue).toBe('introBattle');
  });

  it('deduplicates audio cues but permits them again on the next loop', () => {
    const first = introTimeline(0);
    expect(shouldTriggerIntroCue(null, first)).toBe(true);
    expect(shouldTriggerIntroCue(first.audioCueId, introTimeline(1))).toBe(false);
    expect(shouldTriggerIntroCue(first.audioCueId, introTimeline(INTRO_SCENE_SECONDS + 0.001))).toBe(true);
    expect(shouldTriggerIntroCue(first.audioCueId, introTimeline(INTRO_LOOP_SECONDS + 0.001))).toBe(true);
  });
});
