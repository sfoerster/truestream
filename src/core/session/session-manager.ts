/**
 * SessionManager orchestrates the full deepfake detection pipeline:
 * workers, taps, scoring, and trust state management.
 */

import { SessionState } from '../../types/session';
import { CompositeScorer } from '../scoring/composite-scorer';
import { TrustStateMachine } from '../scoring/trust-state-machine';
import { onMessage, sendMessage } from '../../messaging/typed-messaging';
import { ScoredFrame, ScoredWindow } from '../../types/session';

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
  startSession(platform: string): string {
    const sessionId = uuid();

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

    // Initialize inference workers
    this.videoWorker = new Worker(
      new URL('../workers/video-inference.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.audioWorker = new Worker(
      new URL('../workers/audio-inference.worker.ts', import.meta.url),
      { type: 'module' },
    );

    const videoModelPath = chrome.runtime.getURL('models/assets/video-efficientnet-b0.onnx');
    const audioModelPath = chrome.runtime.getURL('models/assets/audio-rawnet2-lite.onnx');

    this.videoWorker.postMessage({ type: 'init', modelPath: videoModelPath });
    this.audioWorker.postMessage({ type: 'init', modelPath: audioModelPath });

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

    // Listen for incoming frames and features from content scripts
    const removeVideoListener = onMessage('VIDEO_FRAME', (msg) => {
      if (msg.sessionId !== sessionId || !this.videoWorker) return;
      this.videoWorker.postMessage(msg);
    });

    const removeAudioListener = onMessage('AUDIO_FEATURES', (msg) => {
      if (msg.sessionId !== sessionId || !this.audioWorker) return;
      this.audioWorker.postMessage(msg);
    });

    this.cleanupFns.push(removeVideoListener, removeAudioListener);

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

  /** Persist session state to chrome.storage.session */
  private persistSession(): void {
    if (!this.session) return;
    chrome.storage.session
      .set({ truestream_session: JSON.parse(JSON.stringify(this.session)) })
      .catch(() => {});
  }
}
