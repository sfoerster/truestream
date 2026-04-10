/**
 * VideoTap singleton - captures frames from a remote video track at 4fps
 * and forwards them to the isolated-world bridge.
 */

import { postPageMessage } from '../../messaging/window-bridge';

const SAMPLE_INTERVAL_MS = 250;
const FRAME_WIDTH = 224;
const FRAME_HEIGHT = 224;

let currentTrack: MediaStreamTrack | null = null;
let videoElement: HTMLVideoElement | null = null;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let samplingInterval: ReturnType<typeof setInterval> | null = null;
let activeSessionId: string | null = null;

/** Set the session ID for frame messages */
function setSessionId(sessionId: string | null): void {
  activeSessionId = sessionId;
}

/** Sample a single frame, resize to model input, and send for inference */
function sampleFrame(): void {
  if (!videoElement || !canvas || !ctx || !activeSessionId) return;
  if (videoElement.readyState < 2) return;

  ctx.drawImage(videoElement, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  const imageData = ctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  const frameData = imageData.data.buffer.slice(0);

  postPageMessage({
    type: 'VIDEO_FRAME',
    source: 'truestream-window-bridge',
    direction: 'from-page',
    frameData,
    timestamp: Date.now(),
    sessionId: activeSessionId,
  }, [frameData]);
}

/**
 * Attach a video track for frame sampling. Creates an off-screen video
 * element and samples frames at 4fps using OffscreenCanvas. Only one
 * track can be active at a time.
 */
function attach(track: MediaStreamTrack): void {
  detach();
  currentTrack = track;

  videoElement = document.createElement('video');
  videoElement.srcObject = new MediaStream([track]);
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.play().catch(() => {});

  canvas = new OffscreenCanvas(FRAME_WIDTH, FRAME_HEIGHT);
  ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

  samplingInterval = setInterval(sampleFrame, SAMPLE_INTERVAL_MS);
  track.addEventListener('ended', detach);
}

/** Detach the current video tap, stopping frame sampling */
function detach(): void {
  if (samplingInterval !== null) {
    clearInterval(samplingInterval);
    samplingInterval = null;
  }
  if (currentTrack) {
    currentTrack.removeEventListener('ended', detach);
    currentTrack = null;
  }
  if (videoElement) {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement = null;
  }
  canvas = null;
  ctx = null;
}

export const VideoTap = { attach, detach, setSessionId };
