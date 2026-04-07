/** A single model entry in the manifest */
export interface ModelManifestEntry {
  /** Unique model identifier */
  id: string;
  /** Semantic version string */
  version: string;
  /** Whether this is a video or audio model */
  type: 'video' | 'audio';
  /** Filename of the ONNX model */
  filename: string;
  /** SHA-256 hash of the model file for integrity verification */
  sha256: string;
  /** Size of the model file in bytes */
  sizeBytes: number;
  /** ISO 8601 release date */
  releasedAt: string;
}

/** The complete model manifest */
export interface ModelManifest {
  /** Schema version for forward compatibility */
  schemaVersion: number;
  /** Available models */
  models: ModelManifestEntry[];
  /** When this manifest was last updated (ISO 8601) */
  updatedAt: string;
}

/** URL of the model manifest */
export const MODEL_MANIFEST_URL = 'https://models.truestream.app/manifest.json';

/** Current bundled model versions */
export const BUNDLED_MODELS: Record<string, string> = {
  'video-efficientnet-b0': '1.0.0',
  'audio-rawnet2-lite': '1.0.0',
};
