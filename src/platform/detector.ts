/** Supported video call platforms */
export type Platform = 'google-meet' | 'teams-web' | 'zoom-web' | 'whereby' | 'unknown';

/**
 * Detect which video call platform is running based on the current hostname.
 * Must be called from a content script context.
 */
export function detectPlatform(): Platform {
  const hostname = window.location.hostname;

  if (hostname === 'meet.google.com') {
    return 'google-meet';
  }
  if (hostname === 'teams.microsoft.com' || hostname.endsWith('.teams.microsoft.com')) {
    return 'teams-web';
  }
  if (hostname === 'zoom.us' || hostname.endsWith('.zoom.us')) {
    return 'zoom-web';
  }
  if (hostname === 'whereby.com' || hostname.endsWith('.whereby.com')) {
    return 'whereby';
  }
  return 'unknown';
}

/**
 * Determine whether a platform requires element-based fallback interception
 * instead of RTCPeerConnection patching. Zoom Web wraps WebRTC in ways
 * that prevent reliable RTC prototype patching.
 */
export function requiresFallbackIntercept(platform: string): boolean {
  return platform === 'zoom-web';
}
