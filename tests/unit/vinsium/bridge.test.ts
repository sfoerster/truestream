import { describe, it, expect, vi } from 'vitest';
import { requestVerification, cancelVerification } from '../../../src/vinsium/bridge.stub';

describe('VinsiumBridgeStub', () => {
  it('requestVerification resolves and sends messages', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await requestVerification({ sessionId: 'test-session', remoteIdentifier: 'test@example.com', initiatorId: 'user1', callContext: 'google-meet' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[VINSIUM STUB]'), expect.anything());
    consoleSpy.mockRestore();
  });

  it('cancelVerification logs cancellation', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await cancelVerification('test-challenge-id');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[VINSIUM STUB]'), expect.anything());
    consoleSpy.mockRestore();
  });
});
