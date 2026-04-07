/** Possible trust levels in the TrueStream trust ladder */
export type TrustLevel =
  | 'initializing'
  | 'confident'
  | 'uncertain'
  | 'suspicious'
  | 'likely_synthetic'
  | 'verified';

/** Configurable thresholds for trust level bands */
export interface TrustBands {
  /** Score at or above which the system reports confident (default 0.75) */
  confidentThreshold: number;
  /** Lower bound of the uncertain band (default 0.40) */
  uncertainLower: number;
  /** Lower bound of the suspicious band (default 0.15) */
  suspiciousLower: number;
}

/** Default trust band thresholds */
export const DEFAULT_TRUST_BANDS: TrustBands = {
  confidentThreshold: 0.75,
  uncertainLower: 0.40,
  suspiciousLower: 0.15,
};

/** Records a transition between trust levels */
export interface TrustLevelChange {
  /** When the transition occurred */
  timestamp: number;
  /** Previous trust level */
  from: TrustLevel;
  /** New trust level */
  to: TrustLevel;
  /** What caused the transition */
  trigger: 'score_change' | 'vinsium_verified' | 'vinsium_failed' | 'session_start';
}

/** State of the visual trust ring overlay */
export interface TrustRingState {
  /** Current trust level */
  level: TrustLevel;
  /** Current composite score */
  score: number;
  /** Whether the ring should pulse */
  pulsing: boolean;
}
