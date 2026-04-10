import { init, teardown } from '../core/interceptor';
import { AudioTap } from '../core/taps/audio-tap';
import { VideoTap } from '../core/taps/video-tap';
import { isWindowBridgeMessage } from '../messaging/window-bridge';

export default defineUnlistedScript({
  main() {
    const handleWindowMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window || !isWindowBridgeMessage(event.data)) return;
      if (event.data.direction !== 'to-page' || event.data.type !== 'SESSION_SYNC') return;

      VideoTap.setSessionId(event.data.sessionId);
      AudioTap.setSessionId(event.data.sessionId);
    };

    window.addEventListener('message', handleWindowMessage);
    init();

    const cleanup = () => {
      window.removeEventListener('message', handleWindowMessage);
      teardown();
    };

    window.addEventListener('pagehide', cleanup, { once: true });
    window.addEventListener('beforeunload', cleanup, { once: true });
  },
});
