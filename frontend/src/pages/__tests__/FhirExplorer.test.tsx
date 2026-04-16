import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FhirExplorer } from "../FhirExplorer.js";

const ORIGINAL_FETCH = globalThis.fetch;

const PATIENT_BUNDLE = {
  resourceType: "Bundle",
  type: "searchset",
  total: 1,
  entry: [
    {
      resource: {
        resourceType: "Patient",
        id: "patient-1CT1",
        name: [{ text: "CompressedSamples^CT1" }],
      },
    },
  ],
};

const STUDY_BUNDLE = {
  resourceType: "Bundle",
  type: "searchset",
  total: 1,
  entry: [
    {
      resource: {
        resourceType: "ImagingStudy",
        id: "study-1",
        subject: { reference: "Patient/patient-1CT1" },
        numberOfSeries: 1,
        numberOfInstances: 1,
      },
    },
  ],
};

const PATIENT_DETAIL = {
  resourceType: "Patient",
  id: "patient-1CT1",
  identifier: [{ system: "urn:dicom:patient-id", value: "1CT1" }],
  gender: "other",
};

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("FhirExplorer page", () => {
  it("lists Patient resources and renders the raw JSON on click", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith("/api/fhir/Patient")) return new Response(JSON.stringify(PATIENT_BUNDLE), { status: 200 });
      if (input.endsWith("/api/fhir/ImagingStudy")) return new Response(JSON.stringify(STUDY_BUNDLE), { status: 200 });
      if (input.endsWith("/api/fhir/Patient/patient-1CT1"))
        return new Response(JSON.stringify(PATIENT_DETAIL), { status: 200 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    render(<FhirExplorer />);

    const listButton = await screen.findByRole("button", { name: /CompressedSamples\^CT1/i });
    await userEvent.click(listButton);

    await waitFor(() => expect(screen.getByText(/"patient-1CT1"/)).toBeInTheDocument());
    expect(screen.getByText(/"urn:dicom:patient-id"/)).toBeInTheDocument();
  });

  it("renders an error alert in the detail pane when the resource fetch fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith("/api/fhir/Patient"))
        return new Response(JSON.stringify(PATIENT_BUNDLE), { status: 200 });
      if (input.endsWith("/api/fhir/ImagingStudy"))
        return new Response(JSON.stringify(STUDY_BUNDLE), { status: 200 });
      if (input.includes("/api/fhir/Patient/patient-1CT1"))
        return new Response("boom", { status: 500 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    render(<FhirExplorer />);

    const listButton = await screen.findByRole("button", {
      name: /CompressedSamples\^CT1/i,
    });
    await userEvent.click(listButton);

    // The detail pane's error branch (ResourceJson role="alert") must fire.
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      const detailAlert = alerts.find((a) => /Error:/.test(a.textContent ?? ""));
      expect(detailAlert).toBeDefined();
    });
  });

  it("switches tabs to ImagingStudy and resets the selected resource", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.endsWith("/api/fhir/Patient")) return new Response(JSON.stringify(PATIENT_BUNDLE), { status: 200 });
      if (input.endsWith("/api/fhir/ImagingStudy")) return new Response(JSON.stringify(STUDY_BUNDLE), { status: 200 });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;

    render(<FhirExplorer />);

    await screen.findByRole("button", { name: /CompressedSamples\^CT1/i });
    await userEvent.click(screen.getByRole("tab", { name: "ImagingStudy" }));

    await screen.findByRole("button", { name: /study-1/ });
    expect(screen.queryByRole("button", { name: /CompressedSamples\^CT1/i })).toBeNull();
  });
});
