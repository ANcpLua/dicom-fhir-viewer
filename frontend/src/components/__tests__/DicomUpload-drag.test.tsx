import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DicomUpload } from "../DicomUpload.js";

const ORIGINAL_FETCH = globalThis.fetch;

function makeDicomFile(name = "ct.dcm"): File {
  return new File([new Uint8Array([0x44, 0x49, 0x43, 0x4d])], name, {
    type: "application/dicom",
  });
}

function mockFetchOk(): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ fileCount: 1, referencedSopCount: 1, failedSopCount: 0, retrieveUrl: null }),
      { status: 201 },
    ),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("DicomUpload — drag and drop", () => {
  it("uploads files delivered via the drop event and fires onUploaded", async () => {
    const spy = mockFetchOk();
    const onUploaded = vi.fn();
    render(<DicomUpload onUploaded={onUploaded} />);

    const dropzone = screen.getByRole("button", { name: /upload dicom files/i });
    const file = makeDicomFile();

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
    fireEvent.dragOver(dropzone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/uploaded 1 file/i));
    expect(spy).toHaveBeenCalledOnce();
    expect(onUploaded).toHaveBeenCalledOnce();
  });

  it("toggles the drag-over state without uploading when files leave the dropzone before drop (negative space)", async () => {
    const spy = mockFetchOk();
    render(<DicomUpload />);

    const dropzone = screen.getByRole("button", { name: /upload dicom files/i });

    fireEvent.dragEnter(dropzone);
    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);

    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing on unrelated keypresses (negative space)", () => {
    render(<DicomUpload />);
    const dropzone = screen.getByRole("button", { name: /upload dicom files/i });
    const input = screen.getByTestId("dicom-file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    fireEvent.keyDown(dropzone, { key: "Escape" });
    fireEvent.keyDown(dropzone, { key: "a" });

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("does not upload an empty drop payload (negative space)", () => {
    const spy = mockFetchOk();
    render(<DicomUpload />);
    const dropzone = screen.getByRole("button", { name: /upload dicom files/i });

    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });

    expect(spy).not.toHaveBeenCalled();
  });
});
