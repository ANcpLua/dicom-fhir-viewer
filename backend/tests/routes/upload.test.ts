import { describe, expect, it, vi } from "vitest";
import { buildUploadRouter } from "../../src/routes/upload.js";
import { OrthancDicomWebError, type StowResult } from "../../src/services/orthanc-client.js";

function makeDicomBytes(payloadSize = 16): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(128 + 4 + payloadSize));
  bytes[128] = 0x44; // D
  bytes[129] = 0x49; // I
  bytes[130] = 0x43; // C
  bytes[131] = 0x4d; // M
  for (let i = 0; i < payloadSize; i += 1) bytes[132 + i] = (i * 31) & 0xff;
  return bytes;
}

function makePlainBytes(size: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(size));
}

function stubStow(result: StowResult): {
  storeInstances: (...args: unknown[]) => Promise<StowResult>;
  getStudyMetadata: (...args: unknown[]) => Promise<never>;
} {
  return {
    storeInstances: vi.fn().mockResolvedValue(result),
    getStudyMetadata: vi.fn().mockRejectedValue(new Error("not wired in unit test")),
  };
}

const OK_STOW: StowResult = {
  raw: {},
  retrieveUrl: "http://orthanc/studies/1.2.3",
  studyInstanceUid: "1.2.3",
  failedSopCount: 0,
  referencedSopCount: 1,
};

describe("POST /api/upload", () => {
  it("stores a valid DICOM file and returns 201 with the STOW summary", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm", { type: "application/dicom" }));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { fileCount: number; retrieveUrl: string };
    expect(body.fileCount).toBe(1);
    expect(body.retrieveUrl).toBe("http://orthanc/studies/1.2.3");
    expect(stub.storeInstances).toHaveBeenCalledOnce();
  });

  it("rejects non-multipart requests with 415 without touching Orthanc", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(res.status).toBe(415);
    expect(stub.storeInstances).not.toHaveBeenCalled();
  });

  it("rejects empty multipart bodies with 400 without touching Orthanc", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    const res = await app.request("/", { method: "POST", body: new FormData() });

    expect(res.status).toBe(400);
    expect(stub.storeInstances).not.toHaveBeenCalled();
  });

  it("rejects a non-DICOM file (missing DICM magic) with 400 without touching Orthanc", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    const form = new FormData();
    form.append("file", new File([makePlainBytes(200)], "fake.dcm", { type: "application/dicom" }));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; filename: string };
    expect(body.error).toMatch(/DICM/);
    expect(body.filename).toBe("fake.dcm");
    expect(stub.storeInstances).not.toHaveBeenCalled();
  });

  it("rejects a form field 'file' that is not a File part (string value) with 400", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    const form = new FormData();
    form.append("file", "not-a-file-just-a-string");
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/must be a file/);
    expect(stub.storeInstances).not.toHaveBeenCalled();
  });

  it("rejects a request with no Content-Type header as 415 (hits the `?? ''` header fallback)", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    // app.request with a raw Request object that carries no headers at all
    const req = new Request("http://localhost/", { method: "POST" });
    const res = await app.request(req);

    expect(res.status).toBe(415);
    expect(stub.storeInstances).not.toHaveBeenCalled();
  });

  it("rejects a file shorter than the 132-byte DICM magic offset with 400", async () => {
    const stub = stubStow(OK_STOW);
    const app = buildUploadRouter({ orthanc: stub });

    const form = new FormData();
    form.append("file", new File([new Uint8Array(50)], "tiny.dcm", { type: "application/dicom" }));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(400);
    expect(stub.storeInstances).not.toHaveBeenCalled();
  });

  it("returns 502 orthanc_stow_failed when Orthanc STOW-RS errors", async () => {
    const app = buildUploadRouter({
      orthanc: {
        storeInstances: async () => {
          throw new OrthancDicomWebError(400, "STOW-RS storeInstances", "bad dicom");
        },
        getStudyMetadata: async () => {
          throw new Error("unused");
        },
      },
    });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm"));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; status: number };
    expect(body.error).toBe("orthanc_stow_failed");
    expect(body.status).toBe(400);
  });
});
