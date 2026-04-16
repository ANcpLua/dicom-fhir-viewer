import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  getStudyDetail,
  listStudies,
  uploadDicom,
} from "../api.js";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000/");
});

afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = ORIGINAL_FETCH;
});

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue(response);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe("listStudies", () => {
  it("GETs /api/studies on the configured backend and returns the parsed body", async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ studies: [{ studyInstanceUid: "1.2.3" }], skipped: 0 }), {
        status: 200,
      }),
    );

    const result = await listStudies();

    expect(spy).toHaveBeenCalledWith("http://backend:3000/api/studies", {});
    expect(result.studies).toHaveLength(1);
    expect(result.skipped).toBe(0);
  });

  it("throws ApiError with the HTTP status on non-2xx", async () => {
    mockFetch(new Response("down", { status: 502 }));
    await expect(listStudies()).rejects.toMatchObject({ name: "ApiError", status: 502 });
  });

  it("forwards an AbortSignal on init when provided", async () => {
    const spy = mockFetch(new Response("{\"studies\":[],\"skipped\":0}", { status: 200 }));
    const ctrl = new AbortController();

    await listStudies(ctrl.signal);

    expect(spy.mock.calls[0]?.[1]).toMatchObject({ signal: ctrl.signal });
  });
});

describe("getStudyDetail", () => {
  it("GETs /api/studies/{uid} and returns the parsed detail", async () => {
    const spy = mockFetch(
      new Response(
        JSON.stringify({
          studyInstanceUid: "1.2.3",
          patientName: "DOE^JANE",
          patientId: null,
          patientSex: null,
          patientBirthDate: null,
          studyDate: null,
          studyDescription: null,
          series: [],
        }),
        { status: 200 },
      ),
    );

    const detail = await getStudyDetail("1.2.3");

    expect(spy.mock.calls[0]?.[0]).toBe("http://backend:3000/api/studies/1.2.3");
    expect(detail.patientName).toBe("DOE^JANE");
  });

  it("rejects an empty UID without calling fetch", async () => {
    const spy = mockFetch(new Response("{}", { status: 200 }));
    await expect(getStudyDetail("  ")).rejects.toThrow(TypeError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws ApiError on 404", async () => {
    mockFetch(new Response("missing", { status: 404 }));
    await expect(getStudyDetail("1.2.3")).rejects.toMatchObject({ name: "ApiError", status: 404 });
  });
});

describe("uploadDicom", () => {
  it("POSTs a FormData body with each file under field 'file' and returns the summary", async () => {
    const spy = mockFetch(
      new Response(
        JSON.stringify({ fileCount: 2, referencedSopCount: 2, failedSopCount: 0, retrieveUrl: null }),
        { status: 201 },
      ),
    );
    const files = [
      new File([new Uint8Array([0x44, 0x49, 0x43, 0x4d])], "a.dcm", { type: "application/dicom" }),
      new File([new Uint8Array([0x44, 0x49, 0x43, 0x4d])], "b.dcm", { type: "application/dicom" }),
    ];

    const result = await uploadDicom(files);

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://backend:3000/api/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.getAll("file")).toHaveLength(2);
    expect(result.fileCount).toBe(2);
  });

  it("rejects with TypeError when called with no files (no network call)", async () => {
    const spy = mockFetch(new Response("nope", { status: 500 }));
    await expect(uploadDicom([])).rejects.toThrow(TypeError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws ApiError when the upload endpoint returns 400", async () => {
    mockFetch(new Response("not dicom", { status: 400 }));
    const files = [new File([new Uint8Array(4)], "x.dcm")];
    await expect(uploadDicom(files)).rejects.toBeInstanceOf(ApiError);
  });
});
