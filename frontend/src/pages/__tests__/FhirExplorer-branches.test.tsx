import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FhirExplorer } from "../FhirExplorer.js";

const ORIGINAL_FETCH = globalThis.fetch;
const EMPTY_BUNDLE = { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("FhirExplorer — branch edges", () => {
  it("renders the error banner when the bundle fetch fails (top-level error path)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () => new Response("backend down", { status: 503 })) as unknown as typeof fetch;

    render(<FhirExplorer />);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/503/);
    });
  });

  it("falls back to resource.id when a Patient has no name (labelFor Patient default)", async () => {
    const PATIENT_NO_NAME_BUNDLE = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "anonymous-42",
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith("/api/fhir/Patient")) {
        return new Response(JSON.stringify(PATIENT_NO_NAME_BUNDLE), { status: 200 });
      }
      return new Response(JSON.stringify(EMPTY_BUNDLE), { status: 200 });
    }) as unknown as typeof fetch;

    render(<FhirExplorer />);

    // The button's accessible name is the label; with no Patient.name, the
    // fallback is resource.id itself.
    const button = await screen.findByRole("button", { name: /anonymous-42/ });
    expect(button).toBeInTheDocument();
  });
});
