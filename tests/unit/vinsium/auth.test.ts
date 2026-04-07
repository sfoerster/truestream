import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, clearToken, getAccountState } from '../../../src/vinsium/auth';

describe('vinsium/auth', () => {
  beforeEach(async () => {
    // Clear all storage between tests
    await chrome.storage.local.clear();
  });

  describe('getToken / setToken', () => {
    it('returns null when no token is stored', async () => {
      expect(await getToken()).toBeNull();
    });

    it('round-trips a token through encrypted storage', async () => {
      await setToken('my-secret-token');
      const retrieved = await getToken();
      expect(retrieved).toBe('my-secret-token');
    });

    it('stores token in encrypted form (not plaintext)', async () => {
      await setToken('plaintext-secret');
      const stored = await chrome.storage.local.get(null);
      // The stored values should not contain the plaintext token
      const allValues = JSON.stringify(stored);
      expect(allValues).not.toContain('plaintext-secret');
    });

    it('handles empty string token', async () => {
      await setToken('');
      const retrieved = await getToken();
      expect(retrieved).toBe('');
    });

    it('overwrites a previously stored token', async () => {
      await setToken('first-token');
      await setToken('second-token');
      expect(await getToken()).toBe('second-token');
    });
  });

  describe('clearToken', () => {
    it('removes the stored token', async () => {
      await setToken('to-be-cleared');
      await clearToken();
      expect(await getToken()).toBeNull();
    });

    it('is safe to call when no token exists', async () => {
      await expect(clearToken()).resolves.not.toThrow();
    });
  });

  describe('getAccountState', () => {
    it('returns not_connected when no token exists', async () => {
      expect(await getAccountState()).toBe('not_connected');
    });

    it('returns free when token exists but no account state cached', async () => {
      await setToken('some-token');
      expect(await getAccountState()).toBe('free');
    });

    it('returns cached account state when token and state exist', async () => {
      await setToken('some-token');
      await chrome.storage.local.set({ vinsium_account_state: 'subscribed' });
      expect(await getAccountState()).toBe('subscribed');
    });
  });
});
