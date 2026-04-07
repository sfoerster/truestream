/**
 * Dedicated Web Worker for audio inference using ONNX Runtime (WASM backend).
 * Processes feature vectors from the AudioWorklet, runs spoof detection.
 */

import * as ort from 'onnxruntime-web';

interface InitMessage {
  type: 'init';
  modelPath: string;
}

interface AudioFeaturesMessage {
  type: 'AUDIO_FEATURES';
  features: Float32Array;
  timestamp: number;
  sessionId: string;
}

type WorkerInput = InitMessage | AudioFeaturesMessage;

let session: ort.InferenceSession | null = null;
let isProcessing = false;

/** Run inference on audio features */
async function runInference(features: Float32Array, timestamp: number): Promise<void> {
  if (!session || isProcessing) return;

  isProcessing = true;
  const startTime = performance.now();

  try {
    const inputTensor = new ort.Tensor('float32', features, [1, features.length]);
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
async function initModel(modelPath: string): Promise<void> {
  try {
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(modelPath, {
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
      initModel(msg.modelPath);
      break;
    case 'AUDIO_FEATURES':
      runInference(msg.features, msg.timestamp);
      break;
  }
};
