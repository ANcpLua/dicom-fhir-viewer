import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFhirSync } from "../useFhirSync.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("useFhirSync", () => {
  it("starts idle with no message (initial state)", () => {
    const { result } = renderHook(() => useFhirSync());
    expect(result.current.syncing).toBe(false);
    expect(result.current.message).toBeNull();
  });

  it("reports synced counts and fires onSynced when POST /api/fhir/sync succeeds", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ syncedStudies: 3, syncedPatients: 2, errors: [] }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const onSynced = vi.fn();

    const { result } = renderHook(() => useFhirSync(onSynced));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => expect(result.current.message).toBe("Synced 3 study / 2 patient(s)."));
    expect(result.current.syncing).toBe(false);
    expect(onSynced).toHaveBeenCalledOnce();
  });

  it("surfaces the backend error via the message field and does not fire onSynced", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const onSynced = vi.fn();

    const { result } = renderHook(() => useFhirSync(onSynced));

    await act(async () => {
      await result.current.sync();
    });

    await waitFor(() => expect(result.current.message).toMatch(/Sync failed/));
    expect(result.current.syncing).toBe(false);
    expect(onSynced).not.toHaveBeenCalled();
  });
});
