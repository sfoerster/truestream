import { create } from 'zustand';
import { TrustBands, DEFAULT_TRUST_BANDS } from '../types/trust';

interface SettingsStoreState {
  trustBands: TrustBands;
  useStubBridge: boolean;
  showScoreNumerics: boolean;
  verificationCooldownSeconds: number;
  setTrustBands: (bands: Partial<TrustBands>) => void;
  setUseStubBridge: (value: boolean) => void;
  setShowScoreNumerics: (value: boolean) => void;
  setVerificationCooldownSeconds: (seconds: number) => void;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  trustBands: { ...DEFAULT_TRUST_BANDS },
  useStubBridge: false,
  showScoreNumerics: true,
  verificationCooldownSeconds: 60,
  setTrustBands: (bands: Partial<TrustBands>) => {
    const updated = { ...get().trustBands, ...bands };
    set({ trustBands: updated });
    persistSettings({ trustBands: updated });
  },
  setUseStubBridge: (value: boolean) => { set({ useStubBridge: value }); persistSettings({ useStubBridge: value }); },
  setShowScoreNumerics: (value: boolean) => { set({ showScoreNumerics: value }); persistSettings({ showScoreNumerics: value }); },
  setVerificationCooldownSeconds: (seconds: number) => { set({ verificationCooldownSeconds: seconds }); persistSettings({ verificationCooldownSeconds: seconds }); },
}));

function persistSettings(partial: Record<string, unknown>): void {
  const prefixed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(partial)) { prefixed[`truestream_settings_${key}`] = value; }
  chrome.storage.local.set(prefixed).catch(() => {});
}

export async function hydrateSettingsStore(): Promise<void> {
  try {
    const keys = ['truestream_settings_trustBands', 'truestream_settings_useStubBridge', 'truestream_settings_showScoreNumerics', 'truestream_settings_verificationCooldownSeconds'];
    const stored = await chrome.storage.local.get(keys);
    const updates: Partial<SettingsStoreState> = {};
    if (stored.truestream_settings_trustBands) updates.trustBands = stored.truestream_settings_trustBands as TrustBands;
    if (stored.truestream_settings_useStubBridge !== undefined) updates.useStubBridge = stored.truestream_settings_useStubBridge as boolean;
    if (stored.truestream_settings_showScoreNumerics !== undefined) updates.showScoreNumerics = stored.truestream_settings_showScoreNumerics as boolean;
    if (stored.truestream_settings_verificationCooldownSeconds !== undefined) updates.verificationCooldownSeconds = stored.truestream_settings_verificationCooldownSeconds as number;
    if (Object.keys(updates).length > 0) useSettingsStore.setState(updates);
  } catch { /* use defaults */ }
}
