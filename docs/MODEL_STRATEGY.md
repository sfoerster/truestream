# Model Strategy

This document describes the machine learning models used by TrueStream for deepfake detection, their training data, architecture choices, ONNX export process, INT8 quantization, performance benchmarks, the over-the-air update system, and the broader framing of the deepfake detection arms race.

---

## Framing: The Arms Race

Deepfake detection is an adversarial problem. As detection models improve, generation models adapt to evade them, and vice versa. TrueStream's model strategy is designed with this arms race squarely in mind:

- **Models are consumable and replaceable**, not permanent fixtures. The architecture assumes that any given model will eventually be defeated by advances in generation technology.
- **The update system** allows pushing new models to users without requiring a full Chrome Web Store extension review, enabling rapid response to new attack techniques.
- **Multiple modalities** (video + audio) provide defense in depth. An attacker must convincingly fake both visual appearance and voice characteristics simultaneously to avoid detection.
- **The trust ladder** explicitly acknowledges AI limits. The **Uncertain** level and the Vinsium cryptographic escalation path exist because TrueStream's designers accept that AI scoring will never be 100% reliable.
- **No false confidence.** The Trusted level says "likely authentic," not "definitely authentic." Certainty is reserved for the Verified level, which relies on mathematics, not statistics.

The goal is not to build an undefeatable model. The goal is to be good enough to catch commodity deepfakes, fast enough to run in real time in a browser, and updatable enough to respond when the threat landscape shifts.

---

## Training Data

### Video: FaceForensics++

