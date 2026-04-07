import { TrustLevel, TrustLevelChange } from './trust';

/** A single scored video frame from inference */
export interface ScoredFrame {
  /** When the frame was captured */
  timestamp: number;
  /** Probability the frame is real (0.0-1.0) */
  real: number;
  /** Probability the frame is fake (0.0-1.0) */
  fake: number;
  /** Model confidence in its prediction (0.0-1.0) */
  confidence: number;
}

/** A single scored audio window from inference */
export interface ScoredWindow {
  /** When the audio window was captured */
  timestamp: number;
  /** Probability the audio is genuine (0.0-1.0) */
  genuine: number;
  /** Probability the audio is spoofed (0.0-1.0) */
  spoofed: number;
  /** Model confidence in its prediction (0.0-1.0) */
  confidence: number;
}

/** State of a verification attempt */
export type VerificationState =
  | { status: 'idle' }
  | { status: 'pending'; challengeId: string; remoteIdentifier: string }
  | { status: 'verified'; attestation: import('./vinsium').AttestationResult }
  | { status: 'failed'; reason: string };

/** Complete state of a detection session */
export interface SessionState {
  /** Unique identifier for this session */
  sessionId: string;
  /** Detected video call platform */
  platform: string;
  /** When the session started (epoch ms) */
  startTime: number;
  /** Rolling buffer of video frame scores */
  videoScores: ScoredFrame[];
  /** Rolling buffer of audio window scores */
  audioScores: ScoredWindow[];
  /** Current composite trust score (0.0-1.0) */
  compositeTrustScore: number;
  /** Current trust level */
  trustLevel: TrustLevel;
  /** Current verification state, if any */
  verificationState: VerificationState | null;
  /** History of trust level transitions */
  trustHistory: TrustLevelChange[];
}
