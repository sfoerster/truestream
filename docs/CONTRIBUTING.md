# Contributing to TrueStream

Thank you for your interest in contributing to TrueStream. This document covers development setup, development mode, loading the extension, running tests, common contribution types, commit conventions, and the pull request process.

---

## Development Setup

### Prerequisites

- **Node.js 20+** (recommend using [nvm](https://github.com/nvm-sh/nvm) to manage versions)
- **npm 10+** (ships with Node.js 20)
- **Chrome 110+** or **Edge 110+** (for loading the unpacked extension and manual testing)
- **Git**

### Getting Started

```bash
# Clone the repository
git clone https://github.com/sfoerster-dev/truestream.git
cd truestream

# Install dependencies
npm install

# Download ONNX models (required for inference-related tests)
./scripts/download-models.sh

# Verify everything works
npm test
```

### Key Technologies

| Technology | Purpose |
|-----------|---------|
| [WXT](https://wxt.dev/) | Browser extension framework (manages manifest, entrypoints, build) |
| [Preact](https://preactjs.com/) | UI components (side panel, options page) via `@wxt-dev/module-preact` |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management (3 stores: session, settings, vinsium) |
| [ONNX Runtime Web](https://onnxruntime.ai/) | In-browser ONNX model inference via WebAssembly |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling for UI components |
| [Vitest](https://vitest.dev/) | Test framework |
| [TypeScript](https://www.typescriptlang.org/) | Type system (strict mode) |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/) | Linting and formatting |

---

## Development Mode

TrueStream uses WXT's development build with hot reload for UI components and automatic rebuilds for background and content scripts.

```bash
# Start dev mode with hot reload
npm run dev

# Start dev mode with Vinsium stub only (no real Vinsium service needed)
npm run dev:stub
```

This will:
1. Build the extension in development mode with source maps.
2. Watch for file changes and rebuild automatically.
3. Enable verbose `[TrueStream]`-prefixed logging to the browser console.
4. In stub mode, swap the Vinsium bridge for the local stub (`src/vinsium/bridge.stub.ts`).

### Loading the Unpacked Extension

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/` directory in the project root (created by the dev build).
5. The TrueStream extension icon should appear in your browser toolbar.

After making changes, the extension rebuilds automatically. For content script and service worker (background) changes, you may need to click the **reload** button (circular arrow) on the extension card in `chrome://extensions`.

### Inspecting the Extension

- **Service worker logs:** On the extension card in `chrome://extensions`, click "Inspect views: service worker" to open DevTools for the background context.
- **Content script logs:** Open DevTools on the video call page (F12) and filter the Console for messages prefixed with `[TrueStream]`.
- **Side panel:** Click the TrueStream icon in the toolbar to open the side panel. The side panel shows live session information, trust level history, and the Vinsium verification interface.
- **Options page:** Right-click the TrueStream icon and select "Options" to open the preferences page.

---

## Running Tests

```bash
# Run all tests (unit + integration)
npm test

# Run tests with V8 coverage report
npm run test:coverage

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run a specific test file
npx vitest run tests/unit/scoring/trust-scorer.test.ts

# Run tests matching a pattern
npx vitest run --testNamePattern "hysteresis"
```

### Test Structure

```
tests/
  unit/
    scoring/        # CompositeScorer, TrustStateMachine, smoothing tests
    overlay/        # TrustRing rendering and positioning tests
    vinsium/        # Vinsium bridge, stub bridge, crypto tests
    platform/       # Platform adapter selector and detection tests
    models/         # Model loader, registry, updater tests
    messaging/      # Typed message validation tests
  integration/
    session/        # Full session lifecycle (detect -> score -> update -> end)
    vinsium-flow/   # End-to-end Vinsium challenge-response with stub
  fixtures/
    audio/          # Sample WAV files for audio model tests
    frames/         # Sample PNG frames for video model tests
    sessions/       # Pre-built session state JSON fixtures
  helpers/
    chrome-mock.ts  # Mock factory for chrome.* APIs
    session-factory.ts  # Factory for creating test session objects
    score-factory.ts    # Factory for creating test score sequences
```

### Writing Tests

- Use [Vitest](https://vitest.dev/) as the test framework. It is API-compatible with Jest but faster and natively supports ES modules and TypeScript.
- Place unit tests in the corresponding `tests/unit/` subdirectory or co-located next to the source file.
- Use the factory functions in `tests/helpers/` to create test data. Do not hardcode test objects inline.
- Mock `chrome.*` APIs using the helpers in `tests/helpers/chrome-mock.ts`. The mock provides typed stubs for `chrome.storage.session`, `chrome.storage.local`, `chrome.runtime.sendMessage`, and `chrome.tabs.sendMessage`.
- Prefer testing behavior over implementation details. Test what a function does, not how it does it.
- Integration tests should cover the full message-passing flow between content script, service worker, and workers.

---

## Type Checking and Linting

```bash
# Type-check the entire project (no emit)
npm run typecheck

# Lint all source files
npm run lint

# Format all source files with Prettier
npm run format
```

TrueStream enforces:
- **TypeScript strict mode** (`strict: true` in `tsconfig.json`). All types must be explicit; no implicit `any`.
- **ESLint** with `@typescript-eslint/recommended` rules. Key rules: no unused variables, no explicit `any`, consistent type imports.
- **Prettier** for formatting (2-space indentation, single quotes, trailing commas). Configured in `.prettierrc`.

All three checks must pass before a PR can be merged. CI runs them automatically.

---

## Building

```bash
# Production build (optimized, minified, no source maps)
npm run build

# Development build (source maps, verbose logging, hot reload)
npm run dev

# Build with Vinsium stub only (for offline distribution/testing)
npm run build:stub
```

The production build outputs a ready-to-package Chrome extension in `dist/`. The build is managed by WXT, which handles manifest generation, entrypoint bundling, and asset copying.

---

## Common Contribution Types

### Adding a Platform Adapter

To add support for a new video-calling platform:

1. **Create the adapter** at `src/platform/adapters/{platform-name}.ts`:

```typescript
import type { PlatformAdapter, PlatformSelectors } from "../types";

const selectors: PlatformSelectors = {
  remoteVideo: "your-selector video",
  participantName: "your-selector .name",
  callActive: "your-call-indicator",
  gridContainer: "your-grid-container",
};

export const myPlatformAdapter: PlatformAdapter = {
  name: "myplatform",
  hostPatterns: ["*.myplatform.com"],
  selectors,

  detectCall(): boolean {
    return document.querySelector(selectors.callActive) !== null;
  },

  getParticipantVideos(): HTMLVideoElement[] {
    return Array.from(document.querySelectorAll(selectors.remoteVideo));
  },

  getParticipantName(videoElement: HTMLVideoElement): string | null {
    const tile = videoElement.closest("[data-participant]");
    return tile?.querySelector(selectors.participantName)?.textContent ?? null;
  },

  supportsInsertableStreams(): boolean {
    return true; // Set to false if canvas fallback is needed
  },
};
```

2. **Register the adapter** in `src/platform/detector.ts`.
3. **Add URL patterns** to the content script matches and `host_permissions` in `wxt.config.ts`.
4. **Add `web_accessible_resources`** matches for the new platform in `wxt.config.ts`.
5. **Add tests** in `tests/unit/platform/` for selector correctness and call detection logic.
6. **Document the platform** in `docs/PLATFORM_COMPATIBILITY.md`.

### Updating Detection Models

If you have trained an improved detection model:

1. Export the model to ONNX format (opset 17) using the export scripts.
2. Quantize to INT8 using the calibration pipeline in `scripts/quantize_model.py`.
3. Validate that the ONNX output matches the PyTorch output within tolerance (max absolute diff < 1e-5).
4. Benchmark inference latency on WASM to ensure it meets the 50ms target on 5-year-old hardware.
5. Verify accuracy: compute AUC on the FaceForensics++ LQ test set (video) or ASVspoof 2021 DF eval set (audio).
6. Update the model manifest JSON with the new version, download URL, and SHA-256 hash.
7. Submit a PR with:
   - The quantized ONNX model (or a download link if too large for git).
   - Benchmark results table (latency on at least 3 hardware configurations).
   - Accuracy metrics (AUC, EER, false positive rate at 1% false negative rate).
   - A description of what changed in training (new data, architecture modification, hyperparameter tuning).

### Reporting False Positives

False positive reports are valuable for improving model accuracy. Use the **False Positive Report** issue template on GitHub and include:

- The platform (Meet, Teams, Zoom, Whereby).
- Whether the call was 1:1 or group.
- The trust level and composite score shown by TrueStream.
- Whether the participant was using a virtual background.
- Lighting conditions (natural, fluorescent, backlit, low light).
- Connection quality (stable, intermittent, poor).
- Whether a VPN or proxy was active.
- Browser version and operating system.
- TrueStream extension version (shown in the options page).
- Whether the fallback capture method was active (indicated by the overlay icon).

Do **not** include screenshots, recordings, or any other media from the call. Privacy is paramount.

### Improving the Overlay

The overlay code lives in `src/overlay/` (trust ring, styles, position tracker). When modifying the overlay:

- Test on all supported platforms to ensure positioning works with each platform's DOM structure.
- Ensure the overlay does not interfere with the platform's own UI controls.
- Verify that the overlay respects the user's badge position preference from settings.
- Test with different numbers of participants (1, 4, 9+) to ensure correct per-participant positioning.

---

## Commit Messages

TrueStream uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Code style changes (formatting, whitespace, semicolons) |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance tasks (dependency bumps, config tweaks) |

### Scopes

| Scope | What it covers |
|-------|---------------|
| `scoring` | CompositeScorer, TrustStateMachine, smoothing, hysteresis |
| `interceptor` | RTC patch, element fallback, taps |
| `overlay` | Trust ring, ring styles, position tracker |
| `vinsium` | Vinsium bridge, stub, crypto, auth |
| `platform` | Platform adapters, detector |
| `models` | ONNX model loader, registry, updater |
| `ui` | Side panel, options page, Preact components, hooks |
| `store` | Zustand stores, chrome.storage wrappers |
| `messaging` | Typed message definitions and relay |

### Examples

```
feat(platform): add Whereby adapter with Insertable Streams support

fix(scoring): reset hysteresis counters when session ends

docs(privacy): clarify GDPR data controller section

test(vinsium): add stub bridge failure mode tests for all account states

perf(models): reduce video preprocessing memory allocations by reusing ImageBitmap

refactor(interceptor): extract canvas capture to element-fallback module
```

---

## Pull Request Process

### Before Submitting

Run the full quality check suite locally:

```bash
# All of these must pass
npm test              # Tests
npm run typecheck     # Type checking
npm run lint          # Linting
npm run build         # Production build

# Then manually test
# 1. Load the dist/ extension in Chrome
# 2. Join a video call on at least one supported platform
# 3. Verify the trust badge appears and updates
```

### PR Checklist

Every PR should address the following (the PR template includes this as a checklist):

- [ ] Tests added or updated for the change.
- [ ] Type checking passes (`npm run typecheck`).
- [ ] Linting passes (`npm run lint`).
- [ ] Production build succeeds (`npm run build`).
- [ ] Manual testing performed on at least one supported platform.
- [ ] Documentation updated if the change affects user-facing behavior.
- [ ] No new `chrome.storage.sync` usage (TrueStream never syncs data).
- [ ] No new network requests that transmit user data or media.
- [ ] No new third-party dependencies without maintainer approval.
- [ ] Commit messages follow Conventional Commits format.

### Review Process

1. Submit your PR against the `main` branch.
2. CI runs automatically: lint, typecheck, test, build.
3. A maintainer will review your PR, typically within a few business days.
4. Address any feedback by pushing follow-up commits. Do not force-push -- the review history is valuable.
5. Once approved and CI is green, the PR will be squash-merged with a clean commit message.

### What Makes a Good PR

- **Small and focused.** One logical change per PR. If you are fixing a bug and also refactoring nearby code, split them into separate PRs.
- **Tested.** Every behavior change should have a corresponding test. If a bug did not have a test before, add one that fails without the fix and passes with it.
- **Documented.** If the change affects how users interact with TrueStream (new feature, changed behavior, new platform), update the relevant docs.
- **Described.** The PR description should explain what changed and why. Link to any relevant issues.

---

## Code of Conduct

Be respectful, constructive, and professional. TrueStream is a security tool that people will rely on to protect themselves from identity fraud. Quality, thoroughness, and honesty matter more than speed. If you are unsure about a design decision, ask -- we would rather discuss it upfront than rework it after the fact.

---

## Questions?

Open a discussion on the GitHub repository or reach out to the maintainers. We are happy to help with your contribution.
