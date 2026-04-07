import { describe, it, expect } from 'vitest';
import { CompositeScorer } from '../../../src/core/scoring/composite-scorer';
import { generateVideoScores, generateAudioScores } from '../../helpers/score-generators';

describe('CompositeScorer', () => {
  const scorer = new CompositeScorer();

  it('returns insufficient when fewer than 5 total scores', () => {
    const result = scorer.compute(generateVideoScores(2), generateAudioScores(1));
    expect(result.signalQuality).toBe('insufficient');
    expect(result.score).toBe(0.5);
  });

  it('returns full quality when both signals have enough scores', () => {
    const result = scorer.compute(generateVideoScores(10, 0.8), generateAudioScores(5, 0.8));
    expect(result.signalQuality).toBe('full');
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('returns video_only when only video has enough scores', () => {
    const result = scorer.compute(generateVideoScores(10, 0.8), generateAudioScores(1, 0.8));
    expect(result.signalQuality).toBe('video_only');
  });

  it('returns audio_only when only audio has enough scores', () => {
    const result = scorer.compute(generateVideoScores(1, 0.8), generateAudioScores(10, 0.8));
    expect(result.signalQuality).toBe('audio_only');
  });

  it('clamps score to [0, 1]', () => {
    const result = scorer.compute(generateVideoScores(10, 0.99), generateAudioScores(5, 0.99));
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
