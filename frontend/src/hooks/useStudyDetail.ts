import { useCallback } from "react";
import { getStudyDetail } from "../lib/api.js";
import type { StudyDetail } from "../lib/types.js";
import { useAsyncResource } from "./useAsyncResource.js";

export interface UseStudyDetailState {
  readonly detail: StudyDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export function useStudyDetail(studyInstanceUid: string): UseStudyDetailState {
  const fetcher = useCallback(
    (signal: AbortSignal) => getStudyDetail(studyInstanceUid, signal),
    [studyInstanceUid],
  );
  const { data, loading, error } = useAsyncResource(fetcher);
  return { detail: data, loading, error };
}
