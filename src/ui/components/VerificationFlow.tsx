import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface VerificationFlowProps {
  challengeId: string;
  remoteIdentifier: string;
  onCancel: () => void;
}

/** Manages in-progress verification state with spinner and elapsed time */
export function VerificationFlow({ challengeId, remoteIdentifier, onCancel }: VerificationFlowProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [challengeId]);

  return (
    <div class="p-4 bg-gray-800 rounded-lg space-y-3">
      <div class="flex items-center gap-3">
        <div class="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full" />
        <div class="text-sm">
          <p class="text-white">Verification sent</p>
          <p class="text-gray-400">Waiting for {remoteIdentifier} to approve...</p>
        </div>
      </div>

      <div class="text-xs text-gray-500">{elapsed}s elapsed</div>

      {elapsed >= 60 && (
        <div class="text-xs text-amber-400">
          Verification is taking longer than expected. The remote party may not have received the request.
        </div>
      )}

      <button onClick={onCancel} class="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors">
        Cancel verification
      </button>
    </div>
  );
}
