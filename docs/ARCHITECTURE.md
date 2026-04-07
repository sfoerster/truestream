# Architecture

This document describes the internal architecture of TrueStream, a Chrome extension that performs real-time deepfake detection on video calls using local ONNX inference and optional cryptographic identity verification via Vinsium.

---

## System Diagram

```
+------------------------------------------------------------------------+
|  Browser Tab (Video Call Page)                                         |
|                                                                        |
|  +--------------------+       +--------------------+                   |
|  | Platform Adapter   |       | Overlay            |                   |
|  | (Meet/Teams/Zoom)  |       | TrustRing +        |                   |
|  | detector.ts        |       | PositionTracker    |                   |
|  +---------+----------+       +---------+----------+                   |
|            |                            ^                              |
|            | detects call,              | trust level                  |
|            | locates tracks             | updates                     |
|            v                            |                              |
|  +---------+----------+       +---------+----------+                   |
|  | RTC Patch          |       | Content Script     |                   |
|  | (rtc-patch.ts)     +------>| (content.ts)       |                   |
|  | + ElementFallback  |       | message relay      |                   |
|  +---------+----------+       +---------+----------+                   |
|            |                            ^                              |
+------------+----------------------------+------------------------------+
|            | ImageBitmap / Float32Array  | TRUST_UPDATE / scores        |
|            v                            |                              |
|  +---------+----------+       +---------+----------+                   |
|  | VideoTap           |       | Service Worker     |                   |
|  | (video-tap.ts)     |       | (background.ts)    |                   |
|  +--------------------+       +--------------------+                   |
|  | AudioTap           |                ^                               |
|  | (audio-tap.ts)     |                |                               |
|  +---------+----------+                |                               |
|            |                           |                               |
+------------+---------------------------+-------------------------------+
             | frames / audio chunks     |
             v                           |
+------------+---------------------------+-------------------------------+
|  Workers & Scoring Pipeline                                            |
|                                                                        |
|  +--------------------+       +--------------------+                   |
|  | Video Inference    |       | Audio Inference    |                   |
|  | Worker             |       | Worker             |                   |
|  | (ONNX Runtime WASM)|       | (ONNX Runtime WASM)|                   |
|  | EfficientNet-B0    |       | RawNet2-lite       |                   |
|  +---------+----------+       +---------+----------+                   |
|            |                            |                              |
|            | video_score                | audio_score                  |
|            v                            v                              |
|  +---------+----------------------------+----------+                   |
|  | CompositeScorer (composite-scorer.ts)           |                   |
|  | 60% video + 40% audio (configurable)            |                   |
|  +---------+---------------------------------------+                   |
|            |                                                           |
|            | composite_score                                           |
|            v                                                           |
|  +---------+---------------------------------------+                   |
|  | TrustStateMachine (trust-state-machine.ts)      |                   |
|  | Hysteresis: 3 to degrade, 5 to recover          |                   |
|  | Levels: Distrusted < Uncertain < Nominal <      |                   |
|  |         Trusted < Verified                      |                   |
|  +---------+---------------------------------------+                   |
|            |                                                           |
|            | trust_level                                               |
|            v                                                           |
|  +---------+----------+       +--------------------+                   |
|  | SessionManager     |<----->| Vinsium Bridge     |                   |
|  | (session-manager.ts|       | (bridge.ts /       |                   |
|  |  session-store.ts) |       |  bridge.stub.ts)   |                   |
|  +---------+----------+       +---------+----------+                   |
|            |                            |                              |
+------------+----------------------------+------------------------------+
             |                            |
             v                            v
   +---------+----------+      +---------+----------+
   | chrome.storage      |      | Vinsium Service    |
   | .session / .local   |      | (external, opt.)   |
   +---------------------+      +--------------------+
                                          |
                                +---------+----------+
                                | Model Manifest CDN |
                                | (read-only)        |
                                +--------------------+
```

---

## Components

### Platform Adapters (`src/platform/adapters/`)

Each supported video-calling platform has a dedicated adapter. The platform detector (`src/platform/detector.ts`) determines which adapter to activate based on the current URL. Adapters implement a common `PlatformAdapter` interface and are responsible for:

- Detecting that a call is active on the current page via DOM observation.
- Locating the DOM elements that contain video and audio streams.
- Providing platform-specific CSS selectors and lifecycle hooks.
- Handling platform-specific quirks (e.g., Zoom's canvas-based rendering, Teams' frequent track renegotiation).

Current adapters: `google-meet.ts`, `teams-web.ts`, `zoom-web.ts`. Whereby support is planned.

### WebRTC Interceptor (`src/core/interceptor/`)

