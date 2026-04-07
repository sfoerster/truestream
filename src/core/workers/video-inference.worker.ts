/**
 * Dedicated Web Worker for video inference using ONNX Runtime (WASM backend).
 * Processes frames from the VideoTap, runs deepfake detection, returns scores.
 */

import * as ort from 'onnxruntime-web';

interface InitMessage {
  type: 'init';
  modelPath: string;
}

interface FrameMessage {
  type: 'VIDEO_FRAME';
  frameData: ArrayBuffer;
  timestamp: number;
  sessionId: string;
}

type WorkerInput = InitMessage | FrameMessage;

let session: ort.InferenceSession | null = null;
let isProcessing = false;

/** Preprocess raw RGBA frame data into a normalized float tensor [1,3,224,224] */
function preprocessFrame(frameData: ArrayBuffer): ort.Tensor {
  const rgba = new Uint8Array(frameData);
  const width = 224;
  const height = 224;
  const channels = 3;
  const float32Data = new Float32Array(channels * width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const pixelIdx = y * width + x;
      float32Data[pixelIdx] = rgba[srcIdx] / 255.0;
      float32Data[width * height + pixelIdx] = rgba[srcIdx + 1] / 255.0;
      float32Data[2 * width * height + pixelIdx] = rgba[srcIdx + 2] / 255.0;
    }
  }

  return new ort.Tensor('float32', float32Data, [1, 3, width, height]);
}

/** Run inference on a single frame */
async function runInference(frameData: ArrayBuffer, timestamp: number): Promise<void> {
  if (!session || isProcessing) return;

  isProcessing = true;
  const startTime = performance.now();

  try {
    const inputTensor = preprocessFrame(frameData);
    const results = await session.run({ input: inputTensor });
    const output = results.output?.data as Float32Array | undefined;

    if (!output) throw new Error('Model produced no output');

    const real = output[0];
    const fake = output[1];
    const confidence = Math.abs(real - fake);
    const inferenceMs = performance.now() - startTime;

    self.postMessage({
      type: 'INFERENCE_RESULT',
      result: { real, fake, confidence, inferenceMs },
      timestamp,
    });
  } catch (err) {
    self.postMessage({
      type: 'INFERENCE_ERROR',
      error: err instanceof Error ? err.message : 'Unknown inference error',
      timestamp,
    });
  } finally {
    isProcessing = false;
  }
}

/** Initialize the ONNX model session */
async function initModel(modelPath: string): Promise<void> {
  try {
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    // Warm up with a dummy inference
    const dummyInput = new Float32Array(3 * 224 * 224);
    const warmupTensor = new ort.Tensor('float32', dummyInput, [1, 3, 224, 224]);
    await session.run({ input: warmupTensor });

    self.postMessage({ type: 'INFERENCE_READY' });
  } catch (err) {
    self.postMessage({
      type: 'INFERENCE_ERROR',
      error: err instanceof Error ? err.message : 'Failed to load model',
    });
  }
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      initModel(msg.modelPath);
      break;
    case 'VIDEO_FRAME':
      runInference(msg.frameData, msg.timestamp);
      break;
  }
};
