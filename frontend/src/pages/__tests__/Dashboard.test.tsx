import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../Dashboard.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("Dashboard page", () => {
  it("fetches stats on mount and renders the summary cards", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          totalPatients: 2,
          totalStudies: 3,
          totalInstances: 120,
          modalityDistribution: [{ modality: "CT", count: 3 }],
          studiesByDate: [{ date: "2024-03-15", count: 3 }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(<Dashboard />);

    await waitFor(() => expect(screen.getByText("Patients").nextSibling).toHaveTextContent("2"));
    expect(screen.getByText("Imaging Studies").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Instances").nextSibling).toHaveTextContent("120");
    expect(screen.getByText("CT")).toBeInTheDocument();
  });

  it("surfaces a backend error as an alert", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500 })) as unknown as typeof fetch;

    render(<Dashboard />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/500/));
  });
});
