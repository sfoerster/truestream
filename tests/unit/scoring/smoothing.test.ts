import { describe, it, expect } from 'vitest';
import { weightedMovingAverage, consecutiveThreshold } from '../../../src/core/scoring/smoothing';

describe('weightedMovingAverage', () => {
  it('returns 0 for empty array', () => {
    expect(weightedMovingAverage([], 5, 0.5)).toBe(0);
  });

  it('returns the single value for single-element array', () => {
    expect(weightedMovingAverage([0.7], 5, 0.5)).toBe(0.7);
  });

  it('returns simple average when recencyBias is 0', () => {
    const values = [0.4, 0.6, 0.8];
    const result = weightedMovingAverage(values, 5, 0);
    expect(result).toBeCloseTo(0.6, 5);
  });

  it('weights recent values more when recencyBias is high', () => {
    const values = [0.2, 0.8];
    const lowBias = weightedMovingAverage(values, 5, 0.0);
    const highBias = weightedMovingAverage(values, 5, 1.0);
    expect(highBias).toBeGreaterThan(lowBias);
  });

  it('only considers the last windowSize values', () => {
    const values = [0.1, 0.1, 0.1, 0.9, 0.9, 0.9];
    const result = weightedMovingAverage(values, 3, 0);
    expect(result).toBeCloseTo(0.9, 5);
  });

  it('clamps recencyBias to [0, 1]', () => {
    const values = [0.5, 0.5];
    expect(weightedMovingAverage(values, 5, -1)).toBeCloseTo(0.5, 5);
    expect(weightedMovingAverage(values, 5, 2)).toBeCloseTo(0.5, 5);
  });
});

describe('consecutiveThreshold', () => {
  it('returns false when not enough values', () => {
    expect(consecutiveThreshold([0.9], 3, 0.5, 'above')).toBe(false);
  });

  it('returns true when all last N values are above threshold', () => {
    expect(consecutiveThreshold([0.1, 0.6, 0.7, 0.8], 3, 0.5, 'above')).toBe(true);
  });

  it('returns false when not all last N values are above threshold', () => {
    expect(consecutiveThreshold([0.1, 0.6, 0.4, 0.8], 3, 0.5, 'above')).toBe(false);
  });

  it('returns true when all last N values are below threshold', () => {
    expect(consecutiveThreshold([0.9, 0.3, 0.2, 0.1], 3, 0.5, 'below')).toBe(true);
  });

  it('returns false when not all last N values are below threshold', () => {
    expect(consecutiveThreshold([0.3, 0.2, 0.6, 0.1], 3, 0.5, 'below')).toBe(false);
  });

  it('handles exact threshold (not inclusive)', () => {
    expect(consecutiveThreshold([0.5, 0.5, 0.5], 3, 0.5, 'above')).toBe(false);
    expect(consecutiveThreshold([0.5, 0.5, 0.5], 3, 0.5, 'below')).toBe(false);
  });
});
