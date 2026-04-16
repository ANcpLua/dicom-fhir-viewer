import { useCallback, useState } from "react";
import { uploadDicom, ApiError } from "../lib/api.js";
import type { UploadResponse } from "../lib/types.js";

export interface UseUploadState {
  readonly upload: (files: ReadonlyArray<File>) => Promise<void>;
  readonly uploading: boolean;
  readonly lastResult: UploadResponse | null;
  readonly error: string | null;
}

export function useUpload(onSuccess?: () => void): UseUploadState {
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (files: ReadonlyArray<File>) => {
      if (files.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const result = await uploadDicom(files);
        setLastResult(result);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof ApiError || err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [onSuccess],
  );

  return { upload, uploading, lastResult, error };
}
