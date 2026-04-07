# Privacy

TrueStream is built on a strict local-first privacy model. This document provides a comprehensive data inventory, describes what stays on your device, what leaves your device, details every network request the extension makes, breaks down `chrome.storage` usage, and addresses GDPR considerations.

---

## Core Principle

**No media data ever leaves your device.** Video frames and audio samples are processed entirely within your browser using locally-running ONNX models. Inference results (numeric scores) are stored locally and never transmitted to any server. The only data that leaves your device is related to model update checks (anonymous) and optional Vinsium cryptographic verification (contains only nonces and signatures, never media).

---

## Data Inventory

### Data That Stays Local

| Data | Storage Location | Lifetime | Purpose |
|------|-----------------|----------|---------|
| Video frames (`ImageBitmap`) | Worker memory only | Discarded immediately after inference | Input to EfficientNet-B0 face manipulation detection |
| Face crops (224x224 tensors) | Worker memory only | Discarded immediately after inference | Preprocessed input for ONNX model |
| Audio samples (`Float32Array`) | Worker/worklet memory only | Discarded immediately after inference | Input to RawNet2-lite voice synthesis detection |
| Per-frame inference scores | `chrome.storage.session` | Until browser closes | Trust level computation and hysteresis |
| Composite scores (per window) | `chrome.storage.session` | Until browser closes | Trust state machine input |
| Trust level history | `chrome.storage.session` | Until browser closes | Display in side panel, badge, and session report |
| Hysteresis counters | `chrome.storage.session` | Until browser closes | Asymmetric trust transition state (3 degrade / 5 recover) |
| Vinsium verification status | `chrome.storage.session` | Until browser closes | Tracks whether Verified level was achieved |
| Session metadata | `chrome.storage.session` | Until browser closes | Tab ID, platform name, start time, participant info |
| ONNX model files (INT8) | Extension storage (IndexedDB) | Until manually deleted or model update | EfficientNet-B0 (~5.8 MB) and RawNet2-lite (~1.4 MB) |
| Model version metadata | `chrome.storage.local` | Persistent | Version, SHA-256 hash, download timestamp per model |
| User preferences | `chrome.storage.local` | Persistent | Enabled platforms, thresholds, badge position, stub toggle |

### Data That Leaves Your Device

| Data | Destination | When | What Is Sent | Purpose |
|------|-------------|------|-------------|---------|
| Model manifest request | `models.truestream.dev` | Extension startup + every 24h | Nothing (anonymous GET) | Check for model updates |
| Model download | `models.truestream.dev` | User accepts update | Nothing (anonymous GET) | Download updated ONNX model files |
| Vinsium challenge | `api.vinsium.com` | User clicks "Verify" | Nonce, target account ID, challenger ID, session ID | Initiate identity verification |
| Vinsium poll | `api.vinsium.com` | Every 2s while challenge pending | Challenge ID (in URL path) | Check if remote party responded |
| Vinsium key lookup | `api.vinsium.com` | During verification | Account ID (in URL path) | Fetch registered public key for binding check |

---

## chrome.storage Breakdown

### chrome.storage.session

Session storage is automatically cleared when the browser closes. It is not accessible by other extensions, web pages, or any external process. TrueStream uses session storage for all ephemeral state that should not persist across browser restarts.

```typescript
interface SessionData {
  // Per-tab session state, keyed by tab ID
  sessions: Record<number, {
    tabId: number;
    platform: string;               // "meet" | "teams" | "zoom" | "whereby"
    startedAt: string;               // ISO-8601 timestamp
    currentTrustLevel: TrustLevel;   // "distrusted" | "uncertain" | "nominal" | "trusted" | "verified"
    hysteresis: {
      degradeCounter: number;        // 0-3, counts consecutive windows below current level
      recoverCounter: number;        // 0-5, counts consecutive windows above current level
      pendingLevel: TrustLevel | null;  // The level being transitioned to
    };
    scores: Array<{
      timestamp: string;             // ISO-8601
      videoScore: number | null;     // 0.0-1.0, null if video unavailable
      audioScore: number | null;     // 0.0-1.0, null if audio unavailable
      compositeScore: number;        // Weighted combination
    }>;
    vinsiumStatus: {
      verified: boolean;
      challengeId: string | null;
      verifiedAt: string | null;
      accountId: string | null;
    };
  }>;
}
```

