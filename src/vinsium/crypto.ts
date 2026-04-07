/**
 * Client-side signature verification for Vinsium attestations using Web Crypto API.
 */

/**
 * Verify an attestation payload against Vinsium's published public key.
 * Uses RSASSA-PKCS1-v1_5 with SHA-256.
 */
export async function verifyAttestation(
  payload: string,
  signature: string,
  publicKeyPem: string,
): Promise<boolean> {
  try {
    const cryptoKey = await importPublicKey(publicKeyPem);
    const signatureBytes = base64ToArrayBuffer(signature);
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payload);

    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      payloadBytes,
    );
  } catch {
    return false;
  }
}

/**
 * Import a PEM-encoded RSA public key for use with SubtleCrypto.
 */
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');

  const binaryDer = base64ToArrayBuffer(pemContents);

  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

/** Convert a base64-encoded string to an ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
