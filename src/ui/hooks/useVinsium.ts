import { useCallback } from 'preact/hooks';
import { useVinsiumStore } from '../../store/vinsium-store';
import { sendMessage } from '../../messaging/typed-messaging';
import { useSession } from './useSession';
import { VinsiumAccountState } from '../../types/vinsium';

export interface UseVinsiumResult {
  accountState: VinsiumAccountState;
  pendingChallengeId: string | null;
  verificationsRemaining: number | null;
  requestVerification: (remoteIdentifier: string) => void;
  cancelVerification: () => void;
}

export function useVinsium(): UseVinsiumResult {
  const session = useSession();
  const { accountState, pendingChallengeId, verificationsRemaining } = useVinsiumStore();

  const requestVerification = useCallback((remoteIdentifier: string) => {
    if (!session) return;
    sendMessage({ type: 'VINSIUM_REQUEST_VERIFY', sessionId: session.sessionId, remoteIdentifier }).catch(() => {});
  }, [session]);

  const cancelVerification = useCallback(() => {
    if (!pendingChallengeId) return;
    sendMessage({ type: 'VINSIUM_CANCEL', challengeId: pendingChallengeId }).catch(() => {});
  }, [pendingChallengeId]);

  return { accountState, pendingChallengeId, verificationsRemaining, requestVerification, cancelVerification };
}
