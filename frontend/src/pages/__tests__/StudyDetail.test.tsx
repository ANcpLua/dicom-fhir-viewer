import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudyDetail } from "../StudyDetail.js";

const ORIGINAL_FETCH = globalThis.fetch;

const STUDY_UID = "1.2.840.113619.2.55.3.320";

const DETAIL = {
  studyInstanceUid: STUDY_UID,
  patientName: "DOE^JANE",
  patientId: "PAT-1",
  patientSex: "F",
  studyDate: "20240315",
  studyDescription: "MR Brain",
  series: [
    {
      seriesInstanceUid: "1.2.3.1",
      seriesNumber: 1,
      seriesDescription: "T1",
      modality: "MR",
      manufacturer: "SIEMENS",
      instances: [
        {
          sopInstanceUid: "1.2.3.1.1",
          sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
          instanceNumber: 1,
          rows: 256,
          columns: 256,
          bitsAllocated: 16,
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  // Flush pending React effects (e.g. ImageViewer's useEffect) while the env
  // is still stubbed.  RTL's auto-cleanup afterEach is registered before this
  // one, so in LIFO order it would run AFTER us — too late.  Calling cleanup()
  // here ensures act() drains the scheduler before we pull the env var.
  cleanup();
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("StudyDetail page", () => {
  function renderRoute() {
    return render(
      <MemoryRouter initialEntries={[`/studies/${STUDY_UID}`]}>
        <Routes>
          <Route path="studies/:studyUid" element={<StudyDetail />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("renders series tree, auto-selects the first instance, and links the rendered image URL", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(DETAIL), { status: 200 })) as unknown as typeof fetch;

    renderRoute();

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 2, name: "DOE^JANE" })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Series 1 · MR/)).toBeInTheDocument();
    // ImageViewer container exposes the SOP instance UID via aria-label
    expect(
      screen.getByRole("img", { name: "DICOM instance 1.2.3.1.1" }),
    ).toBeInTheDocument();
    // TagsPanel mirrors the selected instance
    expect(screen.getByText("Modality").nextSibling).toHaveTextContent("MR");
    expect(screen.getByText("Dimensions").nextSibling).toHaveTextContent("256 × 256");
  });

  it("renders em-dash placeholders for null patient/series/instance fields (defensive fallbacks)", async () => {
    const nullFields = {
      studyInstanceUid: STUDY_UID,
      patientName: null,
      patientId: null,
      patientSex: null,
      studyDate: null,
      studyDescription: null,
      series: [
        {
          seriesInstanceUid: "1.2.3.1",
          seriesNumber: null,
          seriesDescription: null,
          modality: null,
          manufacturer: null,
          instances: [
            {
              sopInstanceUid: "1.2.3.1.1",
              sopClassUid: null,
              instanceNumber: null,
              rows: null,
              columns: null,
              bitsAllocated: null,
            },
          ],
        },
      ],
    };
    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.includes("/api/wado/instance/")) {
        return new Response(new Uint8Array([0xde, 0xad]) as unknown as BodyInit, {
          status: 200,
          headers: { "Content-Type": "application/dicom" },
        });
      }
      return new Response(JSON.stringify(nullFields), { status: 200 });
    }) as unknown as typeof fetch;

    renderRoute();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: /no patient name/i }),
      ).toBeInTheDocument(),
    );
    // Series header renders em-dashes for number / modality / description
    expect(screen.getByText(/Series — · —/)).toBeInTheDocument();
    // Instance button renders em-dash for number and omits the dimensions span
    expect(screen.getByRole("button", { name: /Instance —/ })).toBeInTheDocument();
  });

  it("falls back to an empty studyUid when the route param is missing (params.studyUid ?? '' branch)", async () => {
    // useAsyncResource will surface the TypeError thrown by getStudyDetail("") as an error state.
    render(
      <MemoryRouter initialEntries={["/studies"]}>
        <Routes>
          <Route path="studies" element={<StudyDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/non-empty/),
    );
  });

  it("shows the backend error via alert when the detail fetch fails", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 404 })) as unknown as typeof fetch;

    renderRoute();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/404/));
  });

  it("selects a non-first instance on click, skipping the earlier instance in the useMemo loop", async () => {
    const multiInstance = {
      ...DETAIL,
      series: [
        {
          seriesInstanceUid: "1.2.3.1",
          seriesNumber: 1,
          seriesDescription: "T1",
          modality: "MR",
          manufacturer: "SIEMENS",
          instances: [
            {
              sopInstanceUid: "1.2.3.1.1",
              sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
              instanceNumber: 1,
              rows: 256,
              columns: 256,
              bitsAllocated: 16,
            },
            {
              sopInstanceUid: "1.2.3.1.2",
              sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
              instanceNumber: 2,
              rows: 256,
              columns: 256,
              bitsAllocated: 16,
            },
          ],
        },
      ],
    };
    // Respond for both the study detail fetch AND the ImageViewer's WADO fetch.
    globalThis.fetch = vi.fn().mockImplementation(async (input: string) => {
      if (input.includes("/api/wado/instance/")) {
        return new Response(new Uint8Array([0xde, 0xad]) as unknown as BodyInit, {
          status: 200,
          headers: { "Content-Type": "application/dicom" },
        });
      }
      return new Response(JSON.stringify(multiInstance), { status: 200 });
    }) as unknown as typeof fetch;

    renderRoute();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "DOE^JANE" })).toBeInTheDocument(),
    );

    // Two instance buttons — default selects the first (instanceNumber=1, "active").
    // The second (instanceNumber=2) renders with the inactive className branch.
    const instanceButtons = screen.getAllByRole("button", { name: /Instance/ });
    expect(instanceButtons.length).toBeGreaterThanOrEqual(2);

    // Click the second instance. The useMemo loop must iterate past the first
    // (non-matching) instance and return the second one. Then the ImageViewer
    // re-renders with the new SOP UID.
    await userEvent.click(instanceButtons[1]!);

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "DICOM instance 1.2.3.1.2" }),
      ).toBeInTheDocument(),
    );
  });
});
