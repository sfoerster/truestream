import { h } from 'preact';
import { useState } from 'preact/hooks';
import { TrustLevel } from '../../types/trust';
import { VinsiumAccountState } from '../../types/vinsium';

interface VerifyButtonProps {
  trustLevel: TrustLevel;
  accountState: VinsiumAccountState;
  disabled: boolean;
  onVerify: (remoteIdentifier: string) => void;
}

/** Primary CTA button for requesting Vinsium verification */
export function VerifyButton({ trustLevel, accountState, disabled, onVerify }: VerifyButtonProps) {
  const [showInput, setShowInput] = useState(false);
  const [identifier, setIdentifier] = useState('');

  if (trustLevel === 'confident' || trustLevel === 'verified') return null;

  if (accountState === 'not_connected') {
    return (
      <div class="text-center p-3 bg-gray-800 rounded-lg">
        <p class="text-sm text-gray-400 mb-2">Requires Vinsium subscription</p>
        <button onClick={() => chrome.runtime.openOptionsPage()} class="text-blue-400 text-sm underline">
          Connect Vinsium
        </button>
      </div>
    );
  }

  if (showInput) {
    return (
      <div class="space-y-2">
        <input
          type="text"
          placeholder="Enter their email or phone"
          value={identifier}
          onInput={(e) => setIdentifier((e.target as HTMLInputElement).value)}
          class="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm"
          autoFocus
        />
        <div class="flex gap-2">
          <button
            onClick={() => { if (identifier.trim()) { onVerify(identifier.trim()); setShowInput(false); setIdentifier(''); } }}
            disabled={!identifier.trim() || disabled}
            class="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            Send verification
          </button>
          <button onClick={() => setShowInput(false)} class="px-3 py-2 bg-gray-700 text-gray-300 rounded text-sm">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      disabled={disabled}
      class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
    >
      Verify this person →
      {accountState === 'free' && <span class="block text-xs text-blue-200 mt-1">Free tier</span>}
    </button>
  );
}
