export type {
  ChallengeRequest,
  ChallengeResponse,
  AttestationResult,
  VinsiumAccountState,
  VinsiumSession,
} from '../types/vinsium';

/** Configuration for the Vinsium API client */
export interface VinsiumConfig {
  /** Base URL of the Vinsium API */
  apiBase: string;
  /** Polling interval in milliseconds */
  pollIntervalMs: number;
  /** Total timeout for a verification attempt in milliseconds */
  timeoutMs: number;
}

/** Default Vinsium configuration */
export const VINSIUM_CONFIG: VinsiumConfig = {
  apiBase: 'https://api.vinsium.com/v1',
  pollIntervalMs: 2000,
  timeoutMs: 90_000,
};
