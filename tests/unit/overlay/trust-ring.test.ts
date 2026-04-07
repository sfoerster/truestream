import { describe, it, expect, beforeEach } from 'vitest';
import { TrustRingOverlay } from '../../../src/overlay/trust-ring';

describe('TrustRingOverlay', () => {
  let overlay: TrustRingOverlay;

  beforeEach(() => {
    overlay = new TrustRingOverlay();
  });

  it('creates and attaches to a video element', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    overlay.attach(video);
    const ringHost = document.querySelector('[data-truestream-ring]');
    expect(ringHost).not.toBeNull();
    overlay.detach();
    video.remove();
  });

  it('detach removes the overlay', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);
    overlay.attach(video);
    overlay.detach();
    const ringHost = document.querySelector('[data-truestream-ring]');
    expect(ringHost).toBeNull();
    video.remove();
  });

  it('updateLevel can be called before attach', () => {
    expect(() => overlay.updateLevel('confident')).not.toThrow();
  });
});
