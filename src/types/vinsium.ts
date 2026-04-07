/** Request to initiate a verification challenge */
export interface ChallengeRequest {
  /** Session ID of the current call */
  sessionId: string;
  /** Identifier of the remote party (email, phone, etc.) */
  remoteIdentifier: string;
  /** Identifier of the user initiating verification */
  initiatorId: string;
  /** Context about the call (platform, duration, etc.) */
  callContext: string;
}

/** Response from the Vinsium API when a challenge is created */
export interface ChallengeResponse {
  /** Unique challenge identifier for polling */
  challengeId: string;
  /** When the challenge expires (epoch ms) */
  expiresAt: number;
}

/** Result of a completed attestation */
export interface AttestationResult {
  /** Whether the attestation is valid */
  valid: boolean;
  /** Name of the attested device, if registered */
  deviceName?: string;
  /** When attestation was performed (epoch ms) */
  attestedAt?: number;
  /** Whether the cryptographic signature was verified */
  signatureVerified: boolean;
  /** How the remote party was attested */
  attestationType: 'registered_device' | 'one_time_link';
  /** Fingerprint of the attesting device's public key */
  publicKeyFingerprint?: string;
}

/** Account connection state with Vinsium */
export type VinsiumAccountState = 'not_connected' | 'free' | 'subscribed';

/** Current Vinsium session state */
export interface VinsiumSession {
  /** Account connection state */
  accountState: VinsiumAccountState;
  /** Vinsium user ID */
  userId?: string;
  /** Authentication token */
  token?: string;
  /** Number of verifications remaining (for free tier) */
  verificationsRemaining?: number;
}
