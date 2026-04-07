/**
 * MutationObserver-based fallback for platforms where RTC patching is
 * blocked by CSP. Watches for <video> element insertion and uses
 * captureStream() to extract media streams.
 */

import { VideoTap } from '../taps/video-tap';
import { AudioTap } from '../taps/audio-tap';

let observer: MutationObserver | null = null;
const trackedElements = new WeakSet<HTMLVideoElement>();

/** Process a discovered video element, extracting its media stream */
function processVideoElement(element: HTMLVideoElement): void {
  if (trackedElements.has(element)) return;

  // Local camera elements are muted to prevent echo; skip them
  if (element.muted) return;

  if (element.readyState < 2) {
    element.addEventListener('loadeddata', () => processVideoElement(element), { once: true });
    return;
  }

  trackedElements.add(element);

  try {
    const stream = (
      element as HTMLVideoElement & { captureStream(): MediaStream }
    ).captureStream();

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    if (videoTracks.length > 0) {
      VideoTap.attach(videoTracks[0]);
    }
    if (audioTracks.length > 0) {
      AudioTap.attach(audioTracks[0]).catch((err) => {
        console.warn('[TrueStream] Failed to attach audio from element fallback:', err);
      });
    }
  } catch (err) {
    console.warn('[TrueStream] captureStream() failed on video element:', err);
  }
}

/** Scan the DOM for existing video elements */
function scanExistingElements(): void {
  const videos = document.querySelectorAll<HTMLVideoElement>('video');
  videos.forEach(processVideoElement);
}

/**
 * Start a MutationObserver to watch for video element insertion.
 * Fallback strategy for platforms like Zoom Web.
 */
export function startFallbackObserver(): void {
  if (observer) return;

  scanExistingElements();

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLVideoElement) {
          processVideoElement(node);
        }
        if (node instanceof HTMLElement) {
          const videos = node.querySelectorAll<HTMLVideoElement>('video');
          videos.forEach(processVideoElement);
        }
      }
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/** Stop the fallback MutationObserver */
export function stopFallbackObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
