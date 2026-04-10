import { TrustLevelChange } from '../types/trust';
import { AttestationResult } from '../types/vinsium';

/** Video frame captured from a media stream, ready for inference */
export interface VideoFrameMessage {
  type: 'VIDEO_FRAME';
  frameData: ArrayBuffer;
  timestamp: number;
  sessionId: string;
}

/** Audio features extracted from the audio worklet */
export interface AudioFeaturesMessage {
  type: 'AUDIO_FEATURES';
  features: ArrayBuffer;
  timestamp: number;
  sessionId: string;
}

/** Updated composite and per-signal scores */
export interface ScoreUpdateMessage {
  type: 'SCORE_UPDATE';
  sessionId: string;
  compositeScore: number;
  videoScore: number;
  audioScore: number;
  signalQuality: 'full' | 'video_only' | 'audio_only' | 'insufficient';
}

/** Trust level has changed */
export interface TrustLevelChangeMessage {
  type: 'TRUST_LEVEL_CHANGE';
  sessionId: string;
  change: TrustLevelChange;
  currentScore: number;
}

/** A new detection session has started */
export interface SessionStartMessage {
  type: 'SESSION_START';
  sessionId: string;
  platform: string;
}

/** The current detection session has ended */
export interface SessionEndMessage {
  type: 'SESSION_END';
  sessionId: string;
}

/** User requests Vinsium verification of the remote party */
export interface VinsiumRequestVerifyMessage {
  type: 'VINSIUM_REQUEST_VERIFY';
  sessionId: string;
  remoteIdentifier: string;
}

/** Vinsium verification completed successfully */
export interface VinsiumVerifiedMessage {
  type: 'VINSIUM_VERIFIED';
  sessionId: string;
  attestation: AttestationResult;
}

/** Vinsium verification failed */
export interface VinsiumFailedMessage {
  type: 'VINSIUM_FAILED';
  sessionId: string;
  reason: string;
}

/** Vinsium verification is pending */
export interface VinsiumPendingMessage {
  type: 'VINSIUM_PENDING';
  sessionId: string;
  challengeId: string;
  remoteIdentifier: string;
}

/** User-facing settings have changed */
export interface SettingsChangedMessage {
  type: 'SETTINGS_CHANGED';
  key: string;
  value: unknown;
}

/** An ML model has been updated */
export interface ModelUpdatedMessage {
  type: 'MODEL_UPDATED';
  modelId: string;
  version: string;
}

/** Cancel an in-flight Vinsium verification */
export interface VinsiumCancelMessage {
  type: 'VINSIUM_CANCEL';
  challengeId: string;
}

/** Discriminated union of all application messages */
export type AppMessage =
  | VideoFrameMessage
  | AudioFeaturesMessage
  | ScoreUpdateMessage
  | TrustLevelChangeMessage
  | SessionStartMessage
  | SessionEndMessage
  | VinsiumRequestVerifyMessage
  | VinsiumVerifiedMessage
  | VinsiumFailedMessage
  | VinsiumPendingMessage
  | SettingsChangedMessage
  | ModelUpdatedMessage
  | VinsiumCancelMessage;
