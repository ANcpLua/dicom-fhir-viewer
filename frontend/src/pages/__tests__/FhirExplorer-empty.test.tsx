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

describe("FhirExplorer — empty + sync + fallback label", () => {
  it("shows the 'No resources yet' prompt when both bundles are empty (negative space)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(EMPTY_BUNDLE), { status: 200 })) as unknown as typeof fetch;

    render(<FhirExplorer />);

    await waitFor(() => {
      expect(screen.getByText(/No resources yet/i)).toBeInTheDocument();
    });
  });

  it("falls back to the resource id when an ImagingStudy has no description (labelFor default branch)", async () => {
    const STUDY_BUNDLE = {
      resourceType: "Bundle",
      type: "searchset",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "ImagingStudy",
            id: "study-unlabeled-42",
            subject: { reference: "Patient/p" },
            numberOfSeries: 0,
            numberOfInstances: 0,
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith("/api/fhir/Patient")) {
        return new Response(JSON.stringify(EMPTY_BUNDLE), { status: 200 });
      }
      return new Response(JSON.stringify(STUDY_BUNDLE), { status: 200 });
    }) as unknown as typeof fetch;

    render(<FhirExplorer />);

    // Switch to the ImagingStudy tab and wait for the fallback-labeled button
    const { default: userEvent } = await import("@testing-library/user-event");
    await screen.findByRole("tab", { name: "ImagingStudy" });
    await userEvent.click(screen.getByRole("tab", { name: "ImagingStudy" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /study-unlabeled-42/ })).toBeInTheDocument();
    });
  });
});
