import { TrustLevel, TrustLevelChange, TrustBands, DEFAULT_TRUST_BANDS } from '../../types/trust';
import { AttestationResult } from '../../types/vinsium';
import { consecutiveThreshold } from './smoothing';

/** Number of consecutive anomalous scores required to degrade trust */
const DEGRADE_THRESHOLD = 3;
/** Number of consecutive clean scores required to recover trust */
const RECOVER_THRESHOLD = 5;

/** Maps a composite score to a trust level based on thresholds (no hysteresis) */
function classifyScore(
  score: number,
  bands: TrustBands,
): Exclude<TrustLevel, 'verified' | 'initializing'> {
  if (score >= bands.confidentThreshold) return 'confident';
  if (score >= bands.uncertainLower) return 'uncertain';
  if (score >= bands.suspiciousLower) return 'suspicious';
  return 'likely_synthetic';
}

/** Ordered trust levels from highest to lowest trust */
const TRUST_RANK: Record<Exclude<TrustLevel, 'verified' | 'initializing'>, number> = {
  confident: 3,
  uncertain: 2,
  suspicious: 1,
  likely_synthetic: 0,
};

/**
 * Manages transitions between trust levels with asymmetric hysteresis:
 * degrading requires 3 consecutive anomalous scores, recovering requires 5.
 * The 'verified' state can only be entered via cryptographic attestation
 * and is never revoked by ML score changes.
 */
export class TrustStateMachine {
  private currentLevel: TrustLevel = 'initializing';
  private history: TrustLevelChange[] = [];
  private recentScores: number[] = [];
  private bands: TrustBands;

  constructor(bands: TrustBands = DEFAULT_TRUST_BANDS) {
    this.bands = bands;
  }

  /** Get the current trust level */
  getLevel(): TrustLevel {
    return this.currentLevel;
  }

  /** Get the full history of trust level transitions */
  getHistory(): TrustLevelChange[] {
    return [...this.history];
  }

  /**
   * Process a new composite score and potentially transition trust levels.
   * Returns a TrustLevelChange if a transition occurred, null otherwise.
   */
  update(compositeScore: number): TrustLevelChange | null {
    this.recentScores.push(compositeScore);

    if (this.recentScores.length > 100) {
      this.recentScores = this.recentScores.slice(-50);
    }

    if (this.currentLevel === 'verified') {
      return null;
    }

    const targetLevel = classifyScore(compositeScore, this.bands);

    if (this.currentLevel === 'initializing') {
      return this.transition(targetLevel, 'score_change');
    }

    const currentRank =
      TRUST_RANK[this.currentLevel as Exclude<TrustLevel, 'verified' | 'initializing'>];
    const targetRank = TRUST_RANK[targetLevel];

    if (targetRank === currentRank) {
      return null;
    }

    if (targetRank < currentRank) {
      // For degradation, check if scores have been below the current level's threshold
      const currentLevelName = this.currentLevel as Exclude<TrustLevel, 'verified' | 'initializing'>;
      const threshold = this.getThresholdForLevel(currentLevelName);
      if (consecutiveThreshold(this.recentScores, DEGRADE_THRESHOLD, threshold, 'below')) {
        return this.transition(targetLevel, 'score_change');
      }
    }

    if (targetRank > currentRank) {
      // For recovery, check if scores have been above the target level's threshold
      const threshold = this.getThresholdForLevel(targetLevel);
      if (consecutiveThreshold(this.recentScores, RECOVER_THRESHOLD, threshold, 'above')) {
        return this.transition(targetLevel, 'score_change');
      }
    }

    return null;
  }

  /**
   * Set the trust level to 'verified' via cryptographic attestation.
   * This is the only way to enter the verified state.
   */
  setVerified(_attestation: AttestationResult): TrustLevelChange {
    return this.transition('verified', 'vinsium_verified');
  }

  /** Reset to 'initializing'. Clears recent scores but preserves history. */
  reset(): void {
    const change: TrustLevelChange = {
      timestamp: Date.now(),
      from: this.currentLevel,
      to: 'initializing',
      trigger: 'session_start',
    };
    this.history.push(change);
    this.currentLevel = 'initializing';
    this.recentScores = [];
  }

  private getThresholdForLevel(
    level: Exclude<TrustLevel, 'verified' | 'initializing'>,
  ): number {
    switch (level) {
      case 'confident':
        return this.bands.confidentThreshold;
      case 'uncertain':
        return this.bands.uncertainLower;
      case 'suspicious':
        return this.bands.suspiciousLower;
      case 'likely_synthetic':
        return 0;
    }
  }

  private transition(to: TrustLevel, trigger: TrustLevelChange['trigger']): TrustLevelChange {
    const change: TrustLevelChange = {
      timestamp: Date.now(),
      from: this.currentLevel,
      to,
      trigger,
    };
    this.history.push(change);
    this.currentLevel = to;
    return change;
  }
}
