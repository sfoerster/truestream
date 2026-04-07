import { useState, useEffect } from 'preact/hooks';
import { useSettingsStore, hydrateSettingsStore } from '../../store/settings-store';
import { getAccountState, clearToken } from '../../vinsium/auth';
import { VinsiumAccountState } from '../../types/vinsium';

/** Options page for Vinsium account and settings */
export function App() {
  const settings = useSettingsStore();
  const [accountState, setAccountState] = useState<VinsiumAccountState>('not_connected');

  useEffect(() => {
    hydrateSettingsStore();
    getAccountState().then(setAccountState);
  }, []);

  const handleDisconnect = async () => {
    await clearToken();
    setAccountState('not_connected');
  };

  const handleClearData = async () => {
    await chrome.storage.session.clear();
    await chrome.storage.local.remove([
      'truestream_settings_trustBands',
      'truestream_settings_showScoreNumerics',
      'truestream_settings_verificationCooldownSeconds',
    ]);
  };

  return (
    <div class="max-w-lg mx-auto p-6 space-y-8">
      <h1 class="text-2xl font-bold">TrueStream Settings</h1>

      {/* Vinsium Account */}
      <section class="space-y-3">
        <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">Vinsium Account</h2>
        <p class="text-sm text-gray-400">
          Status: <span class="text-white font-medium">{accountState === 'not_connected' ? 'Not connected' : accountState === 'free' ? 'Free tier' : 'Subscribed'}</span>
        </p>
        {accountState !== 'not_connected' && (
          <button onClick={handleDisconnect} class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors">
            Disconnect
          </button>
        )}
      </section>

      {/* Detection Sensitivity */}
      <section class="space-y-3">
        <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">Detection Sensitivity</h2>
        <div class="space-y-4">
          <div>
            <label class="text-sm text-gray-400 block mb-1">Confident threshold: {settings.trustBands.confidentThreshold.toFixed(2)}</label>
            <input type="range" min="0.5" max="0.95" step="0.05" value={settings.trustBands.confidentThreshold}
              onInput={(e) => settings.setTrustBands({ confidentThreshold: parseFloat((e.target as HTMLInputElement).value) })}
              class="w-full" />
          </div>
          <div>
            <label class="text-sm text-gray-400 block mb-1">Uncertain threshold: {settings.trustBands.uncertainLower.toFixed(2)}</label>
            <input type="range" min="0.2" max="0.6" step="0.05" value={settings.trustBands.uncertainLower}
              onInput={(e) => settings.setTrustBands({ uncertainLower: parseFloat((e.target as HTMLInputElement).value) })}
              class="w-full" />
          </div>
          <div>
            <label class="text-sm text-gray-400 block mb-1">Suspicious threshold: {settings.trustBands.suspiciousLower.toFixed(2)}</label>
            <input type="range" min="0.05" max="0.35" step="0.05" value={settings.trustBands.suspiciousLower}
              onInput={(e) => settings.setTrustBands({ suspiciousLower: parseFloat((e.target as HTMLInputElement).value) })}
              class="w-full" />
          </div>
        </div>
      </section>

      {/* Display */}
      <section class="space-y-3">
        <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">Display</h2>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.showScoreNumerics} onChange={(e) => settings.setShowScoreNumerics((e.target as HTMLInputElement).checked)} />
          <span class="text-gray-300">Show numeric scores</span>
        </label>
      </section>

      {/* Developer (dev mode only) */}
      {import.meta.env.DEV && (
        <section class="space-y-3">
          <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">Developer</h2>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.useStubBridge} onChange={(e) => settings.setUseStubBridge((e.target as HTMLInputElement).checked)} />
            <span class="text-gray-300">Use Vinsium stub bridge</span>
          </label>
        </section>
      )}

      {/* Privacy */}
      <section class="space-y-3">
        <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">Privacy</h2>
        <p class="text-sm text-gray-400">
          All video and audio analysis happens locally on your device. No media data ever leaves your browser.
          Only Vinsium verification requests (session ID and remote identifier) are sent to external servers.
        </p>
        <button onClick={handleClearData} class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors">
          Clear all session data
        </button>
      </section>
    </div>
  );
}
