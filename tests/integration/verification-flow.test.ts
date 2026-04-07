import { describe, it, expect, vi } from 'vitest';
import { requestVerification } from '../../src/vinsium/bridge.stub';

describe('Verification Flow Integration', () => {
  it('stub verification completes within timeout', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await requestVerification({ sessionId: 's1', remoteIdentifier: 'user@test.com', initiatorId: 'me', callContext: 'google-meet' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  }, 10_000);
});