The interceptor consists of two modules:

- **`rtc-patch.ts`**: Patches the global `RTCPeerConnection` constructor before the page's own scripts execute. It wraps `addTrack`, `addTransceiver`, and the `ontrack` event to capture references to media tracks as they are attached. The interceptor does not modify tracks or introduce latency; it only observes.
- **`element-fallback.ts`**: For platforms that block Insertable Streams (like Zoom), this module captures frames from rendered `<video>` or `<canvas>` elements using `requestVideoFrameCallback` or canvas `getContext('2d').drawImage()`.

For platforms that support Insertable Streams (Encoded Transforms), the interceptor uses `RTCRtpReceiver.createEncodedStreams()` to access raw decoded frames with zero copy overhead.

### Taps (`src/core/taps/`)

Taps are lightweight frame and audio extractors that manage their own cadence and back-pressure:

- **`video-tap.ts`**: Pulls video frames at a target rate of 1 fps and forwards `ImageBitmap` objects to the video inference worker. If the worker is busy, frames are dropped rather than queued to avoid memory pressure.
- **`audio-tap.ts`**: Coordinates with the `AudioWorkletNode` to extract PCM chunks and forwards `Float32Array` buffers (2 seconds at 16 kHz = 32,000 samples) to the audio inference worker.

### Audio Processor Worklet (`src/core/workers/audio-processor.worklet.ts`)

An `AudioWorkletProcessor` that runs on the browser's audio rendering thread. It accumulates raw PCM samples from the audio track and posts completed buffers to the audio tap via the worklet's message port. Running on the audio thread ensures no samples are dropped due to main-thread congestion.

### Inference Workers (`src/core/workers/`)

Two dedicated Web Workers load ONNX models via `onnxruntime-web` and run inference:

- **`video-inference.worker.ts`**: Receives `ImageBitmap` frames, preprocesses them (face crop via BlazeFace, resize to 224x224, normalize to ImageNet statistics, transpose to NCHW), runs the EfficientNet-B0 session, and returns a score between 0.0 (certainly fake) and 1.0 (certainly real).
- **`audio-inference.worker.ts`**: Receives `Float32Array` PCM buffers, preprocesses them (resample to 16 kHz, normalize amplitude, pad/truncate to 32,000 samples), runs the RawNet2-lite session, and returns a score.

Workers are spawned once per tab with an active call and terminated when the call ends.

### Composite Scorer (`src/core/scoring/composite-scorer.ts`)

Combines video and audio scores into a single composite score per scoring window:

```
composite = (video_weight * video_score) + (audio_weight * audio_score)
```

Default weights: 60% video, 40% audio. If only one modality is available (e.g., audio-only call or Zoom where audio interception is unavailable), that modality receives 100% weight. The scorer also applies temporal smoothing (`smoothing.ts`) using an exponential moving average to reduce noise between consecutive windows.

### Trust State Machine (`src/core/scoring/trust-state-machine.ts`)

Maps composite scores to trust ladder levels using configurable thresholds and implements asymmetric hysteresis:

| Threshold | Level |
|-----------|-------|
| >= 0.85 | Trusted |
| >= 0.50 | Nominal |
| >= 0.30 | Uncertain |
| < 0.30 | Distrusted |

The state machine enforces:
- **3 consecutive windows** to degrade one level (fast warning).
- **5 consecutive windows** to recover one level (slow trust restoration).
- **Single-step transitions only** -- trust moves one level per hysteresis cycle, never jumps.
- **Verified immunity** -- the Verified level, set exclusively by Vinsium, is immune to AI-based degradation.

### Session Manager (`src/core/session/`)

Maintains per-tab session state across two files:

- **`session-manager.ts`**: Orchestrates the session lifecycle -- creates sessions on `CALL_DETECTED`, updates state on each scoring window, handles Vinsium verification results, and cleans up on `CALL_ENDED`.
- **`session-store.ts`**: Persistence layer wrapping `chrome.storage.session` with typed accessors. State includes current trust level, scoring history, hysteresis counters, Vinsium verification status, and session metadata.

### Vinsium Bridge (`src/vinsium/`)

Manages the challenge-response protocol for cryptographic identity verification:

- **`bridge.ts`**: Production client that communicates with the Vinsium service over HTTPS. Handles challenge initiation, polling, and result processing.
- **`bridge.stub.ts`**: Stub implementation for development, testing, and offline use. Simulates the protocol locally with configurable delay and failure modes.
- **`crypto.ts`**: Ed25519 signature verification using the Web Crypto API.
- **`auth.ts`**: Authentication helpers for the Vinsium service.
- **`types.ts`**: Vinsium-specific type definitions.

