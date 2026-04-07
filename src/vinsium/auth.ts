/**
 * Vinsium token management with encrypted storage using AES-GCM.
 */

import { VinsiumAccountState } from '../types/vinsium';

const TOKEN_KEY = 'vinsium_token_encrypted';
const TOKEN_IV_KEY = 'vinsium_token_iv';
const ACCOUNT_STATE_KEY = 'vinsium_account_state';
const INSTALL_KEY = 'vinsium_install_key';

/** Derive an AES-GCM key from the extension's install-bound secret */
async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get(INSTALL_KEY);
  let keyMaterial: ArrayBuffer;

  if (stored[INSTALL_KEY]) {
    keyMaterial = base64ToBuffer(stored[INSTALL_KEY] as string);
  } else {
    // Copy into a standalone ArrayBuffer — some runtimes return a
    // buffer-backed view that SubtleCrypto.importKey rejects.
    const raw = crypto.getRandomValues(new Uint8Array(32));
    keyMaterial = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    await chrome.storage.local.set({ [INSTALL_KEY]: bufferToBase64(keyMaterial) });
  }

  return crypto.subtle.importKey('raw', new Uint8Array(keyMaterial), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Retrieve the Vinsium auth token from encrypted storage */
export async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get([TOKEN_KEY, TOKEN_IV_KEY]);
  if (!stored[TOKEN_KEY] || !stored[TOKEN_IV_KEY]) return null;

  try {
    const key = await getEncryptionKey();
    const iv = new Uint8Array(base64ToBuffer(stored[TOKEN_IV_KEY] as string));
    const ciphertext = new Uint8Array(base64ToBuffer(stored[TOKEN_KEY] as string));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    await clearToken();
    return null;
  }
}

/** Store a Vinsium auth token in encrypted storage */
export async function setToken(token: string): Promise<void> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(token);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(encoded),
  );

  await chrome.storage.local.set({
    [TOKEN_KEY]: bufferToBase64(ciphertext),
    [TOKEN_IV_KEY]: bufferToBase64(iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength)),
  });
}

/** Remove the stored Vinsium token and reset account state */
export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, TOKEN_IV_KEY, ACCOUNT_STATE_KEY]);
}

/** Get the current Vinsium account state */
export async function getAccountState(): Promise<VinsiumAccountState> {
  const token = await getToken();
  if (!token) return 'not_connected';

  const stored = await chrome.storage.local.get(ACCOUNT_STATE_KEY);
  return (stored[ACCOUNT_STATE_KEY] as VinsiumAccountState) ?? 'free';
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
