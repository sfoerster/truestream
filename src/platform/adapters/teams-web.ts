/**
 * Microsoft Teams Web platform adapter.
 * Locates the active remote video element in Teams' DOM structure.
 */

/** Selector strategies for Teams Web, ordered by reliability */
const SELECTORS = [
  // Verified against Teams Web as of March 2025 - remote participant video
  '[data-tid="video-stream"] video',
  // Fallback: video inside the calling stage
  '.ts-calling-screen video:not([muted])',
  // Broad fallback
  '#video-stream video',
  'video[autoplay]:not([muted])',
] as const;

/**
 * Find the primary remote video element in Microsoft Teams Web's DOM.
 * Returns null if no suitable element is found.
 */
export function findRemoteVideoElement(): HTMLVideoElement | null {
  for (const selector of SELECTORS) {
    const elements = document.querySelectorAll<HTMLVideoElement>(selector);
    for (const el of elements) {
      if (el.muted) continue;
      if (el.readyState < 2) continue;
      if (el.videoWidth < 100 || el.videoHeight < 100) continue;
      return el;
    }
  }
  return null;
}