### chrome.storage.local

Local storage persists across browser restarts but is **never synced** to Google's servers. TrueStream does not use `chrome.storage.sync` under any circumstances.

```typescript
interface LocalData {
  // User preferences
  preferences: {
    enabled: boolean;                    // Master on/off toggle
    platformsEnabled: {
      meet: boolean;                     // Default: true
      teams: boolean;                    // Default: true
      zoom: boolean;                     // Default: true
      whereby: boolean;                  // Default: true
    };
    showBadge: boolean;                  // Whether to show the overlay trust ring
    badgePosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    thresholds: {
      trusted: number;                   // Default: 0.85
      nominal: number;                   // Default: 0.50
      uncertain: number;                 // Default: 0.30
    };
    vinsiumStub: boolean;                // Use stub bridge for testing/offline
  };

  // Model metadata (NOT the model files themselves -- those are in IndexedDB)
  models: {
    video: {
      version: string;                   // e.g., "2.1.0"
      sha256: string;                    // Hash of the downloaded ONNX file
      downloadedAt: string;              // ISO-8601 timestamp
    };
    audio: {
      version: string;
      sha256: string;
      downloadedAt: string;
    };
    manifestVersion: string;             // e.g., "2025.04.01"
    lastCheckedAt: string;               // When the manifest was last fetched
  };
}
```

### What Is NOT Stored

TrueStream does **not** store:
- Video frames, face crops, or any image data beyond the moment of inference.
- Audio samples or spectrograms beyond the moment of inference.
- Feature vectors, embeddings, or intermediate neural network activations.
- Any data that could be used to reconstruct, identify, or re-identify a person from their biometric characteristics.
- Browsing history, bookmarks, or any data from outside the video call context.

---

## Network Requests Inventory

This is an exhaustive list of every network request TrueStream can make. There are no hidden endpoints, no analytics, no telemetry, and no crash reporting.

### 1. Model Manifest Check

- **URL:** `GET https://models.truestream.dev/manifest.json`
- **Frequency:** On extension startup, then every 24 hours.
- **Request headers:** Standard browser headers only. No authentication tokens, no cookies, no custom headers, no extension ID.
- **Request body:** None.
- **Response:** JSON manifest containing model version numbers, download URLs, SHA-256 hashes, and file sizes.
- **Data sent about the user:** None. The request is completely anonymous. The CDN sees a standard HTTPS request with no identifying information beyond the IP address (which is inherent to any network request).

### 2. Model Download

- **URL:** `GET https://models.truestream.dev/v{N}/{model_name}_int8.onnx`
- **Frequency:** Only when the user explicitly accepts a model update via the side panel.
- **Request headers:** Standard browser headers only.
- **Request body:** None.
- **Data sent about the user:** None.
- **Integrity:** The downloaded file's SHA-256 hash is verified against the manifest before the model is loaded.

### 3. Vinsium Challenge Initiation

- **URL:** `POST https://api.vinsium.com/v1/challenge`
- **Frequency:** Only when the user explicitly clicks the "Verify" button. Never automatic.
- **Request body:** A random 32-byte nonce (base64), the target Vinsium account identifier, the challenger's Vinsium account ID (if registered), and a session ID.
- **Data sent about the user:** The challenger's Vinsium account ID (if they have one). No media data, no inference scores, no browsing context, no call metadata.

### 4. Vinsium Challenge Poll

- **URL:** `GET https://api.vinsium.com/v1/challenge/{challenge_id}`
- **Frequency:** Every 2 seconds while a challenge is pending, up to the 60-second timeout (maximum 30 requests per challenge).
- **Request body:** None.
- **Data sent about the user:** The challenge ID is in the URL path. No other identifying information.

### 5. Vinsium Public Key Lookup

- **URL:** `GET https://api.vinsium.com/v1/accounts/{account_id}/public-key`
- **Frequency:** Once per successful challenge completion, to verify key binding.
- **Request body:** None.
- **Data sent about the user:** The target account ID is in the URL path.

---

## What TrueStream Does NOT Do

