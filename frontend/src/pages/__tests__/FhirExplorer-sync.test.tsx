import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FhirExplorer } from "../FhirExplorer.js";

const ORIGINAL_FETCH = globalThis.fetch;

const EMPTY_BUNDLE = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };

const SYNC_RESULT = { syncedStudies: 2, syncedPatients: 1, errors: [] };

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("FhirExplorer — Sync from Orthanc button", () => {
  it("POSTs /api/fhir/sync when clicked and shows the synced counts message", async () => {
    const spy = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      if (init?.method === "POST" && input.endsWith("/api/fhir/sync")) {
        return new Response(JSON.stringify(SYNC_RESULT), { status: 200 });
      }
      return new Response(JSON.stringify(EMPTY_BUNDLE), { status: 200 });
    });
    globalThis.fetch = spy as unknown as typeof fetch;

    render(<FhirExplorer />);

    const button = await screen.findByRole("button", { name: /Sync from Orthanc/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Synced 2 study \/ 1 patient\(s\)\./)).toBeInTheDocument();
    });

    const postCalls = spy.mock.calls.filter((args) => (args[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0]?.[0]).toMatch(/\/api\/fhir\/sync$/);
  });

  it("surfaces a 'Sync failed' message when the backend returns non-2xx (negative space: no success banner)", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      if (init?.method === "POST" && input.endsWith("/api/fhir/sync")) {
        return new Response("boom", { status: 500 });
      }
      return new Response(JSON.stringify(EMPTY_BUNDLE), { status: 200 });
    }) as unknown as typeof fetch;

    render(<FhirExplorer />);

    const button = await screen.findByRole("button", { name: /Sync from Orthanc/i });
    await userEvent.click(button);

    await waitFor(() => expect(screen.getByText(/Sync failed/i)).toBeInTheDocument());
    expect(screen.queryByText(/Synced \d+ study/)).toBeNull();
  });
});
