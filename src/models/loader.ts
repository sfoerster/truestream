import { ModelManifest, ModelManifestEntry, BUNDLED_MODELS, MODEL_MANIFEST_URL } from './registry';

/** Storage key prefix for cached model data */
const MODEL_CACHE_PREFIX = 'truestream_model_';

/**
 * Load an ONNX model, checking for cached updates first, then falling
 * back to the bundled version in web accessible resources.
 *
 * @param modelId - The model identifier (e.g., 'video-efficientnet-b0')
 * @returns The model data as an ArrayBuffer
 */
export async function load(modelId: string): Promise<ArrayBuffer> {
  // Check for a cached update first
  const cached = await loadFromCache(modelId);
  if (cached) {
    return cached;
  }

  try {
    return await loadBundled(modelId);
  } catch (error) {
    const downloaded = await downloadLatest(modelId);
    if (downloaded) {
      return downloaded;
    }
    throw error;
  }
}

/**
 * Load a model from chrome.storage.local cache (downloaded update).
 */
async function loadFromCache(modelId: string): Promise<ArrayBuffer | null> {
  try {
    const key = `${MODEL_CACHE_PREFIX}${modelId}`;
    const stored = await chrome.storage.local.get([key, `${key}_sha256`]);

    if (!stored[key]) return null;

    const data = base64ToArrayBuffer(stored[key] as string);
    const expectedSha = stored[`${key}_sha256`] as string | undefined;

    if (expectedSha) {
      const actualSha = await computeSha256(data);
      if (actualSha !== expectedSha) {
        console.warn(`[TrueStream] SHA-256 mismatch for cached model ${modelId}, using bundled`);
        await chrome.storage.local.remove([key, `${key}_sha256`]);
        return null;
      }
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Load a bundled model from the extension's web accessible resources.
 */
async function loadBundled(modelId: string): Promise<ArrayBuffer> {
  const version = BUNDLED_MODELS[modelId];
  if (!version) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const filename = `${modelId}.onnx`;
  const url = chrome.runtime.getURL(`models/assets/${filename}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load bundled model ${modelId}: ${response.status}`);
  }

  return response.arrayBuffer();
}

async function downloadLatest(modelId: string): Promise<ArrayBuffer | null> {
  const entry = await fetchManifestEntry(modelId);
  if (!entry) return null;

  const url = `https://models.truestream.app/v${entry.version}/${entry.filename}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.arrayBuffer();
  const isValid = await verifyIntegrity(data, entry);
  if (!isValid) return null;

  await chrome.storage.local.set({
    [`${MODEL_CACHE_PREFIX}${modelId}`]: arrayBufferToBase64(data),
    [`${MODEL_CACHE_PREFIX}${modelId}_sha256`]: entry.sha256,
    [`${MODEL_CACHE_PREFIX}${modelId}_version`]: entry.version,
  });

  return data;
}

/**
 * Verify a model's SHA-256 hash against an expected value.
 *
 * @param data - The model data
 * @param entry - The manifest entry with expected hash
 * @returns true if the hash matches
 */
export async function verifyIntegrity(
  data: ArrayBuffer,
  entry: ModelManifestEntry,
): Promise<boolean> {
  const actualSha = await computeSha256(data);
  return actualSha === entry.sha256;
}

/**
 * Compute the SHA-256 hash of an ArrayBuffer.
 */
async function computeSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a base64 string to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function fetchManifestEntry(modelId: string): Promise<ModelManifestEntry | null> {
  try {
    const response = await fetch(MODEL_MANIFEST_URL);
    if (!response.ok) return null;
    const manifest = (await response.json()) as ModelManifest;
    return manifest.models.find((entry) => entry.id === modelId) ?? null;
  } catch {
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
