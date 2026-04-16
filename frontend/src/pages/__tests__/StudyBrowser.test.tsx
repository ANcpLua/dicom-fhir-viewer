import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyBrowser } from "../StudyBrowser.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("StudyBrowser page", () => {
  it("loads studies on mount and renders them in the table", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          studies: [
            {
              studyInstanceUid: "1.2.3",
              patientName: "DOE^JANE",
              patientId: "PAT-1",
              patientBirthDate: null,
              patientSex: "F",
              studyDate: "20240315",
              studyDescription: "MR Brain",
              accessionNumber: null,
              numberOfSeries: 3,
              numberOfInstances: 47,
            },
          ],
          skipped: 0,
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    render(
      <MemoryRouter>
        <StudyBrowser />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("DOE^JANE")).toBeInTheDocument());
    expect(screen.getByText("2024-03-15")).toBeInTheDocument();
  });

  it("renders the error banner when the backend fails", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("down", { status: 502 })) as unknown as typeof fetch;

    render(
      <MemoryRouter>
        <StudyBrowser />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/502/);
    });
  });
});
