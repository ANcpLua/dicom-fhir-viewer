import { useCallback } from "react";
import { listFhirImagingStudies, listFhirPatients } from "../lib/api.js";
import type { FhirBundle, FhirImagingStudySummary, FhirPatientSummary } from "../lib/types.js";
import { useAsyncResource } from "./useAsyncResource.js";

export interface FhirLists {
  readonly patients: FhirBundle<FhirPatientSummary>;
  readonly studies: FhirBundle<FhirImagingStudySummary>;
}

export interface UseFhirListsState {
  readonly lists: FhirLists | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useFhirLists(): UseFhirListsState {
  const fetcher = useCallback(async (signal: AbortSignal): Promise<FhirLists> => {
    const [patients, studies] = await Promise.all([
      listFhirPatients(signal),
      listFhirImagingStudies(signal),
    ]);
    return { patients, studies };
  }, []);
  const { data, loading, error, refetch } = useAsyncResource(fetcher);
  return { lists: data, loading, error, refetch };
}
