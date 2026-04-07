import { ScoredFrame, ScoredWindow } from '../../types/session';
import { weightedMovingAverage } from './smoothing';

/** Signal quality indicates which detection signals are available */
export type SignalQuality = 'full' | 'video_only' | 'audio_only' | 'insufficient';

/** Result of composite score computation */
export interface CompositeScoreResult {
  /** Combined trust score (0.0-1.0, higher = more trustworthy) */
  score: number;
  /** Video-only trust score (0.0-1.0) */
  videoScore: number;
  /** Audio-only trust score (0.0-1.0) */
  audioScore: number;
  /** Which signals are contributing to the composite */
  signalQuality: SignalQuality;
}

const VIDEO_WEIGHT = 0.6;
const AUDIO_WEIGHT = 0.4;
const VIDEO_WINDOW_SIZE = 16;
const AUDIO_WINDOW_SIZE = 10;
const RECENCY_BIAS = 0.6;
const MIN_SCORES_FOR_SIGNAL = 5;

/**
 * Computes a composite trust score from video and audio inference results.
 * Uses 60% video / 40% audio weighting when both signals are available,
 * falls back to 100% of whichever signal is present when only one is available.
 */
export class CompositeScorer {
  /**
   * Compute the composite trust score from rolling score arrays.
   */
  compute(videoScores: ScoredFrame[], audioScores: ScoredWindow[]): CompositeScoreResult {
    const totalScores = videoScores.length + audioScores.length;

    if (totalScores < MIN_SCORES_FOR_SIGNAL) {
      return { score: 0.5, videoScore: 0, audioScore: 0, signalQuality: 'insufficient' };
    }

    const hasVideo = videoScores.length >= 3;
    const hasAudio = audioScores.length >= 3;

    const videoScore = hasVideo
      ? weightedMovingAverage(videoScores.map((f) => f.real), VIDEO_WINDOW_SIZE, RECENCY_BIAS)
      : 0;

    const audioScore = hasAudio
      ? weightedMovingAverage(audioScores.map((w) => w.genuine), AUDIO_WINDOW_SIZE, RECENCY_BIAS)
      : 0;

    let score: number;
    let signalQuality: SignalQuality;

    if (hasVideo && hasAudio) {
      score = videoScore * VIDEO_WEIGHT + audioScore * AUDIO_WEIGHT;
      signalQuality = 'full';
    } else if (hasVideo) {
      score = videoScore;
      signalQuality = 'video_only';
    } else if (hasAudio) {
      score = audioScore;
      signalQuality = 'audio_only';
    } else {
      score = 0.5;
      signalQuality = 'insufficient';
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      videoScore: Math.max(0, Math.min(1, videoScore)),
      audioScore: Math.max(0, Math.min(1, audioScore)),
      signalQuality,
    };
  }
}
