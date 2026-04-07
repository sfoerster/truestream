/**
 * AudioTap - captures audio features from a remote audio track using
 * an AudioWorklet for real-time feature extraction.
 */

import { sendMessage } from '../../messaging/typed-messaging';

let audioContext: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let workletNode: AudioWorkletNode | null = null;
let currentTrack: MediaStreamTrack | null = null;
let activeSessionId: string | null = null;

/** Set the session ID for audio feature messages */
function setSessionId(sessionId: string): void {
  activeSessionId = sessionId;
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

  const workletUrl = chrome.runtime.getURL('audio-processor.worklet.js');
  await audioContext.audioWorklet.addModule(workletUrl);

  const stream = new MediaStream([track]);
  sourceNode = audioContext.createMediaStreamSource(stream);

  workletNode = new AudioWorkletNode(audioContext, 'feature-extractor');

  workletNode.port.onmessage = (event: MessageEvent) => {
    if (!activeSessionId) return;
    const features = event.data.features as Float32Array;
    sendMessage({
      type: 'AUDIO_FEATURES',
      features,
      timestamp: Date.now(),
      sessionId: activeSessionId,
    }).catch(() => {});
  };

  sourceNode.connect(workletNode);
  // Don't connect to destination - we extract features only, don't play audio

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
