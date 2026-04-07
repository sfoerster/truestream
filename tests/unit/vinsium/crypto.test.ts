import { describe, it, expect } from 'vitest';
import { verifyAttestation, importPublicKey } from '../../../src/vinsium/crypto';

describe('verifyAttestation', () => {
  it('returns false for invalid signature', async () => {
    const result = await verifyAttestation('test payload', 'invalid-sig', '-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----');
    expect(result).toBe(false);
  });

  it('returns false for malformed PEM', async () => {
    const result = await verifyAttestation('test', 'dGVzdA==', 'not-a-pem');
    expect(result).toBe(false);
  });
});

describe('importPublicKey', () => {
  it('rejects invalid PEM', async () => {
    await expect(importPublicKey('not-a-real-key')).rejects.toThrow();
  });
});
