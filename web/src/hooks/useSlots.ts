import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Slot } from '../types';

type State =
  | { status: 'idle' }
  | { status: 'loading'; slots: Slot[] }
  | { status: 'ready'; slots: Slot[] }
  | { status: 'error'; slots: Slot[]; message: string };

/** Loads upcoming slots whenever the API key changes; `reload` refreshes availability after a booking. */
export function useSlots(apiKey: string) {
  const [state, setState] = useState<State>({ status: 'idle' });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!apiKey.trim()) {
        setState({ status: 'idle' });
        return;
      }
      setState((s) => ({ status: 'loading', slots: 'slots' in s ? s.slots : [] }));
      try {
        const all = await api.listSlots(apiKey.trim());
        if (signal?.aborted) return;
        const now = Date.now();
        setState({ status: 'ready', slots: all.filter((s) => new Date(s.start).getTime() > now) });
      } catch (error) {
        if (signal?.aborted) return;
        const message =
          error instanceof ApiError && error.status === 401 ? 'That API key was not accepted.' : (error as Error).message;
        setState((s) => ({ status: 'error', slots: 'slots' in s ? s.slots : [], message }));
      }
    },
    [apiKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Wait briefly so we don't fire a request on every keystroke while the key is being typed.
    const timer = setTimeout(() => void load(controller.signal), 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return { state, reload: () => load() };
}
