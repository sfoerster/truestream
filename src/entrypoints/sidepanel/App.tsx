import { TrustIndicator } from '../../ui/components/TrustIndicator';
import { ScoreGauge } from '../../ui/components/ScoreGauge';
import { ScoreTimeline } from '../../ui/components/ScoreTimeline';
import { VerifyButton } from '../../ui/components/VerifyButton';
import { VerificationFlow } from '../../ui/components/VerificationFlow';
import { VerifiedBadge } from '../../ui/components/VerifiedBadge';
import { AccountGate } from '../../ui/components/AccountGate';
import { SessionReport } from '../../ui/components/SessionReport';
import { useSession } from '../../ui/hooks/useSession';
import { useTrustLevel } from '../../ui/hooks/useTrustLevel';
import { useVinsium } from '../../ui/hooks/useVinsium';

/** Root side panel component */
export function App() {
  const session = useSession();
  const trust = useTrustLevel();
  const vinsium = useVinsium();

  if (!session) {
    return (
      <div class="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h1 class="text-xl font-bold mb-2">TrueStream</h1>
        <p class="text-gray-400">Join a video call to start real-time deepfake detection.</p>
        <p class="text-gray-500 text-sm mt-4">Supported: Google Meet, Microsoft Teams, Zoom Web</p>
      </div>
    );
  }

  const verificationState = session.verificationState;
  const showVerifyButton = trust.level !== 'confident' && trust.level !== 'verified' &&
    (!verificationState || verificationState.status === 'idle' || verificationState.status === 'failed');
  const showVerificationFlow = verificationState?.status === 'pending';
  const showVerifiedBadge = trust.level === 'verified' && verificationState?.status === 'verified';

  return (
    <div class="flex flex-col gap-4 p-4 max-w-sm mx-auto">
      <TrustIndicator />
      <ScoreGauge score={trust.compositeScore} level={trust.level} />
      <ScoreTimeline scores={session.videoScores.map((s) => s.real)} />

      {showVerifyButton && (
        <VerifyButton trustLevel={trust.level} accountState={vinsium.accountState} disabled={false} onVerify={vinsium.requestVerification} />
      )}

      {showVerificationFlow && verificationState?.status === 'pending' && (
        <VerificationFlow challengeId={verificationState.challengeId} remoteIdentifier={verificationState.remoteIdentifier} onCancel={vinsium.cancelVerification} />
      )}

      {showVerifiedBadge && verificationState?.status === 'verified' && (
        <VerifiedBadge attestation={verificationState.attestation} />
      )}

      {vinsium.accountState === 'not_connected' && <AccountGate />}
      <SessionReport session={session} />
    </div>
  );
}
