import { useCallback } from "react";
import { getFhirResource } from "../lib/api.js";
import type { FhirResource } from "../lib/types.js";
import { useAsyncResource } from "./useAsyncResource.js";

export type FhirResourceType = "Patient" | "ImagingStudy";

export interface UseFhirResourceState<T extends FhirResource> {
  readonly resource: T | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const noop = async (): Promise<never> => {
  throw new DOMException("no-selection", "AbortError");
};

export function useFhirResource<T extends FhirResource>(
  type: FhirResourceType,
  id: string | null,
): UseFhirResourceState<T> {
  const fetcher = useCallback(
    (signal: AbortSignal) => (id === null ? noop() : getFhirResource<T>(type, id, signal)),
    [type, id],
  );
  const { data, loading, error } = useAsyncResource<T>(fetcher);
  return {
    resource: id === null ? null : data,
    loading: id !== null && loading,
    error: id === null ? null : error,
  };
}
