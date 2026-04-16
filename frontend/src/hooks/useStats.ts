import { useCallback } from "react";
import { getStats } from "../lib/api.js";
import type { StatsResponse } from "../lib/types.js";
import { useAsyncResource } from "./useAsyncResource.js";

export interface UseStatsState {
  readonly stats: StatsResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useStats(): UseStatsState {
  const fetcher = useCallback((signal: AbortSignal) => getStats(signal), []);
  const { data, loading, error, refetch } = useAsyncResource(fetcher);
  return { stats: data, loading, error, refetch };
}
