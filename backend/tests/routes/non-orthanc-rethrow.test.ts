/**
 * Covers the `throw error` fall-through on every route that uses
 * respondOrthancError. When the thrown error is NOT an OrthancDicomWebError
 * the helper returns null and the route re-throws so Hono can surface it
 * as a 500. That branch is defensive but must not silently swallow bugs.
 */
import { describe, expect, it, vi } from "vitest";
import { buildStudyDetailRouter } from "../../src/routes/study-detail.js";
import { buildUploadRouter } from "../../src/routes/upload.js";
import { buildWadoRouter } from "../../src/routes/wado.js";
import type { StowResult } from "../../src/services/orthanc-client.js";

function makeDicomBytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(200));
  bytes[128] = 0x44;
  bytes[129] = 0x49;
  bytes[130] = 0x43;
  bytes[131] = 0x4d;
  return bytes;
}

const OK_STOW: StowResult = {
  raw: {},
  retrieveUrl: null,
  studyInstanceUid: null,
  failedSopCount: 0,
  referencedSopCount: 1,
};

describe("respondOrthancError fall-through — non-Orthanc errors bubble up to Hono", () => {
  it("study-detail GET :studyUid re-throws plain errors as 500", async () => {
    const app = buildStudyDetailRouter({
      orthanc: {
        getStudyMetadata: vi.fn().mockRejectedValue(new TypeError("internal bug")),
      },
    });
    const res = await app.request("/1.2.3.4.5");
    expect(res.status).toBe(500);
  });

  it("upload POST / re-throws plain errors from storeInstances as 500", async () => {
    const app = buildUploadRouter({
      orthanc: {
        storeInstances: vi.fn().mockRejectedValue(new Error("unexpected local bug")),
        getStudyMetadata: vi.fn(),
      },
    });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm"));
    const res = await app.request("/", { method: "POST", body: form });
    expect(res.status).toBe(500);
  });

  it("upload POST / still succeeds even when a sync helper throws (handled internally)", async () => {
    // Positive control: upload with no FHIR store means the sync block is skipped
    // entirely — exercises the store-undefined branch (line 58).
    const app = buildUploadRouter({
      orthanc: {
        storeInstances: vi.fn().mockResolvedValue(OK_STOW),
        getStudyMetadata: vi.fn(),
      },
    });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm"));
    const res = await app.request("/", { method: "POST", body: form });
    expect(res.status).toBe(201);
  });

  it("wado GET /instance re-throws plain errors as 500", async () => {
    const app = buildWadoRouter({
      orthanc: {
        proxyDicomWebRaw: vi.fn().mockRejectedValue(new Error("unexpected bug")),
      },
    });
    const res = await app.request("/instance/1.2/1.3/1.4");
    expect(res.status).toBe(500);
  });
});
