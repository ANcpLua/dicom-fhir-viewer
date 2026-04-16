import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyDetail } from "../StudyDetail.js";

const ORIGINAL_FETCH = globalThis.fetch;

const STUDY_UID = "1.2.840.113619.2.55.3.604688119.969.1268071029.320";

function renderAt(uid: string) {
  return render(
    <MemoryRouter initialEntries={[`/studies/${encodeURIComponent(uid)}`]}>
      <Routes>
        <Route path="studies/:studyUid" element={<StudyDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("StudyDetail — edge cases", () => {
  it("renders the 'No series found' empty state when the study has zero series (negative space)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          studyInstanceUid: STUDY_UID,
          patientName: "DOE^JANE",
          patientId: null,
          patientSex: null,
          studyDate: null,
          studyDescription: null,
          series: [],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    renderAt(STUDY_UID);

    await waitFor(() => expect(screen.getByText(/No series found/i)).toBeInTheDocument());
    expect(screen.getByText(/No instance available/i)).toBeInTheDocument();
  });

  it("renders the error banner and no series tree when the detail fetch fails", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("down", { status: 503 })) as unknown as typeof fetch;

    renderAt(STUDY_UID);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/503/);
    });
    expect(screen.queryByRole("navigation", { name: /series and instances/i })).toBeNull();
  });
});
