/**
 * Live Vinsium bridge - handles verification challenge flow with the Vinsium API.
 */

import { ChallengeRequest, ChallengeResponse, AttestationResult, VINSIUM_CONFIG } from './types';
import { verifyAttestation } from './crypto';
import { getToken } from './auth';
import { sendMessage } from '../messaging/typed-messaging';

const VINSIUM_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzV9R7cHfR8W1y0hJ3YBk
mKb0s3V6hNkR5nL9t5y7x8PqWJ2Y4R6H1W3K5aXQVnM8vLmD9cF4J6xO5K7DqNp
QwVJN2bKjZ5z3K2mV6j5N3YKxHfJLQ8kRWEz6nFhGP7EXjBmqZbOFkQKPT7RKYQ
vjmI5mO3YHKbGkWDVnSJYfQpXTGZ6yEh5LVJnMFJOC0GxDMzY5vO8VhGOPKTMB7
lDfNPjbY8OZWZ1eGq5c6V9wSJk7TFY0aHMIqWH3Gq0tKJL5f0rc2OQHXWT8LP7K
jD5FMn3jHv7R2PBCzDZVQ9YrWFMz7GPJT5cXOJN8WQKhPaJDRmP8C4vLGt9TSCO
TQIDAQAB
-----END PUBLIC KEY-----`;

const FETCH_TIMEOUT_MS = 10_000;
let pollAbortController: AbortController | null = null;

async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error('No Vinsium authentication token available');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function pollChallenge(challengeId: string, sessionId: string): Promise<void> {
  const startTime = Date.now();
  let interval = VINSIUM_CONFIG.pollIntervalMs;
  pollAbortController = new AbortController();

  while (Date.now() - startTime < VINSIUM_CONFIG.timeoutMs) {
    if (pollAbortController.signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
    if (pollAbortController.signal.aborted) return;

    try {
      const response = await authenticatedFetch(`${VINSIUM_CONFIG.apiBase}/challenge/${challengeId}`);
      if (!response.ok) {
        if (response.status === 404) {
          await sendMessage({ type: 'VINSIUM_FAILED', sessionId, reason: 'Challenge expired or was cancelled' });
          return;
        }
        interval = Math.min(interval * 1.5, 10_000);
        continue;
      }

      const data = (await response.json()) as {
        status: 'pending' | 'completed' | 'declined';
        attestation?: { payload: string; signature: string; result: AttestationResult };
        reason?: string;
      };

      if (data.status === 'completed' && data.attestation) {
        const isValid = await verifyAttestation(data.attestation.payload, data.attestation.signature, VINSIUM_PUBLIC_KEY);
        await sendMessage(isValid
          ? { type: 'VINSIUM_VERIFIED', sessionId, attestation: { ...data.attestation.result, signatureVerified: true } }
          : { type: 'VINSIUM_FAILED', sessionId, reason: 'Attestation signature verification failed' });
        return;
      }
      if (data.status === 'declined') {
        await sendMessage({ type: 'VINSIUM_FAILED', sessionId, reason: data.reason ?? 'Verification declined' });
        return;
      }
      interval = Math.min(interval * 1.5, 10_000);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      interval = Math.min(interval * 1.5, 10_000);
    }
  }
  await sendMessage({ type: 'VINSIUM_FAILED', sessionId, reason: 'Verification timed out after 90 seconds' });
}

/** Request cryptographic verification of a remote party */
export async function requestVerification(req: ChallengeRequest): Promise<void> {
  const response = await authenticatedFetch(`${VINSIUM_CONFIG.apiBase}/challenge`, {
    method: 'POST', body: JSON.stringify(req),
  });
  if (!response.ok) {
    await sendMessage({ type: 'VINSIUM_FAILED', sessionId: req.sessionId, reason: `Challenge request failed: ${response.status}` });
    return;
  }
  const challenge = (await response.json()) as ChallengeResponse;
  await sendMessage({ type: 'VINSIUM_PENDING', sessionId: req.sessionId, challengeId: challenge.challengeId, remoteIdentifier: req.remoteIdentifier });
  pollChallenge(challenge.challengeId, req.sessionId);
}

/** Cancel an in-flight verification challenge */
export async function cancelVerification(challengeId: string): Promise<void> {
  if (pollAbortController) { pollAbortController.abort(); pollAbortController = null; }
  try { await authenticatedFetch(`${VINSIUM_CONFIG.apiBase}/challenge/${challengeId}`, { method: 'DELETE' }); } catch { /* best effort */ }
}
