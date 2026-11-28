import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, errorMessage, type Listed } from '@/lib/api';
import { useLiveSubscribe, type LiveTopic } from '@/state/LiveState';
import { useSession } from '@/state/SessionState';

export type Resource<T> = {
  /** The last result for this path; it stays on screen while a newer one loads. */
  data: T | null;
  error: { code: string; message: string } | null;
  loading: boolean;
  reload: () => void;
};

type State<T> = { path: string | null; data: T | null; error: Resource<T>['error'] };

function useRequest<T>(path: string | null, meta: boolean, topics: readonly LiveTopic[]): Resource<T> {
  const { call } = useSession();
  const subscribe = useLiveSubscribe();
  const [state, setState] = useState<State<T>>({ path: null, data: null, error: null });
  const [loading, setLoading] = useState(path !== null);
  const latest = useRef(0);

  const load = useCallback(() => {
    if (path === null) return;
    const request = (latest.current += 1);
    setLoading(true);
    call<T>(path, { meta }).then(
      (data) => {
        if (request !== latest.current) return;
        setState({ path, data, error: null });
        setLoading(false);
      },
      (error: unknown) => {
        if (request !== latest.current) return;
        const code = error instanceof ApiError ? error.code : 'UNKNOWN';
        setState((previous) => ({ path, data: previous.path === path ? previous.data : null, error: { code, message: errorMessage(error) } }));
        setLoading(false);
      },
    );
  }, [call, meta, path]);

  // Loads on first show and again each time the screen comes back into view.
  useFocusEffect(load);

  const key = topics.join(',');
  useEffect(() => (key ? subscribe(key.split(',') as LiveTopic[], load) : undefined), [key, load, subscribe]);

  const current = state.path === path;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: loading || (path !== null && !current),
    reload: load,
  };
}

/** One record from the API, reloaded when the server says one of `topics` changed. */
export const useResource = <T>(path: string | null, topics: readonly LiveTopic[] = []) => useRequest<T>(path, false, topics);

/** A list from the API, with its paging details. */
export const useList = <T>(path: string | null, topics: readonly LiveTopic[] = []) => useRequest<Listed<T[]>>(path, true, topics);
