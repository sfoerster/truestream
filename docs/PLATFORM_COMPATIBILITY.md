# Platform Compatibility

TrueStream supports multiple video-calling platforms. Each platform takes a different approach to WebRTC, DOM structure, and media handling. This document describes the per-platform implementation details, DOM selectors, known limitations, tested versions, and fallback strategies.

---

## Browser Requirements

TrueStream requires a Chromium-based browser that supports:

- **Insertable Streams API** (WebRTC Encoded Transform) for zero-copy media interception.
- **Web Workers with WebAssembly** for running ONNX Runtime inference.
- **SharedArrayBuffer** for multi-threaded WASM execution within inference workers.
- **AudioWorklet** for real-time audio sample capture on the audio rendering thread.

**Minimum browser versions:**

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Google Chrome | 110+ | Primary development target |
| Microsoft Edge | 110+ | Chromium-based, full support |
| Brave | 1.48+ | May require "Allow Fingerprinting" shields configuration for SharedArrayBuffer |

**Not supported:**
- Firefox -- does not implement the Insertable Streams API.
- Safari -- does not implement the Insertable Streams API.
- Chrome for Android / iOS -- extension APIs not available on mobile.

---

## Google Meet

| Property | Value |
|----------|-------|
| **Status** | Supported (primary development target) |
| **Intercept method** | Insertable Streams (Encoded Transform) |
| **Audio detection** | Supported via AudioWorklet |
| **Tested versions** | Meet web client, 2024-01 through 2025-03 |
| **Content script match** | `https://meet.google.com/*` |
| **Adapter file** | `src/platform/adapters/google-meet.ts` |

### How It Works

Google Meet uses standard WebRTC with `RTCPeerConnection`. TrueStream's content script (`src/entrypoints/content.ts`) injects the RTC patch (`src/core/interceptor/rtc-patch.ts`) before Meet's JavaScript initializes its peer connections. The patch wraps the `RTCPeerConnection` constructor and intercepts `addTrack`, `addTransceiver`, and `ontrack` to capture media tracks.

Video frames are tapped via `RTCRtpReceiver.createEncodedStreams()`, providing access to decoded frames without copying. Audio is captured via the `AudioWorkletNode` pipeline.

### DOM Selectors

```typescript
const MEET_SELECTORS = {
  // Remote video elements -- each participant tile contains a video element
  remoteVideo: '[data-participant-id] video',
  // Participant name labels
  participantName: '[data-participant-id] [data-self-name]',
  // Call active indicator -- present in DOM when actively in a call
  callActive: '[data-call-id]',
  // Grid container for participant video tiles
  gridContainer: '[data-allocation-index]',
};
```

### Known Limitations

- **Screen sharing:** When a participant shares their screen, the shared content stream is intercepted alongside the camera stream. TrueStream's face detector (BlazeFace) detects that no face is present in screen-share frames and skips inference for those frames. No false positives are generated from screen shares.
- **Breakout rooms:** Each breakout room creates a new `RTCPeerConnection`. TrueStream handles this transparently by intercepting every `RTCPeerConnection` constructor call, regardless of when it occurs.
- **End-to-end encrypted calls:** When Meet's optional E2EE is enabled, Insertable Streams still work because TrueStream intercepts at the decoded frame level, after the browser has decrypted the media. TrueStream does not have access to encrypted payloads.
- **DOM selector stability:** Google periodically updates Meet's DOM structure. The selectors above are based on data attributes that have been stable across observed versions. If selectors break, the platform adapter logs a warning and the overlay falls back to a generic position.

### Fallback

No fallback is needed. Meet fully supports the Insertable Streams API.

---

## Microsoft Teams (Web)

| Property | Value |
|----------|-------|
| **Status** | Supported |
| **Intercept method** | Insertable Streams (Encoded Transform) |
| **Audio detection** | Supported via AudioWorklet |
| **Tested versions** | Teams web client, 2024-06 through 2025-03 |
| **Content script match** | `https://teams.microsoft.com/*`, `https://teams.live.com/*` |
| **Adapter file** | `src/platform/adapters/teams-web.ts` |

### How It Works

Teams' web client uses WebRTC similarly to Meet. The interceptor patches `RTCPeerConnection` before Teams' scripts load. One significant difference: Teams frequently renegotiates connections as participants join, leave, toggle cameras, and switch between gallery and speaker views. The interceptor handles dynamic `ontrack` events and re-taps media tracks as they are added or replaced.

### DOM Selectors

