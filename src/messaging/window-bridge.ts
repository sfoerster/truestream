const WINDOW_BRIDGE_SOURCE = 'truestream-window-bridge';

export interface SessionSyncWindowMessage {
  source: typeof WINDOW_BRIDGE_SOURCE;
  direction: 'to-page';
  type: 'SESSION_SYNC';
  sessionId: string | null;
}

export interface VideoFrameWindowMessage {
  source: typeof WINDOW_BRIDGE_SOURCE;
  direction: 'from-page';
  type: 'VIDEO_FRAME';
  frameData: ArrayBuffer;
  timestamp: number;
  sessionId: string;
}

export interface AudioFeaturesWindowMessage {
  source: typeof WINDOW_BRIDGE_SOURCE;
  direction: 'from-page';
  type: 'AUDIO_FEATURES';
  features: ArrayBuffer;
  timestamp: number;
  sessionId: string;
}

export type WindowBridgeMessage =
  | SessionSyncWindowMessage
  | VideoFrameWindowMessage
  | AudioFeaturesWindowMessage;

export function postSessionSync(sessionId: string | null): void {
  const message: SessionSyncWindowMessage = {
    source: WINDOW_BRIDGE_SOURCE,
    direction: 'to-page',
    type: 'SESSION_SYNC',
    sessionId,
  };

  window.postMessage(message, '*');
}

export function postPageMessage(
  message: VideoFrameWindowMessage | AudioFeaturesWindowMessage,
  transfer: Transferable[] = [],
): void {
  window.postMessage(message, '*', transfer);
}

export function isWindowBridgeMessage(message: unknown): message is WindowBridgeMessage {
  return (
    message !== null &&
    typeof message === 'object' &&
    'source' in message &&
    (message as { source?: string }).source === WINDOW_BRIDGE_SOURCE
  );
}
