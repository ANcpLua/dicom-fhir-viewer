import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUpload } from "../useUpload.js";
import { useFhirSync } from "../useFhirSync.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("useUpload — non-Error rejection (default branch)", () => {
  it("calls String(err) when a non-Error value is rejected by fetch", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue("raw-string-rejection") as unknown as typeof fetch;

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload([new File([new Uint8Array(4)], "ct.dcm")]);
    });

    await waitFor(() => expect(result.current.error).toBe("raw-string-rejection"));
  });
});

describe("useFhirSync — non-Error rejection (default branch)", () => {
  it("falls back to the generic 'Sync failed.' message when the thrown value is not an Error", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      throw 42;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useFhirSync());

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => expect(result.current.message).toBe("Sync failed."));
  });
});
