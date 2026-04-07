import { create } from 'zustand';
import { SessionState, ScoredFrame, ScoredWindow } from '../types/session';
import { TrustLevel } from '../types/trust';
import { AttestationResult } from '../types/vinsium';

const MAX_VIDEO_SCORES = 200;
const MAX_AUDIO_SCORES = 100;

interface SessionStoreState {
  session: SessionState | null;
  setSession: (session: SessionState) => void;
  updateTrustLevel: (level: TrustLevel, score: number) => void;
  addVideoScore: (frame: ScoredFrame) => void;
  addAudioScore: (window: ScoredWindow) => void;
  setVerified: (attestation: AttestationResult) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  session: null,
  setSession: (session: SessionState) => {
    set({ session });
    persistSession(session);
  },
  updateTrustLevel: (level: TrustLevel, score: number) => {
    const current = get().session;
    if (!current) return;
    const updated = { ...current, trustLevel: level, compositeTrustScore: score };
    set({ session: updated });
    persistSession(updated);
  },
  addVideoScore: (frame: ScoredFrame) => {
    const current = get().session;
    if (!current) return;
    const videoScores = [...current.videoScores, frame].slice(-MAX_VIDEO_SCORES);
    const updated = { ...current, videoScores };
    set({ session: updated });
    persistSession(updated);
  },
  addAudioScore: (window: ScoredWindow) => {
    const current = get().session;
    if (!current) return;
    const audioScores = [...current.audioScores, window].slice(-MAX_AUDIO_SCORES);
    const updated = { ...current, audioScores };
    set({ session: updated });
    persistSession(updated);
  },
  setVerified: (attestation: AttestationResult) => {
    const current = get().session;
    if (!current) return;
    const updated: SessionState = {
      ...current,
      trustLevel: 'verified',
      verificationState: { status: 'verified', attestation },
      trustHistory: [...current.trustHistory, { timestamp: Date.now(), from: current.trustLevel, to: 'verified' as const, trigger: 'vinsium_verified' as const }],
    };
    set({ session: updated });
    persistSession(updated);
  },
  clearSession: () => {
    set({ session: null });
    chrome.storage.session.remove('truestream_session').catch(() => {});
  },
}));

function persistSession(session: SessionState): void {
  chrome.storage.session.set({ truestream_session: JSON.parse(JSON.stringify(session)) }).catch(() => {});
}

export async function hydrateSessionStore(): Promise<void> {
  try {
    const stored = await chrome.storage.session.get('truestream_session');
    if (stored.truestream_session) {
      useSessionStore.setState({ session: stored.truestream_session as SessionState });
    }
  } catch { /* non-fatal */ }
}
