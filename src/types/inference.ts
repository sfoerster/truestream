/** Input to the video inference worker */
export interface VideoInferenceInput {
  /** Raw RGBA frame data */
  frameData: ArrayBuffer;
  /** When the frame was captured (epoch ms) */
  timestamp: number;
  /** Session this frame belongs to */
  sessionId: string;
}

/** Output from the video inference worker */
export interface VideoInferenceOutput {
  /** Probability the frame is real (0.0-1.0) */
  real: number;
  /** Probability the frame is fake (0.0-1.0) */
  fake: number;
  /** Model confidence (0.0-1.0) */
  confidence: number;
  /** Time taken for inference in milliseconds */
  inferenceMs: number;
}

/** Input to the audio inference worker */
export interface AudioInferenceInput {
  /** Extracted audio feature vector (MFCCs, spectral features) */
  features: Float32Array;
  /** When the audio window was captured (epoch ms) */
  timestamp: number;
  /** Session this audio belongs to */
  sessionId: string;
}

/** Output from the audio inference worker */
export interface AudioInferenceOutput {
  /** Probability the audio is genuine (0.0-1.0) */
  genuine: number;
  /** Probability the audio is spoofed (0.0-1.0) */
  spoofed: number;
  /** Model confidence (0.0-1.0) */
  confidence: number;
  /** Time taken for inference in milliseconds */
  inferenceMs: number;
}
