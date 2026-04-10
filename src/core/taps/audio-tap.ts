/**
 * AudioTap - captures audio features from a remote audio track and
 * forwards them to the isolated-world bridge.
 */

import audioProcessorUrl from '../workers/audio-processor.worklet.js?url';
import { postPageMessage } from '../../messaging/window-bridge';

let audioContext: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let workletNode: AudioWorkletNode | null = null;
let sinkNode: GainNode | null = null;
let currentTrack: MediaStreamTrack | null = null;
let activeSessionId: string | null = null;

/** Set the session ID for audio feature messages */
function setSessionId(sessionId: string | null): void {
  activeSessionId = sessionId;
}

function toArrayBuffer(buffer: ArrayBufferLike, byteOffset = 0, byteLength = buffer.byteLength): ArrayBuffer {
  return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer;
}

/** Resume AudioContext if suspended due to page visibility change */
function handleVisibilityChange(): void {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
}

/**
 * Attach an audio track for feature extraction. Creates an AudioContext,
 * loads the audio worklet processor, and forwards extracted features.
 */
async function attach(track: MediaStreamTrack): Promise<void> {
  detach();
  currentTrack = track;

  audioContext = new AudioContext({ sampleRate: 48000 });
  await audioContext.audioWorklet.addModule(audioProcessorUrl);

  const stream = new MediaStream([track]);
  sourceNode = audioContext.createMediaStreamSource(stream);

  workletNode = new AudioWorkletNode(audioContext, 'sample-buffer');
  sinkNode = audioContext.createGain();
  sinkNode.gain.value = 0;

  workletNode.port.onmessage = (event: MessageEvent) => {
    if (!activeSessionId) return;
    const samples = event.data.samples as Float32Array;
    const featureBuffer = toArrayBuffer(samples.buffer, samples.byteOffset, samples.byteLength);
    postPageMessage({
      type: 'AUDIO_FEATURES',
      source: 'truestream-window-bridge',
      direction: 'from-page',
      features: featureBuffer,
      timestamp: Date.now(),
      sessionId: activeSessionId,
    }, [featureBuffer]);
  };

  sourceNode.connect(workletNode);
  workletNode.connect(sinkNode);
  sinkNode.connect(audioContext.destination);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  track.addEventListener('ended', detach);
}

/** Detach the current audio tap, releasing all audio resources */
function detach(): void {
  document.removeEventListener('visibilitychange', handleVisibilityChange);

  if (currentTrack) {
    currentTrack.removeEventListener('ended', detach);
    currentTrack = null;
  }
  if (workletNode) {
    workletNode.port.close();
    workletNode.disconnect();
    workletNode = null;
  }
  if (sinkNode) {
    sinkNode.disconnect();
    sinkNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}

export const AudioTap = { attach, detach, setSessionId };
