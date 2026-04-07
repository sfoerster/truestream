import { init, teardown } from '../core/interceptor';
import { detectPlatform } from '../platform/detector';
import { TrustRingOverlay } from '../overlay/trust-ring';
import { onMessage, sendMessage } from '../messaging/typed-messaging';
import { findRemoteVideoElement as findMeetVideo } from '../platform/adapters/google-meet';
import { findRemoteVideoElement as findTeamsVideo } from '../platform/adapters/teams-web';
import { findRemoteVideoElement as findZoomVideo } from '../platform/adapters/zoom-web';
import { TrustLevel } from '../types/trust';

export default defineContentScript({
  matches: [
    'https://meet.google.com/*',
    'https://teams.microsoft.com/*',
    'https://zoom.us/*',
    'https://*.whereby.com/*',
  ],
  runAt: 'document_start',

  main() {
    const platform = detectPlatform();
    const overlay = new TrustRingOverlay();
    let retryInterval: ReturnType<typeof setInterval> | null = null;

    // Initialize the media interceptor (RTC patch + fallback if needed)
    init();

    // Find the remote video element using platform-specific adapter
    function findRemoteVideo(): HTMLVideoElement | null {
      switch (platform) {
        case 'google-meet':
          return findMeetVideo();
        case 'teams-web':
          return findTeamsVideo();
        case 'zoom-web':
          return findZoomVideo();
        default:
          return document.querySelector<HTMLVideoElement>('video:not([muted])');
      }
    }

    // Attempt to find and attach to the remote video element
    function tryAttachOverlay(): void {
      const videoEl = findRemoteVideo();
      if (videoEl) {
        overlay.attach(videoEl);
        if (retryInterval !== null) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
      }
    }

    // Wait for DOM to be ready, then look for video elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        tryAttachOverlay();
        // Retry periodically since video elements may load asynchronously
        retryInterval = setInterval(tryAttachOverlay, 2000);
        // Stop retrying after 60 seconds
        setTimeout(() => {
          if (retryInterval !== null) {
            clearInterval(retryInterval);
            retryInterval = null;
          }
        }, 60_000);
      });
    } else {
      tryAttachOverlay();
      retryInterval = setInterval(tryAttachOverlay, 2000);
      setTimeout(() => {
        if (retryInterval !== null) {
          clearInterval(retryInterval);
          retryInterval = null;
        }
      }, 60_000);
    }

    // Listen for trust level changes from the background service worker
    const removeTrustListener = onMessage('TRUST_LEVEL_CHANGE', (msg) => {
      overlay.updateLevel(msg.change.to as TrustLevel);
    });

    // Send SESSION_START to the background
    sendMessage({ type: 'SESSION_START', platform }).catch(() => {});

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      removeTrustListener();
      overlay.detach();
      teardown();
      if (retryInterval !== null) clearInterval(retryInterval);
    });
  },
});
