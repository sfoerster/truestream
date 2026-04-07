import { vi } from 'vitest';

export class MockRTCPeerConnection {
  private senders: { track: MediaStreamTrack }[] = [];
  private ontrackHandler: ((ev: unknown) => void) | null = null;

  addTrack(track: MediaStreamTrack, ...streams: MediaStream[]): { track: MediaStreamTrack } {
    const sender = { track };
    this.senders.push(sender);
    return sender;
  }

  get ontrack() { return this.ontrackHandler; }
  set ontrack(handler: ((ev: unknown) => void) | null) { this.ontrackHandler = handler; }

  getSenders() { return [...this.senders]; }
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}

export function installMockRTC(): void {
  (globalThis as Record<string, unknown>).RTCPeerConnection = MockRTCPeerConnection;
}

export function removeMockRTC(): void {
  delete (globalThis as Record<string, unknown>).RTCPeerConnection;
}
