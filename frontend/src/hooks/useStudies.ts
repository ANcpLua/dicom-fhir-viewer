import { useCallback } from "react";
import { listStudies } from "../lib/api.js";
import type { Study } from "../lib/types.js";
import { useAsyncResource } from "./useAsyncResource.js";

export interface UseStudiesState {
  readonly studies: ReadonlyArray<Study>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useStudies(): UseStudiesState {
  const fetcher = useCallback(
    async (signal: AbortSignal) => (await listStudies(signal)).studies,
    [],
  );
  const { data, loading, error, refetch } = useAsyncResource(fetcher);
  return { studies: data ?? [], loading, error, refetch };
}
