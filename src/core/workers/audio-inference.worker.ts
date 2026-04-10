/**
 * Dedicated Web Worker for audio inference using ONNX Runtime (WASM backend).
 * Processes sampled audio windows, derives a compact feature vector, then
 * runs spoof detection.
 */

import * as ort from 'onnxruntime-web';

interface InitMessage {
  type: 'init';
  modelData: ArrayBuffer;
}

interface AudioFeaturesMessage {
  type: 'AUDIO_FEATURES';
  features: ArrayBuffer;
  timestamp: number;
  sessionId: string;
}

type WorkerInput = InitMessage | AudioFeaturesMessage;

let session: ort.InferenceSession | null = null;
let isProcessing = false;

function extractFeatures(samples: Float32Array): Float32Array {
  const features = new Float32Array(43);
  if (samples.length === 0) return features;

  const segmentSize = Math.max(1, Math.floor(samples.length / 40));
  for (let i = 0; i < 40; i++) {
    const start = i * segmentSize;
    const end = Math.min(samples.length, start + segmentSize);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += Math.abs(samples[j]);
    }
    features[i] = end > start ? sum / (end - start) : 0;
  }

  let zeroCrossings = 0;
  let rmsSum = 0;
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i];
    rmsSum += value * value;
    peak = Math.max(peak, Math.abs(value));
    if (i > 0) {
      const previous = samples[i - 1];
      if ((value >= 0 && previous < 0) || (value < 0 && previous >= 0)) {
        zeroCrossings += 1;
      }
    }
  }

  features[40] = zeroCrossings / Math.max(1, samples.length - 1);
  features[41] = Math.sqrt(rmsSum / samples.length);
  features[42] = peak;

  return features;
}

/** Run inference on sampled audio */
async function runInference(featuresData: ArrayBuffer, timestamp: number): Promise<void> {
  if (!session || isProcessing) return;

  isProcessing = true;
  const startTime = performance.now();

  try {
    const samples = new Float32Array(featuresData);
    const features = extractFeatures(samples);
    const inputTensor = new ort.Tensor('float32', features, [1, 43]);
    const results = await session.run({ input: inputTensor });
    const output = results.output?.data as Float32Array | undefined;

    if (!output) throw new Error('Model produced no output');

    const genuine = output[0];
    const spoofed = output[1];
    const confidence = Math.abs(genuine - spoofed);
    const inferenceMs = performance.now() - startTime;

    self.postMessage({
      type: 'INFERENCE_RESULT',
      result: { genuine, spoofed, confidence, inferenceMs },
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
async function initModel(modelData: ArrayBuffer): Promise<void> {
  try {
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(modelData, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    const dummyInput = new Float32Array(43);
    const warmupTensor = new ort.Tensor('float32', dummyInput, [1, 43]);
    await session.run({ input: warmupTensor });

    self.postMessage({ type: 'INFERENCE_READY' });
  } catch (err) {
    self.postMessage({
      type: 'INFERENCE_ERROR',
      error: err instanceof Error ? err.message : 'Failed to load audio model',
    });
  }
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
    const msg = event.data;
    switch (msg.type) {
      case 'init':
      initModel(msg.modelData);
      break;
    case 'AUDIO_FEATURES':
      runInference(msg.features, msg.timestamp);
      break;
  }
};
