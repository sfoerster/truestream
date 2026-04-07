import { describe, it, expect, beforeEach } from 'vitest';
import { TrustStateMachine } from '../../../src/core/scoring/trust-state-machine';

describe('TrustStateMachine', () => {
  let sm: TrustStateMachine;

  beforeEach(() => {
    sm = new TrustStateMachine();
  });

  it('starts at initializing', () => {
    expect(sm.getLevel()).toBe('initializing');
  });

  it('transitions from initializing on first score', () => {
    const change = sm.update(0.8);
    expect(change).not.toBeNull();
    expect(change!.from).toBe('initializing');
    expect(change!.to).toBe('confident');
  });

  it('transitions to uncertain on first score below confident', () => {
    const change = sm.update(0.5);
    expect(change!.to).toBe('uncertain');
  });

  it('requires 3 consecutive scores to degrade', () => {
    sm.update(0.8); // -> confident
    expect(sm.update(0.5)).toBeNull(); // 1 below confident (0.75)
    expect(sm.update(0.5)).toBeNull(); // 2 below confident
    const change = sm.update(0.5); // 3 below confident -> should degrade
    expect(change).not.toBeNull();
    expect(change!.to).toBe('uncertain'); // 0.5 classifies as uncertain
  });

  it('requires 5 consecutive scores to recover', () => {
    sm.update(0.5); // -> uncertain
    expect(sm.update(0.8)).toBeNull(); // 1 clean
    expect(sm.update(0.8)).toBeNull(); // 2
    expect(sm.update(0.8)).toBeNull(); // 3
    expect(sm.update(0.8)).toBeNull(); // 4
    const change = sm.update(0.8); // 5 -> should recover
    expect(change).not.toBeNull();
    expect(change!.to).toBe('confident');
  });

  it('verified state cannot be entered via score updates', () => {
    sm.update(0.99);
    expect(sm.getLevel()).not.toBe('verified');
  });

  it('verified state entered via setVerified', () => {
    sm.update(0.5);
    const change = sm.setVerified({ valid: true, signatureVerified: true, attestationType: 'registered_device' });
    expect(change.to).toBe('verified');
    expect(sm.getLevel()).toBe('verified');
  });

  it('verified state is not revoked by low scores', () => {
    sm.update(0.5);
    sm.setVerified({ valid: true, signatureVerified: true, attestationType: 'registered_device' });
    sm.update(0.1);
    sm.update(0.1);
    sm.update(0.1);
    expect(sm.getLevel()).toBe('verified');
  });

  it('reset returns to initializing', () => {
    sm.update(0.8);
    sm.reset();
    expect(sm.getLevel()).toBe('initializing');
  });

  it('getHistory returns all transitions', () => {
    sm.update(0.8); // initializing -> confident
    sm.update(0.3); // 1 below confident threshold
    sm.update(0.3); // 2 below
    sm.update(0.3); // 3 below -> confident -> suspicious
    const history = sm.getHistory();
    expect(history.length).toBe(2); // initializing->confident, confident->suspicious
  });
});
