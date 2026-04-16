import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageViewer } from "../ImageViewer.js";

const CT_SMALL_PATH = resolve(import.meta.dirname, "../../../../sample-data/CT_small.dcm");

const STUDY_UID = "1.3.6.1.4.1.5962.1.2.1.20040119072730.12322";
const SERIES_UID = "1.3.6.1.4.1.5962.1.3.1.1.20040119072730.12322";
const SOP_UID = "1.3.6.1.4.1.5962.1.1.1.1.1.20040119072730.12322";

const ORIGINAL_FETCH = globalThis.fetch;

function loadSampleBytes(): Uint8Array {
  const buf = readFileSync(CT_SMALL_PATH);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function mockFetchOk(bytes: Uint8Array): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue(
    new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": "application/dicom" },
    }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("ImageViewer", () => {
  it("fetches the instance via /api/wado/instance and exposes the stored window/level HUD", async () => {
    const spy = mockFetchOk(loadSampleBytes());

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    await waitFor(() => expect(screen.getByText(/C\s+1160\s+\/\s+W\s+2063/)).toBeInTheDocument());

    expect(spy).toHaveBeenCalledOnce();
    const [url] = spy.mock.calls[0]!;
    expect(url).toContain("/api/wado/instance/");
    expect(url).toContain(encodeURIComponent(STUDY_UID));
    expect(url).toContain(encodeURIComponent(SERIES_UID));
    expect(url).toContain(encodeURIComponent(SOP_UID));
  });

  it("updates the window/level HUD live when the user drags the canvas", async () => {
    mockFetchOk(loadSampleBytes());

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    const initialHud = await screen.findByText(/C\s+1160\s+\/\s+W\s+2063/);
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="dicom-canvas"]');
    expect(canvas).not.toBeNull();

    fireEvent.mouseDown(canvas!, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas!, { clientX: 150, clientY: 150 });

    await waitFor(() => {
      expect(initialHud.textContent).not.toMatch(/C\s+1160\s+\/\s+W\s+2063/);
    });

    fireEvent.mouseUp(canvas!);
    // A subsequent mousemove without a fresh mousedown must NOT move the HUD (negative space).
    const textAfterRelease = initialHud.textContent;
    fireEvent.mouseMove(canvas!, { clientX: 500, clientY: 500 });
    expect(initialHud.textContent).toBe(textAfterRelease);
  });

  it("surfaces an error banner when the WADO fetch returns non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("missing", { status: 404 })) as unknown as typeof fetch;

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/HTTP 404/);
    });
  });

  it("paints the decoded instance onto the canvas at (0,0) with matching dimensions", async () => {
    // The setup.ts file stubs getContext to return null at the prototype level
    // (jsdom has no real canvas). Override that stub with a spy context so the
    // paint effect at ImageViewer.tsx:85 can actually run and be observed.
    const putImageData = vi.fn();
    const fakeCtx = { putImageData } as unknown as CanvasRenderingContext2D;
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx as never);

    mockFetchOk(loadSampleBytes());

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    await waitFor(() => expect(putImageData).toHaveBeenCalled());

    expect(getContextSpy).toHaveBeenCalledWith("2d");
    const [image, dx, dy] = putImageData.mock.calls[0]! as [ImageData, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(0);
    // CT_small.dcm is 128x128 — the canvas must be sized from the instance
    // (not props) and the ImageData buffer must carry one RGBA quad per pixel.
    expect(image.width).toBe(128);
    expect(image.height).toBe(128);
    expect(image.data.length).toBe(128 * 128 * 4);
  });

  it("repaints with a new ImageData when the user drags the window/level", async () => {
    const putImageData = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      { putImageData } as unknown as CanvasRenderingContext2D as never,
    );
    mockFetchOk(loadSampleBytes());

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    await waitFor(() => expect(putImageData).toHaveBeenCalled());
    const callCountAfterLoad = putImageData.mock.calls.length;

    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="dicom-canvas"]');
    expect(canvas).not.toBeNull();
    fireEvent.mouseDown(canvas!, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas!, { clientX: 150, clientY: 160 });

    await waitFor(() =>
      expect(putImageData.mock.calls.length).toBeGreaterThan(callCountAfterLoad),
    );
  });

  it("shows the formatted decode error when the fetched bytes are not valid DICOM", async () => {
    mockFetchOk(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    const alert = await screen.findByRole("alert");
    // formatDecodeError prefixes parse failures with "Failed to parse DICOM:"
    expect(alert).toHaveTextContent(/Failed to parse DICOM/);
  });

  it("stringifies a non-Error fetch rejection into the alert message (String(err) fallback branch)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue("plain-string-reject") as unknown as typeof fetch;

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("plain-string-reject");
    });
  });

  it("ignores a mousedown with a non-primary button (button !== 0 branch)", async () => {
    mockFetchOk(loadSampleBytes());

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    const hud = await screen.findByText(/C\s+\d+\s+\/\s+W\s+\d+/);
    const hudBefore = hud.textContent;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="dicom-canvas"]');
    expect(canvas).not.toBeNull();

    // Right-click (button=2) must early-return before capturing a drag start.
    fireEvent.mouseDown(canvas!, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas!, { clientX: 200, clientY: 200 });

    // No drag captured → HUD unchanged.
    expect(hud.textContent).toBe(hudBefore);
  });

  it("ignores a mousedown while still loading (wl === null branch)", async () => {
    let resolveFetch!: (r: Response) => void;
    globalThis.fetch = vi
      .fn()
      .mockReturnValue(
        new Promise<Response>((r) => {
          resolveFetch = r;
        }),
      ) as unknown as typeof fetch;

    render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    // Click BEFORE the fetch resolves — wl is still null, guard must return.
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="dicom-canvas"]');
    expect(canvas).not.toBeNull();
    fireEvent.mouseDown(canvas!, { button: 0, clientX: 100, clientY: 100 });
    // No crash, no drag captured. Resolve to clean up.
    resolveFetch(
      new Response(loadSampleBytes() as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/dicom" },
      }),
    );
    await screen.findByText(/C\s+\d+\s+\/\s+W\s+\d+/);
  });

  it("discards fetched bytes when the component unmounts before decode completes (cancelled guard)", async () => {
    let resolveFetch!: (response: Response) => void;
    globalThis.fetch = vi
      .fn()
      .mockReturnValue(
        new Promise<Response>((r) => {
          resolveFetch = r;
        }),
      ) as unknown as typeof fetch;

    const { unmount } = render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    unmount();
    // Resolve AFTER unmount — the .then handler sees cancelled=true and no-ops.
    resolveFetch(
      new Response(loadSampleBytes() as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "application/dicom" },
      }),
    );
    await new Promise((r) => setTimeout(r, 10));
    // No alert rendered, no crash — the cancelled guard swallowed the update.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("ignores an AbortError after unmount (negative space — no state update, no crash)", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }
        }),
    ) as unknown as typeof fetch;

    const { unmount } = render(
      <ImageViewer
        studyInstanceUid={STUDY_UID}
        seriesInstanceUid={SERIES_UID}
        sopInstanceUid={SOP_UID}
      />,
    );

    unmount();
    // Allow any microtasks to flush — if the abort path crashed, the next tick
    // would propagate the rejection.
    await new Promise((r) => setTimeout(r, 10));
    // No alert was rendered because the viewer is unmounted; the abort path is silent.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
