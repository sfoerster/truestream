/**
 * SessionManager orchestrates the full deepfake detection pipeline:
 * workers, taps, scoring, and trust state management.
 */

import { SessionState } from '../../types/session';
import { CompositeScorer } from '../scoring/composite-scorer';
import { TrustStateMachine } from '../scoring/trust-state-machine';
import { onMessage, sendMessage } from '../../messaging/typed-messaging';
import { ScoredFrame, ScoredWindow } from '../../types/session';
import { load } from '../../models/loader';
import { clearStoredSession, setStoredSession } from './session-store';
import type { AttestationResult } from '../../types/vinsium';
import VideoInferenceWorker from '../workers/video-inference.worker?worker';
import AudioInferenceWorker from '../workers/audio-inference.worker?worker';

/** Generate a UUID v4 */
function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Manages the lifecycle of a detection session including inference
 * workers, composite scoring, and trust state transitions.
 */
export class SessionManager {
  private session: SessionState | null = null;
  private scorer = new CompositeScorer();
  private stateMachine = new TrustStateMachine();
  private videoWorker: Worker | null = null;
  private audioWorker: Worker | null = null;
  private cleanupFns: (() => void)[] = [];

  /**
   * Start a new detection session.
   * @returns The generated session ID
   */
  async startSession(platform: string, sessionId = uuid()): Promise<string> {

    this.session = {
      sessionId,
      platform,
      startTime: Date.now(),
      videoScores: [],
      audioScores: [],
      compositeTrustScore: 0.5,
      trustLevel: 'initializing',
      verificationState: null,
      trustHistory: [],
    };

    this.stateMachine.reset();

    const removeVideoListener = onMessage('VIDEO_FRAME', (msg) => {
      if (msg.sessionId !== sessionId || !this.videoWorker) return;
      this.videoWorker.postMessage(msg, [msg.frameData]);
    });

    const removeAudioListener = onMessage('AUDIO_FEATURES', (msg) => {
      if (msg.sessionId !== sessionId || !this.audioWorker) return;
      this.audioWorker.postMessage(msg, [msg.features]);
    });

    const removeVinsiumPendingListener = onMessage('VINSIUM_PENDING', (msg) => {
      if (msg.sessionId !== sessionId || !this.session) return;
      this.session.verificationState = {
        status: 'pending',
        challengeId: msg.challengeId,
        remoteIdentifier: msg.remoteIdentifier,
      };
      this.persistSession();
    });

    const removeVinsiumVerifiedListener = onMessage('VINSIUM_VERIFIED', (msg) => {
      if (msg.sessionId !== sessionId || !this.session) return;
      this.applyVerifiedAttestation(msg.attestation);
    });

    const removeVinsiumFailedListener = onMessage('VINSIUM_FAILED', (msg) => {
      if (msg.sessionId !== sessionId || !this.session) return;
      this.session.verificationState = {
        status: 'failed',
        reason: msg.reason,
      };
      this.persistSession();
    });

    this.cleanupFns.push(
      removeVideoListener,
      removeAudioListener,
      removeVinsiumPendingListener,
      removeVinsiumVerifiedListener,
      removeVinsiumFailedListener,
    );

    const [videoModelData, audioModelData] = await Promise.all([
      load('video-efficientnet-b0'),
      load('audio-rawnet2-lite'),
    ]);

    // Initialize inference workers
    this.videoWorker = new VideoInferenceWorker();
    this.audioWorker = new AudioInferenceWorker();

    this.videoWorker.postMessage({ type: 'init', modelData: videoModelData }, [videoModelData]);
    this.audioWorker.postMessage({ type: 'init', modelData: audioModelData }, [audioModelData]);

    // Listen for inference results from video worker
    this.videoWorker.onmessage = (event) => {
      if (!this.session) return;
      const msg = event.data;
      if (msg.type === 'INFERENCE_RESULT') {
        const frame: ScoredFrame = {
          timestamp: msg.timestamp,
          real: msg.result.real,
          fake: msg.result.fake,
          confidence: msg.result.confidence,
        };
        this.session.videoScores.push(frame);
        if (this.session.videoScores.length > 200) {
          this.session.videoScores = this.session.videoScores.slice(-200);
        }
        this.updateCompositeScore();
      }
    };

    // Listen for inference results from audio worker
    this.audioWorker.onmessage = (event) => {
      if (!this.session) return;
      const msg = event.data;
      if (msg.type === 'INFERENCE_RESULT') {
        const window: ScoredWindow = {
          timestamp: msg.timestamp,
          genuine: msg.result.genuine,
          spoofed: msg.result.spoofed,
          confidence: msg.result.confidence,
        };
        this.session.audioScores.push(window);
        if (this.session.audioScores.length > 100) {
          this.session.audioScores = this.session.audioScores.slice(-100);
        }
        this.updateCompositeScore();
      }
    };

    // Persist initial session state
    this.persistSession();

    return sessionId;
  }

  /** End the current session and return final state */
  endSession(): SessionState | null {
    const finalState = this.session ? { ...this.session } : null;

    this.videoWorker?.terminate();
    this.audioWorker?.terminate();
    this.videoWorker = null;
    this.audioWorker = null;

    for (const cleanup of this.cleanupFns) cleanup();
    this.cleanupFns = [];

    this.session = null;
    clearStoredSession().catch(() => {});
    return finalState;
  }

  /** Get the current session state */
  getSession(): SessionState | null {
    return this.session;
  }

  /** Update composite score and check for trust level transitions */
  private updateCompositeScore(): void {
    if (!this.session) return;

    const result = this.scorer.compute(this.session.videoScores, this.session.audioScores);
    this.session.compositeTrustScore = result.score;

    const change = this.stateMachine.update(result.score);
    if (change) {
      this.session.trustLevel = change.to;
      this.session.trustHistory.push(change);

      sendMessage({
        type: 'TRUST_LEVEL_CHANGE',
        sessionId: this.session.sessionId,
        change,
        currentScore: result.score,
      }).catch(() => {});
    }

    sendMessage({
      type: 'SCORE_UPDATE',
      sessionId: this.session.sessionId,
      compositeScore: result.score,
      videoScore: result.videoScore,
      audioScore: result.audioScore,
      signalQuality: result.signalQuality,
    }).catch(() => {});

    this.persistSession();
  }

  private applyVerifiedAttestation(attestation: AttestationResult): void {
    if (!this.session) return;

    this.session.verificationState = {
      status: 'verified',
      attestation,
    };

    const change = this.stateMachine.setVerified(attestation);
    this.session.trustLevel = change.to;
    this.session.trustHistory.push(change);

    sendMessage({
      type: 'TRUST_LEVEL_CHANGE',
      sessionId: this.session.sessionId,
      change,
      currentScore: this.session.compositeTrustScore,
    }).catch(() => {});

    this.persistSession();
  }

  /** Persist session state to chrome.storage.session */
  private persistSession(): void {
    if (!this.session) return;
    setStoredSession(this.session).catch(() => {});
  }
}
