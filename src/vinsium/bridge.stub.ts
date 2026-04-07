/**
 * Stub bridge for development - simulates Vinsium verification flow
 * before the live API is available.
 */

import { ChallengeRequest, AttestationResult } from './types';
import { sendMessage } from '../messaging/typed-messaging';

/** Whether to use the stub bridge (driven by import.meta.env.DEV) */
export const USE_STUB: boolean = import.meta.env.DEV ?? true;

const STUB_DELAY_MS = 4000;
const SUCCESS_PROBABILITY = 0.8;

/**
 * Stub requestVerification: waits 4s, then 80% success / 20% failure.
 */
export async function requestVerification(req: ChallengeRequest): Promise<void> {
  const challengeId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.warn('[VINSIUM STUB] Verification requested for:', req.remoteIdentifier);
  console.warn('[VINSIUM STUB] Challenge ID:', challengeId);

  await sendMessage({
    type: 'VINSIUM_PENDING',
    sessionId: req.sessionId,
    challengeId,
    remoteIdentifier: req.remoteIdentifier,
  });

  await new Promise((resolve) => setTimeout(resolve, STUB_DELAY_MS));

  if (Math.random() < SUCCESS_PROBABILITY) {
    const mockAttestation: AttestationResult = {
      valid: true,
      deviceName: 'Stub Device (Pixel 8 Pro)',
      attestedAt: Date.now(),
      signatureVerified: true,
      attestationType: 'registered_device',
      publicKeyFingerprint: 'SHA256:stub:' + Math.random().toString(36).slice(2, 10),
    };
    console.warn('[VINSIUM STUB] Verification SUCCEEDED');
    await sendMessage({ type: 'VINSIUM_VERIFIED', sessionId: req.sessionId, attestation: mockAttestation });
  } else {
    console.warn('[VINSIUM STUB] Verification FAILED (simulated decline)');
    await sendMessage({ type: 'VINSIUM_FAILED', sessionId: req.sessionId, reason: 'Remote party declined verification (stub)' });
  }
}

/** Cancel a stub verification */
export async function cancelVerification(challengeId: string): Promise<void> {
  console.warn('[VINSIUM STUB] Verification cancelled:', challengeId);
}
