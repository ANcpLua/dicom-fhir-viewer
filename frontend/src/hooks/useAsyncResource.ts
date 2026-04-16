import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../lib/api.js";

export interface AsyncResourceState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

/**
 * Fetch-on-mount + refetch state machine with AbortController cleanup.
 *
 * The `fetcher` must be stable across renders (wrap it in `useCallback`
 * at the call site). Its reference identity is the effect's dependency —
 * whenever the caller's own dependencies change, useCallback produces a
 * new fetcher, and this hook re-runs the effect.
 */
export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
): AsyncResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher(ctrl.signal)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof ApiError || err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [fetcher, tick]);

  return { data, loading, error, refetch };
}
