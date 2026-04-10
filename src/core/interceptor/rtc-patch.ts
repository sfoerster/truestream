/**
 * RTCPeerConnection prototype patch for intercepting WebRTC media tracks.
 * Must run at document_start before the page's own scripts establish connections.
 */

import { VideoTap } from '../taps/video-tap';
import { AudioTap } from '../taps/audio-tap';

let originalOnTrackDescriptor: PropertyDescriptor | null = null;
let originalAddEventListener: typeof RTCPeerConnection.prototype.addEventListener | null = null;
let isPatched = false;

/** Route a newly intercepted track to the appropriate tap */
function handleTrack(track: MediaStreamTrack): void {
  if (track.kind === 'video') {
    VideoTap.attach(track);
  } else if (track.kind === 'audio') {
    AudioTap.attach(track).catch((err) => {
      console.warn('[TrueStream] Failed to attach audio tap:', err);
    });
  }
}

/**
 * Patch RTCPeerConnection prototype to intercept incoming remote tracks.
 * The addTrack path is intentionally left alone so local outbound media
 * is not scored as if it were a remote participant.
 */
export function patch(): void {
  if (isPatched) return;
  if (typeof RTCPeerConnection === 'undefined') {
    console.warn('[TrueStream] RTCPeerConnection not available in this context');
    return;
  }

  originalOnTrackDescriptor =
    Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'ontrack') ?? null;
  originalAddEventListener = RTCPeerConnection.prototype.addEventListener;

  // Patch ontrack setter - intercepts incoming tracks
  Object.defineProperty(RTCPeerConnection.prototype, 'ontrack', {
    configurable: true,
    enumerable: true,
    get: originalOnTrackDescriptor?.get,
    set(handler: ((this: RTCPeerConnection, ev: RTCTrackEvent) => void) | null) {
      const wrappedHandler = handler
        ? function (this: RTCPeerConnection, ev: RTCTrackEvent) {
            handleTrack(ev.track);
            return handler.call(this, ev);
          }
        : null;
      if (originalOnTrackDescriptor?.set) {
        originalOnTrackDescriptor.set.call(this, wrappedHandler);
      }
    },
  });

  // Patch addEventListener for 'track' events
  RTCPeerConnection.prototype.addEventListener = function patchedAddEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (type === 'track' && listener) {
      const wrappedListener = function (this: RTCPeerConnection, ev: Event) {
        if (ev instanceof RTCTrackEvent) {
          handleTrack(ev.track);
        }
        if (typeof listener === 'function') {
          listener.call(this, ev);
        } else {
          listener.handleEvent(ev);
        }
      };
      return originalAddEventListener!.call(this, type, wrappedListener, options);
    }
    return originalAddEventListener!.call(this, type, listener!, options);
  };

  isPatched = true;
}

/** Restore the original RTCPeerConnection methods */
export function unpatch(): void {
  if (!isPatched) return;

  if (originalOnTrackDescriptor) {
    Object.defineProperty(RTCPeerConnection.prototype, 'ontrack', originalOnTrackDescriptor);
    originalOnTrackDescriptor = null;
  }
  if (originalAddEventListener) {
    RTCPeerConnection.prototype.addEventListener = originalAddEventListener;
    originalAddEventListener = null;
  }

  isPatched = false;
}