The primary video training dataset is [FaceForensics++](https://github.com/ondyari/FaceForensics), a widely used benchmark for face manipulation detection:

- **1,000 original video sequences** sourced from YouTube, covering diverse subjects, lighting conditions, and recording qualities.
- **Manipulated versions** using four generation methods:
  - **Deepfakes** (autoencoder-based face swaps)
  - **Face2Face** (expression reenactment)
  - **FaceSwap** (3D model-based face swaps)
  - **NeuralTextures** (GAN-based texture manipulation)
- **Three compression levels**: raw, HQ (constant rate factor 23), and LQ (constant rate factor 40).

Training uses the **LQ (low quality)** compressed variants exclusively because they most closely match the compression artifacts present in real WebRTC video streams. WebRTC uses VP8/VP9/AV1 codecs with adaptive bitrate that frequently produces compression levels comparable to CRF 35-45. Models trained on raw or HQ data perform 10-15% worse on real video calls due to the domain gap.

**Data augmentation pipeline:**
- Random JPEG compression (quality 20-80) to simulate transcoding artifacts.
- Gaussian blur (sigma 0.5-2.0) to simulate camera defocus and motion blur.
- Color jitter (brightness +/-20%, contrast +/-15%, saturation +/-20%) to simulate varying lighting conditions.
- Random horizontal flips.
- Resolution downscaling (to 112x112) and upscaling (back to 224x224) to simulate resolution mismatches between capture and display.
- Random frame-rate subsampling to simulate choppy video.

### Audio: ASVspoof 2021

The audio model is trained on the [ASVspoof 2021](https://www.asvspoof.org/) challenge dataset, specifically the Deepfake (DF) task:

- **Approximately 600,000 utterances** across bonafide (genuine) and spoofed (synthetic) categories.
- **Spoofed samples** include both text-to-speech (TTS) and voice conversion (VC) attacks from over 100 different generation systems.
- **Multiple codec and transmission conditions** that simulate real-world telephony and VoIP channels, including narrowband (8 kHz) and wideband (16 kHz) scenarios.

**Data augmentation pipeline:**
- Resampling to different sample rates (8 kHz, 16 kHz, 48 kHz) to handle the variety of WebRTC audio configurations.
- Additive noise (white noise, babble noise, office background noise) at SNR 5-30 dB.
- Codec simulation (Opus at various bitrates, G.711 mu-law, G.722) to match the codecs WebRTC actually uses.
- Random gain adjustment (+/-6 dB) to simulate volume differences.
- Room impulse response (RIR) convolution to simulate different acoustic environments.

---

## Architectures

### Video: EfficientNet-B0

**Why EfficientNet-B0:**
- **Small enough** to run in a Web Worker via ONNX Runtime WASM. At 5.3M parameters, it fits comfortably in worker memory alongside the WASM runtime.
- **Strong baseline accuracy** on FaceForensics++ LQ (>95% AUC), competitive with much larger architectures.
- **Well-studied** with predictable performance characteristics and extensive literature on its behavior with quantization.
- **Efficient FLOPs** via compound scaling (balanced depth, width, and resolution scaling), which is critical for battery-powered laptops where sustained CPU usage must stay low.

**Input specification:**
- 224x224 RGB face crop
- Normalized to ImageNet statistics: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
- NCHW tensor format (batch=1, channels=3, height=224, width=224)

**Output:** Single sigmoid score: 0.0 (certainly fake) to 1.0 (certainly real).

**Preprocessing pipeline (runs in the inference worker):**
1. Receive `ImageBitmap` from the video tap.
2. Detect face bounding box using a lightweight face detector (BlazeFace via MediaPipe, pre-loaded in the worker).
3. Crop the face region with a 20% margin to include some surrounding context.
4. Resize to 224x224 using bilinear interpolation.
5. Normalize pixel values: `(pixel / 255.0 - mean) / std`.
6. Transpose from HWC to NCHW format.
7. Create ONNX tensor and run inference.

### Audio: RawNet2-lite

**Why RawNet2-lite:**
- **Operates on raw waveforms** directly, avoiding the need for a separate spectrogram (mel-spectrogram or STFT) extraction step that would add latency and complexity in the browser.
- **Lightweight architecture** at 1.2M parameters, specifically designed for anti-spoofing tasks.
- **Competitive performance** on ASVspoof benchmarks, achieving >94% AUC on the DF task.
- **The "lite" variant** reduces channel widths by 50% compared to the original RawNet2, trading approximately 1% accuracy for a 60% reduction in inference time.

**Input specification:**
- 2 seconds of raw PCM audio at 16 kHz (32,000 samples)
- Single channel (mono)
- Amplitude normalized to [-1.0, 1.0]

**Output:** Single sigmoid score: 0.0 (certainly fake) to 1.0 (certainly real).

**Preprocessing pipeline (runs in the inference worker):**
1. Receive `Float32Array` PCM buffer from the audio tap.
2. Resample from the source sample rate (typically 48 kHz in WebRTC Opus) to 16 kHz.
3. Normalize amplitude to [-1.0, 1.0] range.
4. Pad with zeros or truncate to exactly 32,000 samples.
5. Create ONNX tensor (shape: [1, 32000]) and run inference.

---

## ONNX Export

Both models are trained in PyTorch and exported to ONNX format for cross-platform, cross-runtime inference.

### Export Commands

```bash
# Video model
python scripts/export_onnx.py \
  --model efficientnet_b0 \
  --checkpoint checkpoints/video_best.pth \
  --output models/video_detector.onnx \
  --input-shape 1,3,224,224 \
  --opset 17

# Audio model
python scripts/export_onnx.py \
  --model rawnet2_lite \
  --checkpoint checkpoints/audio_best.pth \
  --output models/audio_detector.onnx \
  --input-shape 1,32000 \
  --opset 17
```

### ONNX Opset Version

Both models target **ONNX opset 17**, which is the latest version fully supported by `onnxruntime-web` for WebAssembly execution. Using the latest supported opset ensures access to the most optimized operator implementations.

### Post-Export Validation

After export, the ONNX model is validated against the PyTorch model on a held-out validation set of 1,000 samples:

- The maximum absolute difference between PyTorch and ONNX outputs must be less than 1e-5 for all validation samples.
- AUC must be within 0.001 of the PyTorch model.
- Inference on the first 100 samples is timed to verify no unexpected performance regressions.

---

## INT8 Quantization

Both models are quantized from FP32 to INT8 to reduce model file size and improve inference speed on CPU/WASM targets. INT8 is chosen over FP16 because WASM SIMD instructions operate most efficiently on 8-bit integers, and the accuracy loss is negligible for these architectures.

### Quantization Method

Static quantization with calibration data:

1. **Calibration:** Run 500 representative samples (stratified across real and fake classes) through the FP32 model to collect activation range statistics.
2. **Weight quantization:** Compute per-channel scale and zero-point for all weight tensors.
3. **Activation quantization:** Compute per-tensor scale and zero-point for activation tensors using the collected statistics.
4. **Apply:** Use ONNX Runtime's quantization tools to produce the INT8 model.

```bash
python scripts/quantize_model.py \
  --input models/video_detector.onnx \
  --output models/video_detector_int8.onnx \
  --calibration-data calibration/video/ \
  --num-samples 500
```

### Size Reduction

| Model | FP32 Size | INT8 Size | Reduction |
|-------|-----------|-----------|-----------|
| EfficientNet-B0 | 21.4 MB | 5.8 MB | 73% |
| RawNet2-lite | 4.9 MB | 1.4 MB | 71% |
| **Combined** | **26.3 MB** | **7.2 MB** | **73%** |

The combined 7.2 MB INT8 model payload is small enough to ship with the extension and download as an update without significant bandwidth concerns.

### Accuracy Impact

| Model | Dataset | FP32 AUC | INT8 AUC | Delta |
|-------|---------|----------|----------|-------|
| EfficientNet-B0 | FaceForensics++ LQ | 0.957 | 0.951 | -0.006 |
| RawNet2-lite | ASVspoof 2021 DF | 0.943 | 0.938 | -0.005 |

The accuracy impact of INT8 quantization is minimal (less than 1% AUC loss) and well within acceptable tolerances for a real-time detection system. The quantized models maintain the same threshold calibration as the FP32 versions.

---

## Performance Benchmarks

Inference latency measured on representative hardware using Chrome with ONNX Runtime WASM:

| Model | Hardware | Latency (ms) | Notes |
|-------|----------|--------------|-------|
| EfficientNet-B0 INT8 | Apple M1 MacBook Air | 18 | Chrome 120, 8 GB RAM |
| EfficientNet-B0 INT8 | Intel i7-12700 | 24 | Chrome 120, desktop |
| EfficientNet-B0 INT8 | Intel i5-8250U | 45 | Chrome 120, 2018 ultrabook |
| EfficientNet-B0 INT8 | AMD Ryzen 5 5600X | 21 | Chrome 120, desktop |
| RawNet2-lite INT8 | Apple M1 MacBook Air | 8 | Chrome 120 |
| RawNet2-lite INT8 | Intel i7-12700 | 12 | Chrome 120 |
| RawNet2-lite INT8 | Intel i5-8250U | 22 | Chrome 120 |
| RawNet2-lite INT8 | AMD Ryzen 5 5600X | 10 | Chrome 120 |

**Target:** Both models must complete inference within 50ms on hardware from the last 5 years. All tested hardware meets this target with significant headroom.

### CPU Usage (Sustained)

With the default inference cadence (1 frame/sec video, 1 chunk/2 sec audio):

| Hardware Class | CPU Usage | Notes |
|----------------|-----------|-------|
| Modern (M1, 12th gen Intel, Ryzen 5000+) | 2-4% | Imperceptible to users |
| Older (8th gen Intel, Ryzen 2000) | 4-7% | Noticeable in task manager but not in UX |

These numbers include the full pipeline: frame capture, face detection, preprocessing, ONNX inference, scoring, and message passing. The inference workers yield the thread between calls, so CPU usage is bursty rather than sustained.

### Memory Usage

| Component | Memory |
|-----------|--------|
| ONNX Runtime WASM (per worker) | ~15 MB |
| EfficientNet-B0 INT8 model | ~6 MB |
| RawNet2-lite INT8 model | ~2 MB |
| Worker overhead (per worker) | ~3 MB |
| **Total per active tab** | **~26 MB** |

---

## Update System

Models are updated independently of the extension itself. This decoupling allows responding to new deepfake techniques without going through the multi-day Chrome Web Store review process for extension updates.

### Model Manifest

A JSON manifest hosted at a configurable CDN URL contains metadata about the latest available models. The manifest URL is configured in `src/models/updater.ts`.

```json
{
  "version": "2025.04.01",
  "models": {
    "video": {
      "url": "https://models.truestream.dev/v2/video_detector_int8.onnx",
      "sha256": "a1b2c3d4e5f6...",
      "size_bytes": 5832704,
      "version": "2.1.0",
      "min_extension_version": "0.1.0"
    },
    "audio": {
      "url": "https://models.truestream.dev/v2/audio_detector_int8.onnx",
      "sha256": "f6e5d4c3b2a1...",
      "size_bytes": 1468006,
      "version": "2.1.0",
      "min_extension_version": "0.1.0"
    }
  }
}
```

### Update Flow

1. **Check:** On extension startup and every 24 hours thereafter, the model updater (`src/models/updater.ts`) fetches the manifest. The request is anonymous -- no user identifiers, session data, or telemetry is sent.
2. **Compare:** If the manifest version is newer than the locally stored version (tracked in `chrome.storage.local` via the model registry), and the current extension version meets the `min_extension_version` requirement, an update is available.
3. **Notify:** The user is notified via the side panel that updated models are available. Updates are **never applied silently** -- the user must explicitly accept.
4. **Download:** The new model ONNX file is downloaded from the CDN.
5. **Verify:** The downloaded file's SHA-256 hash is computed and compared against the hash in the manifest. If they do not match, the download is discarded and the user is notified of a verification failure.
6. **Install:** The verified model replaces the old model in IndexedDB. The inference worker is restarted to load the new model.
7. **Confirm:** The model registry in `chrome.storage.local` is updated with the new version, hash, and download timestamp.

### Rollback

If a new model performs poorly (e.g., higher false positive rate or missed detections reported by users), TrueStream includes the original shipped models bundled with the extension as a fallback. The user can revert to shipped models via the extension options page. The rollback is immediate -- no download required.

---

## Future Directions

These items are under consideration for future model iterations:

- **Ensemble scoring:** Run multiple model architectures (e.g., EfficientNet-B0 + Xception) and combine their outputs. Different architectures catch different artifact types, improving robustness against generation methods that specifically target one architecture.
- **Temporal models:** Use sequence models (LSTM or lightweight Transformer) that analyze multiple consecutive frames to detect temporal inconsistencies in deepfakes (e.g., flickering boundaries, unnatural eye blinks, audio-visual sync issues).
- **Privacy-preserving fine-tuning:** Allow on-device fine-tuning on the user's own face data to improve accuracy for their specific appearance. All training data stays local, and the fine-tuned model is stored in local extension storage.
- **WebGPU inference:** When browser WebGPU support stabilizes and `onnxruntime-web` adds a production-quality WebGPU backend, migrate from WASM to WebGPU for faster inference on devices with capable GPUs. Early benchmarks suggest 3-5x speedup.
- **Adversarial training:** Incorporate adversarially generated samples that specifically target the current model's decision boundaries, hardening the model against adaptive attackers.
- **Cross-lingual audio:** Expand audio training data to cover more languages and accents, reducing false positive rates for non-English speakers.
