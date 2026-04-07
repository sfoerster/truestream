/**
 * Google Meet platform adapter.
 * Locates the active remote video element in Meet's DOM structure.
 */

/** Selector strategies ordered by reliability, with Meet version notes */
const SELECTORS = [
  // Verified against Meet as of March 2025 - main participant video
  '[data-participant-id] video',
  // Fallback: video elements inside the meeting grid
  '[data-self-name] ~ div video',
  // Broad fallback: any video that is not the self-view
  'video[autoplay]:not([muted])',
] as const;

/**
 * Find the primary remote video element in Google Meet's DOM.
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
