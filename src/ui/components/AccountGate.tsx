

/** Shown when accountState === 'not_connected'. Explains Vinsium. */
export function AccountGate() {
  return (
    <div class="p-4 bg-gray-800 rounded-lg space-y-3">
      <h3 class="text-white font-semibold">Vinsium Identity Verification</h3>
      <p class="text-sm text-gray-400">
        When the AI analysis is uncertain, you can escalate to cryptographic identity verification
        through Vinsium. This sends a challenge to the other party's device, proving they are who
        they claim to be.
      </p>
      <p class="text-sm text-gray-400">
        Connect your Vinsium account to enable this feature.
      </p>
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        Connect Vinsium
      </button>
    </div>
  );
}
