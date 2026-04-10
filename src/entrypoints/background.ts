import { SessionManager } from '../core/session/session-manager';
import { onMessage } from '../messaging/typed-messaging';
import * as liveBridge from '../vinsium/bridge';
import { getAccountState } from '../vinsium/auth';

export default defineBackground(() => {
  let sessionManager: SessionManager | null = null;

  // Handle session lifecycle
  onMessage('SESSION_START', async (msg) => {
    // End any existing session
    if (sessionManager) {
      sessionManager.endSession();
    }

    sessionManager = new SessionManager();
    await sessionManager.startSession(msg.platform, msg.sessionId);

    // Open side panel if available
    try {
      if (chrome.sidePanel) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          await chrome.sidePanel.setOptions({ tabId: tab.id, enabled: true });
        }
      }
    } catch {
      // Side panel API may not be available
    }
  });

  onMessage('SESSION_END', () => {
    if (sessionManager) {
      sessionManager.endSession();
      sessionManager = null;
    }
  });

  // Handle Vinsium verification requests
  onMessage('VINSIUM_REQUEST_VERIFY', async (msg) => {
    const accountState = await getAccountState();
    if (accountState === 'not_connected') return;

    await liveBridge.requestVerification({
      sessionId: msg.sessionId,
      remoteIdentifier: msg.remoteIdentifier,
      initiatorId: 'local-user',
      callContext: sessionManager?.getSession()?.platform ?? 'unknown',
    });
  });

  onMessage('VINSIUM_CANCEL', async (msg) => {
    await liveBridge.cancelVerification(msg.challengeId);
  });

  // Auto-open side panel when trust drops below confident
  onMessage('TRUST_LEVEL_CHANGE', async (msg) => {
    if (msg.change.to === 'uncertain' || msg.change.to === 'suspicious' || msg.change.to === 'likely_synthetic') {
      try {
        if (chrome.sidePanel) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await (chrome.sidePanel as unknown as { open: (opts: { tabId: number }) => Promise<void> }).open({ tabId: tab.id });
          }
        }
      } catch {
        // Side panel may not be available
      }
    }
  });

  // Set up daily model update check
  chrome.alarms.create('model-update-check', { periodInMinutes: 24 * 60 });
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'model-update-check') {
      try {
        const { checkForUpdates, getAvailableUpdates, downloadUpdate } = await import('../models/updater');
        const hasUpdates = await checkForUpdates();
        if (hasUpdates) {
          const updates = await getAvailableUpdates();
          // Only download when no session is active
          if (!sessionManager?.getSession()) {
            for (const entry of updates) {
              await downloadUpdate(entry);
            }
          }
        }
      } catch {
        // Non-fatal: will retry on next alarm
      }
    }
  });
});
