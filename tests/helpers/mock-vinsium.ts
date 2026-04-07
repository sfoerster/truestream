import { AttestationResult, ChallengeResponse } from '../../src/types/vinsium';

export function createMockChallenge(): ChallengeResponse {
  return { challengeId: 'test-challenge-123', expiresAt: Date.now() + 90_000 };
}

export function createMockAttestation(overrides?: Partial<AttestationResult>): AttestationResult {
  return {
    valid: true,
    deviceName: 'Test Device',
    attestedAt: Date.now(),
    signatureVerified: true,
    attestationType: 'registered_device',
    publicKeyFingerprint: 'SHA256:test:abcdef',
    ...overrides,
  };
}
