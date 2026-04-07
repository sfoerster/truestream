/**
 * AudioWorkletProcessor for real-time audio feature extraction.
 * Extracts MFCCs, spectral centroid, zero crossing rate, and RMS energy.
 * All DSP implemented in pure JS (no npm modules available in worklet scope).
 */

/* eslint-disable no-console */

/** Radix-2 Cooley-Tukey FFT, in-place */
function fft(real: Float64Array, imag: Float64Array): void {
  const n = real.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  // FFT butterfly
  for (let len = 2; len <= n; len *= 2) {
    const halfLen = len / 2;
    const angle = (-2 * Math.PI) / len;
    const wR = Math.cos(angle);
    const wI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curR = 1;
      let curI = 0;
      for (let j = 0; j < halfLen; j++) {
        const tR = curR * real[i + j + halfLen] - curI * imag[i + j + halfLen];
        const tI = curR * imag[i + j + halfLen] + curI * real[i + j + halfLen];
        real[i + j + halfLen] = real[i + j] - tR;
        imag[i + j + halfLen] = imag[i + j] - tI;
        real[i + j] += tR;
        imag[i + j] += tI;
        const newCurR = curR * wR - curI * wI;
        curI = curR * wI + curI * wR;
        curR = newCurR;
      }
    }
  }
}

/** DCT-II for MFCC computation */
function dctII(input: Float64Array, numCoeffs: number): Float64Array {
  const n = input.length;
  const output = new Float64Array(numCoeffs);
  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += input[i] * Math.cos((Math.PI * k * (2 * i + 1)) / (2 * n));
    }
    output[k] = sum;
  }
  return output;
}

/** Convert frequency in Hz to mel scale */
function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

/** Convert mel scale to frequency in Hz */
function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

/** Create a mel filterbank matrix */
function createMelFilterbank(
  numFilters: number,
  fftSize: number,
  sampleRate: number,
): Float64Array[] {
  const lowMel = hzToMel(0);
  const highMel = hzToMel(sampleRate / 2);
  const numPoints = numFilters + 2;

  // Equally spaced points in mel scale
  const melPoints = new Float64Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    melPoints[i] = lowMel + ((highMel - lowMel) * i) / (numPoints - 1);
  }

  // Convert back to Hz and then to FFT bin indices
  const binPoints = new Float64Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    binPoints[i] = Math.floor(((melToHz(melPoints[i]) * fftSize) / sampleRate) + 0.5);
  }

  // Create triangular filters
  const filterbank: Float64Array[] = [];
  const halfFft = fftSize / 2 + 1;

  for (let i = 0; i < numFilters; i++) {
    const filter = new Float64Array(halfFft);
    const left = binPoints[i];
    const center = binPoints[i + 1];
    const right = binPoints[i + 2];

    for (let j = Math.floor(left); j < Math.ceil(center); j++) {
      if (j >= 0 && j < halfFft && center !== left) {
        filter[j] = (j - left) / (center - left);
      }
    }
    for (let j = Math.floor(center); j < Math.ceil(right); j++) {
      if (j >= 0 && j < halfFft && right !== center) {
        filter[j] = (right - j) / (right - center);
      }
    }

    filterbank.push(filter);
  }

  return filterbank;
}

/** Compute MFCCs from a time-domain signal */
function computeMFCCs(
  signal: Float64Array,
  sampleRate: number,
  numCoeffs: number,
  numFilters: number,
): Float64Array {
  // Find next power of 2 for FFT
  let fftSize = 1;
  while (fftSize < signal.length) fftSize *= 2;

  // Zero-pad and apply Hanning window
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  for (let i = 0; i < signal.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (signal.length - 1)));
    real[i] = signal[i] * window;
  }

  // FFT
  fft(real, imag);

  // Magnitude spectrum (first half)
  const halfFft = fftSize / 2 + 1;
  const magnitudes = new Float64Array(halfFft);
  for (let i = 0; i < halfFft; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  // Apply mel filterbank
  const filterbank = createMelFilterbank(numFilters, fftSize, sampleRate);
  const melEnergies = new Float64Array(numFilters);
  for (let i = 0; i < numFilters; i++) {
    let energy = 0;
    for (let j = 0; j < halfFft; j++) {
      energy += magnitudes[j] * filterbank[i][j];
    }
    melEnergies[i] = Math.log(Math.max(energy, 1e-10));
  }

  // DCT to get MFCCs
  return dctII(melEnergies, numCoeffs);
}

/** Compute spectral centroid from magnitude spectrum */
function spectralCentroid(magnitudes: Float64Array, sampleRate: number, fftSize: number): number {
  let weightedSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < magnitudes.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    weightedSum += freq * magnitudes[i];
    magnitudeSum += magnitudes[i];
  }

  return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
}

/** Compute zero crossing rate */
function zeroCrossingRate(signal: Float64Array): number {
  let crossings = 0;
  for (let i = 1; i < signal.length; i++) {
    if ((signal[i] >= 0 && signal[i - 1] < 0) || (signal[i] < 0 && signal[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (signal.length - 1);
}

/** Compute RMS energy */
function rmsEnergy(signal: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i] * signal[i];
  }
  return Math.sqrt(sum / signal.length);
}

const NUM_MFCCS = 40;
const NUM_MEL_FILTERS = 40;
const WINDOW_SECONDS = 3;

/**
 * AudioWorkletProcessor that accumulates audio into 3-second windows
 * and extracts feature vectors for deepfake detection.
 */
class FeatureExtractorProcessor extends AudioWorkletProcessor {
  private buffer: Float64Array;
  private bufferIndex: number;
  private windowSize: number;

  constructor() {
    super();
    // Detect sample rate and compute window size
    // sampleRate is a global in AudioWorkletGlobalScope
    this.windowSize = Math.floor(sampleRate * WINDOW_SECONDS);
    this.buffer = new Float64Array(this.windowSize);
    this.bufferIndex = 0;
  }

  process(inputs: Float32Array[][], _outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData) return true;

    // Accumulate samples into the window buffer
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex] = channelData[i];
      this.bufferIndex++;

      if (this.bufferIndex >= this.windowSize) {
        this.extractAndPost();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  private extractAndPost(): void {
    // Compute MFCCs
    const mfccs = computeMFCCs(this.buffer, sampleRate, NUM_MFCCS, NUM_MEL_FILTERS);

    // Compute spectral centroid from a short FFT
    let fftSize = 1;
    while (fftSize < this.buffer.length) fftSize *= 2;
    const real = new Float64Array(fftSize);
    const imag = new Float64Array(fftSize);
    for (let i = 0; i < this.buffer.length; i++) {
      real[i] = this.buffer[i];
    }
    fft(real, imag);

    const halfFft = fftSize / 2 + 1;
    const magnitudes = new Float64Array(halfFft);
    for (let i = 0; i < halfFft; i++) {
      magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    }

    const centroid = spectralCentroid(magnitudes, sampleRate, fftSize);
    const zcr = zeroCrossingRate(this.buffer);
    const rms = rmsEnergy(this.buffer);

    // Pack into a single Float32Array: 40 MFCCs + centroid + zcr + rms = 43 values
    const features = new Float32Array(NUM_MFCCS + 3);
    for (let i = 0; i < NUM_MFCCS; i++) {
      features[i] = mfccs[i];
    }
    features[NUM_MFCCS] = centroid;
    features[NUM_MFCCS + 1] = zcr;
    features[NUM_MFCCS + 2] = rms;

    this.port.postMessage({ features });
  }
}

registerProcessor('feature-extractor', FeatureExtractorProcessor);
