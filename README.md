# TrueStream

**TrueStream adds a real-time AI trust indicator to your video calls and lets you escalate to cryptographic verification when confidence is low.**

In a world where deepfakes can impersonate anyone on a video call, TrueStream sits quietly in your browser and watches for signs of manipulation. When something looks off, it tells you. When you need certainty, it lets you prove who you are through the Vinsium cryptographic identity protocol.

---

## The Trust Ladder

TrueStream presents trust as a five-level ladder plus a special cryptographic tier, not a binary safe/unsafe toggle:

| Level | Badge | Meaning |
|-------|-------|---------|
| **Verified** | Green shield | Cryptographically proven via Vinsium challenge-response. Immutable once achieved. |
| **Trusted** | Green circle | AI models consistently score the stream as authentic (>= 0.85 composite). |
| **Nominal** | Grey circle | Baseline state. Not enough data to judge, or scores fall in the middle range (0.50 - 0.84). |
| **Uncertain** | Yellow triangle | Some indicators of manipulation detected (0.30 - 0.49). Vinsium verification suggested. |
| **Distrusted** | Red octagon | Strong evidence of synthetic or manipulated media (< 0.30). |

Transitions use asymmetric hysteresis: degradation requires **3 consecutive** scoring windows to confirm, while recovery requires **5 consecutive** clean windows. This ensures warnings arrive fast but trust is not restored cheaply. The **Verified** level, once achieved through a successful Vinsium challenge-response, is immune to AI-based degradation -- only a failed re-challenge or session termination removes it.

See [docs/TRUST_LADDER.md](docs/TRUST_LADDER.md) for the full trust model specification.

---

## Quick Start from Source

```bash
# Clone the repository
git clone https://github.com/sfoerster-dev/truestream.git
cd truestream

# Install dependencies
npm install

# Download ONNX models (EfficientNet-B0 for video, RawNet2-lite for audio)
./scripts/download-models.sh

# Build in development mode with hot reload
npm run dev

# Load the unpacked extension in Chrome:
# 1. Navigate to chrome://extensions
# 2. Enable "Developer mode" (top-right toggle)
# 3. Click "Load unpacked"
# 4. Select the dist/ directory
```

Once loaded, join a video call on any supported platform. The trust badge appears on the remote participant's video tile and updates in real time as inference runs.

---

## How It Works

### WebRTC Interception

TrueStream uses a content script to intercept the `RTCPeerConnection` API before the video-calling platform initializes it. The interceptor patches `addTrack` and `addTransceiver` to capture references to every media track that passes through a peer connection.

- **Video frames** are captured via `VideoTrackProcessor` (Insertable Streams / Encoded Transform API) and forwarded to the video inference worker at 1 fps.
- **Audio chunks** are captured via an `AudioWorkletNode` running on the audio rendering thread and forwarded to the audio inference worker in 2-second buffers.

The original media is never modified, delayed, or degraded. TrueStream is a strictly passive observer.

### Local ONNX Inference

Two quantized models run inside dedicated Web Workers using ONNX Runtime for WebAssembly:

| Model | Task | Parameters | INT8 Size |
|-------|------|------------|-----------|
| **EfficientNet-B0** | Face manipulation detection | 5.3M | 5.8 MB |
| **RawNet2-lite** | Voice synthesis detection | 1.2M | 1.4 MB |

The composite scorer combines both modality scores (default 60% video / 40% audio) and feeds them into the trust state machine, which applies hysteresis to determine the current trust ladder level. On modern hardware, combined inference uses under 5% CPU.

### Vinsium Escalation

When AI confidence is not enough -- particularly at the **Uncertain** level -- TrueStream offers cryptographic identity verification through the Vinsium protocol:

1. The verifier sends a random 32-byte challenge nonce via the extension's side channel.
2. The Vinsium service forwards the challenge to the prover.
3. The prover signs the nonce with their registered Ed25519 private key.
4. TrueStream verifies the signature locally against the public key on file.
5. On success, the trust level jumps to **Verified** and stays there for the session.

