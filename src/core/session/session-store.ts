/**
 * Simple session state persistence wrapper around chrome.storage.session.
 */

import { SessionState } from '../../types/session';

const STORAGE_KEY = 'truestream_session';

/** Get the current session state from chrome.storage.session */
export async function getStoredSession(): Promise<SessionState | null> {
  const stored = await chrome.storage.session.get(STORAGE_KEY);
  return (stored[STORAGE_KEY] as SessionState) ?? null;
}

/** Persist session state to chrome.storage.session */
export async function setStoredSession(session: SessionState): Promise<void> {
  await chrome.storage.session.set({
    [STORAGE_KEY]: JSON.parse(JSON.stringify(session)),
  });
}

/** Clear the stored session state */
export async function clearStoredSession(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY);
}