```typescript
const TEAMS_SELECTORS = {
  // Remote video elements
  remoteVideo: '[data-tid="video-stream"] video',
  // Participant name labels
  participantName: '[data-tid="participant-name"]',
  // Call active indicator
  callActive: '[data-tid="call-composite"]',
  // Gallery view container
  gridContainer: '[data-tid="video-gallery"]',
};
```

### Known Limitations

- **Teams desktop application:** The desktop app uses a custom native media stack (not browser-based WebRTC) that does not expose `RTCPeerConnection` to JavaScript. TrueStream **does not work** with the Teams desktop app. Users must use the web client at `teams.microsoft.com`.
- **Together Mode / custom backgrounds:** These features apply server-side compositing before the video reaches the browser. The intercepted frames show the composited output (e.g., participants seated in a virtual auditorium). Face detection still works on the composited faces, but model accuracy may be reduced because the compositing process alters pixel-level characteristics the model relies on.
- **Large meetings (>10 participants):** Teams dynamically renders only a subset of participant videos based on the active speaker and gallery view pagination. TrueStream can only score participants whose video is currently being rendered in the DOM. Participants not in view have no trust assessment.
- **Teams PWA:** The progressive web app version behaves identically to the browser version and is supported.
- **Guest access:** Guest participants joining via a link use the same web client and are fully supported.

### Fallback

No fallback is needed for the web client. Insertable Streams are fully supported.

---

## Zoom (Web Client)

| Property | Value |
|----------|-------|
| **Status** | Beta |
| **Intercept method** | Canvas capture fallback |
| **Audio detection** | Not available |
| **Tested versions** | Zoom web client, 2024-09 through 2025-02 |
| **Content script match** | `https://*.zoom.us/*` |
| **Adapter file** | `src/platform/adapters/zoom-web.ts` |

### How It Works

Zoom's web client uses WebRTC internally but applies a custom media pipeline wrapper that prevents Insertable Streams from working reliably. Specifically, Zoom intercepts and processes media tracks through its own decoding layer before rendering to a `<canvas>` element, making the standard `RTCRtpReceiver.createEncodedStreams()` API inaccessible.

TrueStream falls back to **canvas capture** via the element fallback (`src/core/interceptor/element-fallback.ts`):

1. The Zoom adapter locates the `<canvas>` element that Zoom uses to render participant video.
2. Using `requestAnimationFrame`, TrueStream captures frames from the canvas at 1 fps by calling `canvas.getContext('2d').getImageData()` or `createImageBitmap(canvas)`.
3. Face detection and cropping are applied to the captured frame.
4. The cropped face is sent to the video inference worker as a standard `ImageBitmap`.

### DOM Selectors

```typescript
const ZOOM_SELECTORS = {
  // Zoom renders video to canvas elements, not <video> tags
  remoteVideo: '.gallery-video-container canvas',
  // Participant name (overlay text rendered on canvas container)
  participantName: '.gallery-video-container .video-avatar__avatar-name',
  // Call active indicator
  callActive: '.meeting-app',
  // Gallery view container
  gridContainer: '.gallery-video-container__main-view',
};
```

### Known Limitations

- **Canvas capture quality:** Frames captured from the canvas have already been decoded, processed by Zoom's rendering pipeline, and re-rendered to the canvas. This process may lose subtle pixel-level artifacts that the EfficientNet-B0 model relies on for detection. Measured accuracy impact: **5-8% lower AUC** compared to Insertable Streams on the same video content.
- **Audio detection unavailable:** Zoom's audio pipeline does not use the standard Web Audio API and does not expose audio data through standard browser APIs. Audio deepfake detection via RawNet2-lite is **not available** for Zoom calls. Only video scoring is performed, with video receiving 100% weight in the composite score.
- **Higher CPU usage:** Canvas capture involves reading pixels from the GPU back to CPU memory (`getImageData` or `createImageBitmap`), which is more expensive than zero-copy Insertable Streams. Expect 1-2% additional CPU usage on Zoom compared to Meet or Teams.
- **Zoom desktop application:** Not supported. Users must use the web client by clicking "Join from your browser" on the meeting join page.
- **Virtual backgrounds:** Zoom applies virtual backgrounds before rendering to canvas. The captured frames include the virtual background, but this does not affect face-region inference since the face crop excludes the background.
- **Breakout rooms:** Each breakout room uses a separate canvas. TrueStream detects canvas changes via `MutationObserver` and re-attaches the capture loop.

### Fallback Strategy