### Overlay (`src/overlay/`)

Injects a trust badge into the video call page's DOM:

- **`trust-ring.ts`**: Renders the colored trust ring badge on the remote participant's video element. The ring color and icon reflect the current trust level.
- **`ring-styles.ts`**: CSS styles for each trust level (green shield for Verified, green circle for Trusted, grey for Nominal, yellow triangle for Uncertain, red octagon for Distrusted).
- **`position-tracker.ts`**: Tracks the position of participant video elements using `MutationObserver` and `ResizeObserver` to keep the badge correctly positioned as the call UI layout changes.

Clicking the badge opens the side panel with detailed session information.

### Messaging (`src/messaging/`)

Communication between extension contexts uses Chrome's message-passing APIs. All messages are typed and validated at the boundary:

- **`messages.ts`**: Defines the message type enum and payload interfaces.
- **`typed-messaging.ts`**: Type-safe wrappers around `chrome.runtime.sendMessage` (content script to service worker) and `chrome.tabs.sendMessage` (service worker to content script).

#### Message Types

| Message | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `CALL_DETECTED` | Content -> Background | `{ tabId, platform, participants }` | Notify that a call is active |
| `CALL_ENDED` | Content -> Background | `{ tabId }` | Notify that a call has ended |
| `FRAME_SCORE` | Worker -> Background | `{ tabId, modality, score, timestamp }` | Report a single inference result |
| `TRUST_UPDATE` | Background -> Content | `{ tabId, level, composite, scores }` | Send updated trust level for overlay |
| `VINSIUM_CHALLENGE` | Content -> Background | `{ tabId, targetAccount }` | Initiate Vinsium challenge-response |
| `VINSIUM_RESULT` | Background -> Content | `{ tabId, verified, accountId, error? }` | Report Vinsium verification result |

### Model Management (`src/models/`)

- **`loader.ts`**: Loads ONNX models from extension storage (IndexedDB) into the inference workers.
- **`registry.ts`**: Tracks which model versions are currently loaded, their SHA-256 hashes, and download timestamps.
- **`updater.ts`**: Checks the model manifest CDN for new versions, downloads updated models with integrity verification, and handles rollback to shipped models.

### Storage Manager (`src/store/`)

Three Zustand stores provide reactive state management with `chrome.storage` backing:

- **`session-store.ts`**: Per-session state (scores, trust levels, Vinsium status). Backed by `chrome.storage.session`. Cleared on browser close.
- **`settings-store.ts`**: User preferences (enabled platforms, threshold overrides, badge position, Vinsium stub toggle). Backed by `chrome.storage.local`. Persistent, never synced.
- **`vinsium-store.ts`**: Vinsium-specific state (pending challenges, cached verification results, account information). Backed by `chrome.storage.session`.

### UI Components (`src/ui/`)

Built with Preact and Tailwind CSS:

- **Components**: `TrustIndicator`, `ScoreGauge`, `ScoreTimeline`, `SessionReport`, `VerifyButton`, `VerifiedBadge`, `VerificationFlow`, `AccountGate`.
- **Hooks**: `useSession` (subscribe to session state), `useTrustLevel` (reactive trust level), `useVinsium` (Vinsium verification state and actions).

---

## Data Flow

1. User joins a video call on a supported platform.
2. The content script detects the call via the platform adapter and sends `CALL_DETECTED` to the service worker.
3. The service worker creates a session via `SessionManager` and spawns inference workers.
4. The interceptor (RTC patch or element fallback) taps media tracks and begins forwarding frames and audio to the taps.
5. `VideoTap` sends `ImageBitmap` frames to the video inference worker at 1 fps.
6. `AudioTap` sends `Float32Array` PCM chunks to the audio inference worker every 2 seconds.
7. Each inference worker scores its input and returns a `FRAME_SCORE` message.
8. The `CompositeScorer` combines video and audio scores with temporal smoothing.
9. The `TrustStateMachine` applies hysteresis and determines the trust ladder level.
10. The `SessionManager` stores the updated state in `chrome.storage.session`.
11. A `TRUST_UPDATE` message is sent to the content script.
12. The overlay updates the trust ring badge color and icon.
13. If the user requests Vinsium verification, the challenge-response flow runs in parallel via the Vinsium bridge.
14. When the call ends, `CALL_ENDED` is sent. The session is finalized, workers are terminated, and the overlay is removed.

---

## Message Passing Architecture

TrueStream runs across four isolated JavaScript contexts that communicate exclusively through Chrome's message-passing APIs:

```
Content Script  <--- chrome.runtime / chrome.tabs --->  Service Worker
     |                                                       |
     |  (postMessage to AudioWorklet)                        |  (postMessage to Web Worker)
     v                                                       v
AudioWorklet Thread                                    Inference Workers
```

- **Content Script <-> Service Worker**: Uses `chrome.runtime.sendMessage` (content to background) and `chrome.tabs.sendMessage` (background to content). Messages are serialized and deserialized at each boundary. All messages are typed via the `TypedMessage` union in `messages.ts`.
- **Content Script <-> AudioWorklet**: Uses the `MessagePort` provided by the `AudioWorkletNode` API. PCM sample buffers are transferred (not copied) using `Transferable` objects.
- **Service Worker <-> Inference Workers**: Uses standard `Worker.postMessage`. `ImageBitmap` objects are transferred for zero-copy frame delivery.

---

## State Management

### Three Zustand Stores

| Store | Backing | Scope | Contents |
|-------|---------|-------|----------|
| `session-store` | `chrome.storage.session` | Per browser session | Active sessions, trust levels, scores, hysteresis counters |
| `settings-store` | `chrome.storage.local` | Persistent | User preferences, threshold overrides, platform toggles |
| `vinsium-store` | `chrome.storage.session` | Per browser session | Pending challenges, verification cache, account state |

Zustand stores are hydrated from `chrome.storage` on service worker startup and on content script injection. Writes are debounced (100ms) to avoid excessive storage API calls during rapid score updates.

---

## Threading Model

```
Main Thread (Content Script, per tab)
  +-- Platform Adapter (DOM observation via MutationObserver)
  +-- RTC Patch / Element Fallback (RTCPeerConnection interception)
  +-- VideoTap (frame extraction, requestVideoFrameCallback)
  +-- Overlay (TrustRing rendering, PositionTracker)
  +-- AudioWorklet Thread (AudioProcessorWorklet, audio rendering thread)
       +-- PCM sample accumulation and buffer posting

Service Worker (Background, single instance)
  +-- SessionManager (session lifecycle orchestration)
  +-- CompositeScorer + TrustStateMachine (scoring pipeline)
  +-- Vinsium Bridge (challenge-response protocol)
  +-- Model Updater (manifest checks, model downloads)
  +-- Video Inference Web Worker (one per active tab)
       +-- ONNX Runtime WASM (multi-threaded via SharedArrayBuffer)
  +-- Audio Inference Web Worker (one per active tab)
       +-- ONNX Runtime WASM (multi-threaded via SharedArrayBuffer)
```

Key threading decisions:

- **Inference runs in Web Workers** to avoid blocking the service worker's event loop. Each active call tab gets its own pair of workers.
- **Audio capture uses AudioWorklet** because it runs on the browser's audio rendering thread and cannot drop samples due to main-thread congestion.
- **ONNX Runtime uses WebAssembly threads** via `SharedArrayBuffer` for parallel matrix operations within a single inference call.
- **The content script's main thread** handles only DOM manipulation, message relay, and overlay rendering. No heavy computation occurs here.
- **The service worker** coordinates sessions and scoring but delegates all compute-intensive work to child workers.

---

## Security Boundaries

### Extension Context Isolation

Chrome extensions enforce strict isolation between contexts:

- **Content script** runs in the page's DOM but has its own JavaScript environment. It can access `chrome.runtime` for messaging but cannot access background-only APIs like `chrome.storage` directly in MV3.
- **Service worker** runs in a fully separate origin. It can access all extension APIs but cannot access the page DOM.
- **Web Workers** spawned by the service worker inherit the service worker's origin and API access restrictions.
- **AudioWorklet** runs on the audio rendering thread with no DOM access and limited API surface.

### Trust Assumptions

- The local browser is trusted. If the browser itself is compromised, no extension-level protection is meaningful.
- The WebRTC media pipeline is trusted up to the point of interception. TrueStream detects manipulation in the rendered media, not in the transport layer.
- The Vinsium service is trusted for public key distribution. Key compromise at the Vinsium service level is outside TrueStream's threat model.
- ONNX models are verified by SHA-256 hash at download time. Model integrity is assumed after successful hash verification.

### Data Isolation

- No media data (video frames, audio samples) ever leaves the local browser. Frames exist only in worker memory during inference and are discarded immediately after.
- Inference results (numeric scores between 0.0 and 1.0) are stored in `chrome.storage.session` and are never transmitted to any server.
- Vinsium messages contain only nonces, signatures, and public key identifiers. They never contain media data, inference scores, or session metadata.
- The model manifest endpoint is read-only and serves only version metadata and download URLs. Requests are anonymous with no user-identifying information.
- `chrome.storage.sync` is never used. No extension data is synced to Google's cloud.
