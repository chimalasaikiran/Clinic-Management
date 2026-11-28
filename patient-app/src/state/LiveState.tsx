import { fetch as streamingFetch } from 'expo/fetch';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { API_URL } from '@/lib/api';
import { createEventParser } from '@/lib/sse';

import { useSession } from './SessionState';

export type LiveTopic = 'appointments' | 'notifications' | 'records' | 'requests' | 'app_access';

type Subscribe = (topics: readonly LiveTopic[], notify: () => void) => () => void;

const LiveContext = createContext<Subscribe>(() => () => {});

const RETRY_FIRST_MS = 2_000;
const RETRY_MAX_MS = 30_000;

/**
 * One live connection while the app is open and signed in. The server only says what changed; screens
 * reload it through the normal API. Every (re)connection also reloads, so nothing is missed while away.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { session, authorization, call } = useSession();
  const listeners = useRef(new Set<{ topics: readonly LiveTopic[]; notify: () => void }>());
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const signedIn = session.status === 'signedIn';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!signedIn || !active) return;
    const controller = new AbortController();
    let retry = RETRY_FIRST_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tell = (topic: string) => {
      for (const listener of listeners.current) {
        if (topic === 'ready' || listener.topics.includes(topic as LiveTopic)) listener.notify();
      }
    };

    const connect = async () => {
      try {
        const response = await streamingFetch(`${API_URL}/v1/patient/events/stream`, {
          headers: { Accept: 'text/event-stream', ...authorization() },
          signal: controller.signal,
        });
        if (response.status === 401) {
          // An ordinary request notices the ended session and signs the app out.
          await call('/v1/patient/me').catch(() => undefined);
          return;
        }
        if (!response.ok || !response.body) throw new Error(`Live updates answered ${response.status}`);
        const reader = response.body.getReader();
        // Events carry only ids and topic names (plain ASCII), so a chunk never splits a character.
        const decoder = new TextDecoder();
        const parse = createEventParser(({ event }) => {
          if (event === 'heartbeat') return;
          retry = RETRY_FIRST_MS;
          tell(event);
        });
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parse(decoder.decode(value));
        }
      } catch {
        // Offline or the server restarting: try again below.
      }
      if (controller.signal.aborted) return;
      // The server closes streams from time to time on purpose; failures wait longer each time.
      timer = setTimeout(connect, retry);
      retry = Math.min(retry * 2, RETRY_MAX_MS);
    };

    connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [signedIn, active, authorization, call]);

  const subscribe = useCallback<Subscribe>((topics, notify) => {
    const listener = { topics, notify };
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return <LiveContext.Provider value={subscribe}>{children}</LiveContext.Provider>;
}

export const useLiveSubscribe = () => useContext(LiveContext);