Vinsium is entirely optional. TrueStream works fully without it, using only AI-based scoring. See [docs/VINSIUM_INTEGRATION.md](docs/VINSIUM_INTEGRATION.md) for the full protocol specification.

---

## Privacy

TrueStream is built on a strict local-first privacy model:

- **All inference runs locally** in your browser. No video or audio frames ever leave your device.
- **No telemetry, analytics, or usage tracking** of any kind. No Google Analytics, no Sentry, no crash reporting.
- **The only network requests** are model manifest checks (anonymous, read-only) and optional Vinsium challenge-response messages (containing only nonces and signatures, never media data).
- **Session scores** are stored in `chrome.storage.session` and automatically cleared when the browser closes.
- **User preferences** are stored in `chrome.storage.local` and never synced. TrueStream does not use `chrome.storage.sync`.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the full data inventory and GDPR analysis.

---

## Supported Platforms

| Platform | Status | Intercept Method | Notes |
|----------|--------|-------------------|-------|
| Google Meet | Supported | Insertable Streams | Primary development target |
| Microsoft Teams (Web) | Supported | Insertable Streams | Desktop app not supported; web client only |
| Zoom (Web Client) | Beta | Canvas capture fallback | Zoom blocks Insertable Streams; audio detection unavailable |
| Whereby | Beta | Insertable Streams | Limited testing coverage |

**Browser requirements:** Chrome 110+ or Edge 110+ (Chromium-based browsers with Insertable Streams API and SharedArrayBuffer support). Firefox and Safari are not supported.

See [docs/PLATFORM_COMPATIBILITY.md](docs/PLATFORM_COMPATIBILITY.md) for per-platform implementation details, DOM selectors, and known limitations.

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Chrome or Edge (for loading the unpacked extension)

### Commands

```bash
# Install dependencies
npm install

# Run in dev mode with hot reload and Vinsium stub
npm run dev

# Run in dev mode with stub Vinsium only
npm run dev:stub

# Run the full test suite
npm test

# Run tests with coverage
npm run test:coverage

# Type-check without emitting
npm run typecheck

# Lint
npm run lint

# Format code
npm run format

# Production build
npm run build

# Build with Vinsium stub (for offline/testing use)
npm run build:stub
```

### Project Structure

```
truestream/
  src/
    core/
      interceptor/      # RTCPeerConnection patching, element fallback
      scoring/          # CompositeScorer, TrustStateMachine, smoothing
      session/          # SessionManager, SessionStore
      taps/             # VideoTap, AudioTap (frame/audio extraction)
      workers/          # ONNX inference workers (video, audio), AudioWorklet processor
    entrypoints/        # WXT extension entry points
      background.ts     # Service worker
      content.ts        # Content script
      options/          # Options page (Preact)
      sidepanel/        # Side panel (Preact)
    messaging/          # Typed message passing between contexts
    models/             # ONNX model loader, registry, updater
    overlay/            # Trust ring badge, positioning, ring styles
    platform/
      adapters/         # Per-platform adapters (Meet, Teams, Zoom)
      detector.ts       # Platform auto-detection
    store/              # Zustand stores (session, settings, vinsium)
    types/              # Shared TypeScript types
    ui/
      components/       # Preact UI components
      hooks/            # Custom hooks (useSession, useTrustLevel, useVinsium)
    vinsium/            # Vinsium protocol client, stub bridge, crypto
  tests/
    unit/               # Unit tests
    integration/        # Integration tests
    fixtures/           # Test data (audio samples, video frames, sessions)
    helpers/            # Test utilities and Chrome API mocks
  scripts/              # Build and maintenance scripts
  docs/                 # Architecture and design documentation
```

---

## Contributing

We welcome contributions. Please read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development setup, coding standards, conventional commit format, and the PR process.

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for the full text.
