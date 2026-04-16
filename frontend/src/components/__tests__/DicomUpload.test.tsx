import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DicomUpload } from "../DicomUpload.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

function mockFetch(response: Response | (() => Response)): ReturnType<typeof vi.fn> {
  const resolver = typeof response === "function" ? response : () => response;
  const spy = vi.fn().mockImplementation(() => Promise.resolve(resolver()));
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function makeDicomFile(name = "ct.dcm"): File {
  return new File([new Uint8Array([0x44, 0x49, 0x43, 0x4d])], name, { type: "application/dicom" });
}

describe("DicomUpload", () => {
  it("uploads selected files via POST /api/upload and shows the success line", async () => {
    const spy = mockFetch(
      new Response(
        JSON.stringify({ fileCount: 1, referencedSopCount: 1, failedSopCount: 0, retrieveUrl: null }),
        { status: 201 },
      ),
    );
    const onUploaded = vi.fn();
    render(<DicomUpload onUploaded={onUploaded} />);

    const input = screen.getByTestId("dicom-file-input") as HTMLInputElement;
    await userEvent.upload(input, makeDicomFile());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/uploaded 1 file/i));
    expect(spy).toHaveBeenCalledOnce();
    expect(onUploaded).toHaveBeenCalledOnce();
  });

  it("surfaces the backend error as an alert when upload fails", async () => {
    mockFetch(new Response("boom", { status: 500 }));
    render(<DicomUpload />);

    const input = screen.getByTestId("dicom-file-input") as HTMLInputElement;
    await userEvent.upload(input, makeDicomFile());

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/upload error/i);
      expect(alert).toHaveTextContent(/500/);
    });
  });

  it("does not call the backend when the user selects no files (negative space)", async () => {
    const spy = mockFetch(new Response("{}", { status: 200 }));
    render(<DicomUpload />);

    // userEvent.upload with an empty array is a no-op; the change event carries an empty FileList.
    const input = screen.getByTestId("dicom-file-input") as HTMLInputElement;
    await userEvent.upload(input, []);

    expect(spy).not.toHaveBeenCalled();
  });

  it("opens the file picker when the drop zone is activated via keyboard (Enter)", async () => {
    mockFetch(new Response("{}", { status: 200 }));
    render(<DicomUpload />);

    const input = screen.getByTestId("dicom-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    const dropzone = screen.getByRole("button", { name: /upload dicom files/i });
    dropzone.focus();
    await userEvent.keyboard("{Enter}");

    expect(clickSpy).toHaveBeenCalled();
  });
});
