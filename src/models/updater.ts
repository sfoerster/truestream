import { ModelManifest, ModelManifestEntry, MODEL_MANIFEST_URL, BUNDLED_MODELS } from './registry';
import { verifyIntegrity } from './loader';

/** Storage key for cached manifest */
const MANIFEST_CACHE_KEY = 'truestream_model_manifest';
/** Storage key prefix for cached model data */
const MODEL_CACHE_PREFIX = 'truestream_model_';

/**
 * Check whether updated models are available by fetching the remote manifest.
 *
 * @returns true if at least one model has a newer version available
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    const manifest = await fetchManifest();
    if (!manifest) return false;

    for (const entry of manifest.models) {
      const currentVersion = await getCurrentVersion(entry.id);
      if (isNewerVersion(entry.version, currentVersion)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Download and cache a model update after verifying its integrity.
 *
 * @param entry - The manifest entry describing the model to download
 * @throws If the download fails or integrity check fails
 */
export async function downloadUpdate(entry: ModelManifestEntry): Promise<void> {
  const url = `https://models.truestream.app/v${entry.version}/${entry.filename}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download model ${entry.id}: ${response.status}`);
  }

  const data = await response.arrayBuffer();

  // Verify SHA-256 integrity
  const isValid = await verifyIntegrity(data, entry);
  if (!isValid) {
    throw new Error(`SHA-256 verification failed for model ${entry.id}`);
  }

  // Store in chrome.storage.local
  const key = `${MODEL_CACHE_PREFIX}${entry.id}`;
  const base64Data = arrayBufferToBase64(data);

  await chrome.storage.local.set({
    [key]: base64Data,
    [`${key}_sha256`]: entry.sha256,
    [`${key}_version`]: entry.version,
  });
}

/**
 * Get the list of available updates from the remote manifest.
 */
export async function getAvailableUpdates(): Promise<ModelManifestEntry[]> {
  const manifest = await fetchManifest();
  if (!manifest) return [];

  const updates: ModelManifestEntry[] = [];
  for (const entry of manifest.models) {
    const currentVersion = await getCurrentVersion(entry.id);
    if (isNewerVersion(entry.version, currentVersion)) {
      updates.push(entry);
    }
  }

  return updates;
}

/**
 * Fetch the remote model manifest.
 */
async function fetchManifest(): Promise<ModelManifest | null> {
  try {
    const response = await fetch(MODEL_MANIFEST_URL);
    if (!response.ok) return null;

    const manifest = (await response.json()) as ModelManifest;

    // Cache the manifest
    await chrome.storage.local.set({ [MANIFEST_CACHE_KEY]: manifest });

    return manifest;
  } catch {
    // Try cached manifest
    const stored = await chrome.storage.local.get(MANIFEST_CACHE_KEY);
    return (stored[MANIFEST_CACHE_KEY] as ModelManifest) ?? null;
  }
}

/**
 * Get the current version of a model (cached update or bundled).
 */
async function getCurrentVersion(modelId: string): Promise<string> {
  const key = `${MODEL_CACHE_PREFIX}${modelId}_version`;
  const stored = await chrome.storage.local.get(key);

  if (stored[key]) {
    return stored[key] as string;
  }

  return BUNDLED_MODELS[modelId] ?? '0.0.0';
}

/**
 * Compare semantic versions. Returns true if newVersion > currentVersion.
 */
function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [newParts, currentParts] = [parse(newVersion), parse(currentVersion)];

  for (let i = 0; i < 3; i++) {
    const n = newParts[i] ?? 0;
    const c = currentParts[i] ?? 0;
    if (n > c) return true;
    if (n < c) return false;
  }

  return false;
}

/**
 * Convert an ArrayBuffer to a base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
