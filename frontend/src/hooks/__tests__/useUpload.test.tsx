import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUpload } from "../useUpload.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("useUpload", () => {
  it("returns without calling fetch when upload() is called with an empty array (negative space)", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    globalThis.fetch = spy as unknown as typeof fetch;

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload([]);
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.uploading).toBe(false);
    expect(result.current.lastResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("records lastResult and calls onSuccess when the request succeeds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ fileCount: 1, referencedSopCount: 1, failedSopCount: 0, retrieveUrl: null }),
        { status: 201 },
      ),
    ) as unknown as typeof fetch;
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useUpload(onSuccess));

    await act(async () => {
      await result.current.upload([new File([new Uint8Array(4)], "ct.dcm")]);
    });

    await waitFor(() => expect(result.current.lastResult?.fileCount).toBe(1));
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("surfaces server errors via the error state", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("fail", { status: 500 })) as unknown as typeof fetch;

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload([new File([new Uint8Array(4)], "ct.dcm")]);
    });

    await waitFor(() => expect(result.current.error).toMatch(/500/));
  });
});
