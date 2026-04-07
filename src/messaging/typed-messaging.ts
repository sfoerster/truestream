import { AppMessage } from './messages';

/**
 * Send a typed message via chrome.runtime.sendMessage.
 * Returns a promise that resolves when the message is sent.
 */
export async function sendMessage<T extends AppMessage>(msg: T): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, () => {
        if (chrome.runtime.lastError) {
          console.warn('[TrueStream] Message send warning:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Register a typed message listener filtered by message type.
 * Returns a cleanup function that removes the listener when called.
 */
export function onMessage<T extends AppMessage['type']>(
  type: T,
  handler: (msg: Extract<AppMessage, { type: T }>) => void,
): () => void {
  const listener = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: unknown) => void,
  ) => {
    if (
      message !== null &&
      typeof message === 'object' &&
      'type' in message &&
      (message as { type: string }).type === type
    ) {
      handler(message as Extract<AppMessage, { type: T }>);
    }
  };

  chrome.runtime.onMessage.addListener(listener);

  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
}
