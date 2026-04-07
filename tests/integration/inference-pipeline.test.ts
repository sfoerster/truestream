import { describe, it, expect } from 'vitest';
import { CompositeScorer } from '../../src/core/scoring/composite-scorer';
import { TrustStateMachine } from '../../src/core/scoring/trust-state-machine';
import { generateVideoScores, generateAudioScores } from '../helpers/score-generators';

describe('Inference Pipeline Integration', () => {
  it('full pipeline from scores to trust level', () => {
    const scorer = new CompositeScorer();
    const sm = new TrustStateMachine();

    // Simulate a session with high confidence scores
    const videoScores = generateVideoScores(20, 0.85);
    const audioScores = generateAudioScores(10, 0.9);

    const result = scorer.compute(videoScores, audioScores);
    expect(result.signalQuality).toBe('full');
    expect(result.score).toBeGreaterThan(0.7);

    const change = sm.update(result.score);
    expect(change).not.toBeNull();
    expect(sm.getLevel()).toBe('confident');
  });

  it('detects low-confidence session', () => {
    const scorer = new CompositeScorer();
    const sm = new TrustStateMachine();

    const videoScores = generateVideoScores(20, 0.3);
    const audioScores = generateAudioScores(10, 0.2);

    const result = scorer.compute(videoScores, audioScores);
    sm.update(result.score);
    expect(['suspicious', 'likely_synthetic', 'uncertain']).toContain(sm.getLevel());
  });
});