Canvas capture is itself the primary fallback for Zoom. If the canvas element cannot be located (e.g., due to Zoom DOM structure changes in a future update), TrueStream follows this cascade:

1. Look for any `<video>` element on the page and use `requestVideoFrameCallback`.
2. If no `<video>` element is found, attempt `captureStream()` on any `<canvas>` element.
3. If nothing works, display a "Platform not supported in this configuration" message in the trust ring position.

---

## Whereby

| Property | Value |
|----------|-------|
| **Status** | Beta |
| **Intercept method** | Insertable Streams (Encoded Transform) |
| **Audio detection** | Supported via AudioWorklet |
| **Tested versions** | Whereby web client, 2024-11 through 2025-01 |
| **Content script match** | `https://whereby.com/*`, `https://*.whereby.com/*` |
| **Adapter file** | Planned (not yet in `src/platform/adapters/`) |

### How It Works

Whereby uses standard WebRTC without significant customization, similar to Google Meet. The RTC interceptor works identically. Once a dedicated adapter is implemented, Whereby will use the same Insertable Streams pipeline as Meet and Teams.

Currently, Whereby support relies on generic `RTCPeerConnection` interception without platform-specific DOM awareness. The trust ring overlay is positioned using generic heuristics rather than platform-specific selectors.

### DOM Selectors (Planned)

```typescript
const WHEREBY_SELECTORS = {
  // Remote video elements
  remoteVideo: '[data-testid="video-tile"] video',
  // Participant name labels
  participantName: '[data-testid="video-tile"] [data-testid="participant-name"]',
  // Call active indicator
  callActive: '[data-testid="room-container"]',
  // Grid container
  gridContainer: '[data-testid="video-grid"]',
};
```

### Known Limitations

- **Limited testing:** Whereby has received significantly less testing than Meet and Teams. Edge cases around participant join/leave, screen sharing, and room configuration may not be handled correctly.
- **Embedded rooms:** Whereby rooms embedded in iframes on third-party websites may not be accessible to the content script due to cross-origin iframe restrictions. The extension's `host_permissions` include `https://*.whereby.com/*` but cannot inject into cross-origin iframes hosted on other domains.
- **No dedicated adapter yet:** The Whereby-specific adapter is planned but not yet implemented in `src/platform/adapters/`. The generic interception still functions, but overlay positioning and call lifecycle detection are less reliable than on Meet or Teams.

### Fallback

No fallback is needed. Whereby supports the Insertable Streams API.

---

## Adding a New Platform

To add support for a new video-calling platform, follow these steps:

1. **Create an adapter** at `src/platform/adapters/{platform-name}.ts` implementing the `PlatformAdapter` interface.
2. **Define DOM selectors** for video elements, participant name labels, call-active indicators, and the grid container.
3. **Determine the intercept method:** Test whether Insertable Streams work on the target platform. If not, the element fallback in `src/core/interceptor/element-fallback.ts` handles canvas and video element capture.
4. **Register the adapter** by adding it to the platform detector in `src/platform/detector.ts`.
5. **Add URL patterns** to the content script matches and `host_permissions` in `wxt.config.ts`.
6. **Add `web_accessible_resources`** matches for the new platform's URLs in `wxt.config.ts`.
7. **Write tests** in `tests/unit/` for adapter selectors and call detection, and in `tests/integration/` for the full session lifecycle.
8. **Document the platform** in this file following the format above.

See [docs/CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution process.

---

## General Fallback Strategy

When the primary intercept method fails for any platform, TrueStream follows this fallback chain, implemented in `src/core/interceptor/element-fallback.ts`:

```
Insertable Streams (Encoded Transform via RTCRtpReceiver)
  |
  | (not available, blocked by platform, or API throws)
  v
requestVideoFrameCallback on <video> element
  |
  | (no <video> element found in DOM)
  v
Canvas capture (createImageBitmap or getContext('2d').getImageData)
  |
  | (no canvas element found)
  v
Display "unsupported configuration" message in overlay position
```

At each fallback level, detection accuracy decreases because the intercepted data is further from the raw decoded frames:

| Method | Accuracy Impact | CPU Impact |
|--------|-----------------|------------|
| Insertable Streams | Baseline (0%) | Baseline |
| requestVideoFrameCallback | ~2-3% AUC reduction | +0.5% CPU |
| Canvas capture | ~5-8% AUC reduction | +1-2% CPU |

The trust ring badge displays a subtle indicator icon when a fallback method is in use, so the user is aware that detection confidence may be lower than normal.
