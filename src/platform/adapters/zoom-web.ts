/**
 * Zoom Web platform adapter.
 * Locates the active remote video element in Zoom's DOM structure.
 * Zoom Web uses canvas-based rendering in some cases.
 */

/** Selector strategies for Zoom Web, ordered by reliability */
const SELECTORS = [
  // Verified against Zoom Web as of March 2025
  '.sharedscreen-and-gallery video:not([muted])',
  // Fallback: video in the meeting container
  '#zoom-meeting-container video:not([muted])',
  // Broad fallback
  'video[autoplay]:not([muted])',
] as const;

/**
 * Find the primary remote video element in Zoom Web's DOM.
 * Returns null if no suitable element is found. Note: Zoom Web may
 * render video to canvas elements, in which case this returns null
 * and the element-fallback interceptor handles capture differently.
 */
export function findRemoteVideoElement(): HTMLVideoElement | null {
  for (const selector of SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (!(el instanceof HTMLVideoElement)) continue;
      if (el.muted) continue;
      if (el.readyState < 2) continue;
      if (el.videoWidth < 100 || el.videoHeight < 100) continue;
      return el;
    }
  }
  return null;
}