- Does **not** collect analytics, telemetry, or usage statistics of any kind.
- Does **not** use Google Analytics, Mixpanel, Sentry, Datadog, or any third-party tracking or monitoring service.
- Does **not** phone home on install, uninstall, update, or crash.
- Does **not** record, store, or transmit video or audio from your calls.
- Does **not** create or store biometric templates, face embeddings, or voiceprints.
- Does **not** access your browsing history, bookmarks, passwords, or other browser data.
- Does **not** inject advertisements or modify call content.
- Does **not** share any data with the video-calling platform (Meet, Teams, Zoom, Whereby).
- Does **not** use `chrome.storage.sync` (no data is synced to Google's servers).
- Does **not** use `chrome.identity` (no Google account access).
- Does **not** use `chrome.history`, `chrome.bookmarks`, or `chrome.cookies`.
- Does **not** communicate with any server other than `models.truestream.dev` (model CDN) and `api.vinsium.com` (optional verification service).

---

## Verification Data Lifecycle

When Vinsium verification succeeds, the following data is involved and subsequently discarded:

| Data | Origin | Used For | Retention |
|------|--------|----------|-----------|
| Nonce (32 bytes) | Generated locally via `crypto.getRandomValues()` | Challenge payload | Discarded after verification completes |
| Signature (64 bytes) | Produced by remote participant's Vinsium client | Ed25519 verification | Discarded after verification completes |
| Public key (32 bytes) | Fetched from Vinsium service | Signature and key binding verification | Discarded when session ends (browser close or tab close) |
| Account ID (string) | Provided by user when initiating verification | Displayed in side panel as verification result | Stored in `chrome.storage.session`, cleared on browser close |
| Challenge ID (UUID) | Returned by Vinsium service | Polling for challenge completion | Discarded after verification completes |

No verification data is stored persistently. All verification state lives in `chrome.storage.session`.

---

## GDPR Considerations

### Data Controller

The user is the data controller for all data processed by TrueStream. The extension processes data on behalf of the user, on the user's device, under the user's exclusive control. TrueStream's developers do not have access to any user data because no data is transmitted to TrueStream's infrastructure (the model CDN serves static files and does not log requests with identifying information).

### Lawful Basis

TrueStream processes data based on the user's **explicit consent**, demonstrated by the deliberate act of installing and enabling the extension. Processing can be stopped at any time by disabling or uninstalling the extension.

### Data Minimization

TrueStream processes only the minimum data necessary for deepfake detection:

- Only face regions are extracted from video frames, not the full frame content. Background, other participants, and screen shares are discarded during face detection.
- Only 2-second audio chunks are processed, not continuous recordings. Chunks are discarded immediately after inference.
- Inference outputs are single numeric scores (one floating-point number), not feature vectors, embeddings, or any representation that could be used for biometric identification or re-identification.

### Right to Erasure (Article 17)

All session data is automatically deleted when the browser closes (via `chrome.storage.session` semantics). User preferences can be erased by:

1. **Uninstalling the extension** -- removes all extension data including IndexedDB models, `chrome.storage.local`, and `chrome.storage.session`.
2. **Clicking "Clear all data"** in the extension options page -- resets preferences to defaults and clears all stored sessions and model metadata.
3. **Using Chrome's "Clear browsing data"** with the "Extensions" category selected.

There is no server-side data to request deletion of, because no user data is stored server-side.

### Data Protection Impact Assessment (DPIA)

Because TrueStream processes biometric data (face images for manipulation detection, voice audio for synthesis detection), organizations deploying TrueStream in an employment context may need to conduct a DPIA under GDPR Article 35. Key factors that reduce the risk profile:

- All biometric processing is local. No biometric data is transmitted or stored beyond the moment of inference.
- No biometric templates or embeddings are created. The models produce a single authenticity score, not an identity representation.
- The processing purpose is security (detecting manipulation), not identification or surveillance.
- The user has full control over enabling, disabling, and uninstalling the extension.

### Cross-Border Data Transfers

No media data or biometric data crosses borders. The only network flows that may involve cross-border data transfer are:

- **Model CDN requests** (`models.truestream.dev`), which may be served from any CDN edge location. These requests contain no personal data.
- **Vinsium API requests** (`api.vinsium.com`), which contain only cryptographic primitives (nonces, signatures, public keys) and account identifiers. These are not personal data under GDPR unless the account identifier is directly linkable to a natural person, which depends on Vinsium's own registration policy.

### Third-Party Sub-Processors

TrueStream does not use third-party sub-processors for user data processing. The model CDN serves static files. The Vinsium service is an optional, user-initiated integration governed by Vinsium's own privacy policy.
