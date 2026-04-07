import { create } from 'zustand';
import { VinsiumAccountState } from '../types/vinsium';

interface VinsiumStoreState {
  accountState: VinsiumAccountState;
  verificationsRemaining: number | null;
  pendingChallengeId: string | null;
  pendingRemoteId: string | null;
  setAccountState: (state: VinsiumAccountState) => void;
  setVerificationsRemaining: (count: number | null) => void;
  setVerificationPending: (challengeId: string, remoteId: string) => void;
  clearVerification: () => void;
}

export const useVinsiumStore = create<VinsiumStoreState>((set) => ({
  accountState: 'not_connected',
  verificationsRemaining: null,
  pendingChallengeId: null,
  pendingRemoteId: null,
  setAccountState: (accountState: VinsiumAccountState) => set({ accountState }),
  setVerificationsRemaining: (count: number | null) => set({ verificationsRemaining: count }),
  setVerificationPending: (challengeId: string, remoteId: string) => set({ pendingChallengeId: challengeId, pendingRemoteId: remoteId }),
  clearVerification: () => set({ pendingChallengeId: null, pendingRemoteId: null }),
}));
