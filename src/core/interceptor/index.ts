import { patch, unpatch } from './rtc-patch';
import { startFallbackObserver, stopFallbackObserver } from './element-fallback';
import { detectPlatform, requiresFallbackIntercept } from '../../platform/detector';

/**
 * Initialize media stream interception.
 * Applies the RTC patch as primary strategy, and starts the element-based
 * fallback observer if the detected platform requires it.
 */
export function init(): void {
  const platform = detectPlatform();

  patch();

  if (requiresFallbackIntercept(platform)) {
    if (document.body) {
      startFallbackObserver();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        startFallbackObserver();
      });
    }
  }
}

/** Tear down all interception, restoring original browser APIs */
export function teardown(): void {
  unpatch();
  stopFallbackObserver();
}
