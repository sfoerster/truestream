import { useState, useEffect } from 'preact/hooks';
import { SessionState } from '../../types/session';

export function useSession(): SessionState | null {
  const [session, setSession] = useState<SessionState | null>(null);

  useEffect(() => {
    chrome.storage.session.get('truestream_session').then((stored) => {
      if (stored.truestream_session) setSession(stored.truestream_session as SessionState);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'session' && changes.truestream_session) {
        setSession((changes.truestream_session.newValue as SessionState) ?? null);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return session;
}
