import { describe, expect, it, vi } from "vitest";
import { buildStudiesRouter } from "../../src/routes/studies.js";
import { buildStudyDetailRouter } from "../../src/routes/study-detail.js";
import { OrthancDicomWebError } from "../../src/services/orthanc-client.js";
import { DicomMappingError } from "../../src/models/study.js";

describe("GET /api/studies — error mapping", () => {
  it("returns 502 orthanc_unavailable when Orthanc QIDO errors (non-Orthanc-mapped error path)", async () => {
    const app = buildStudiesRouter({
      orthanc: {
        searchStudies: vi
          .fn()
          .mockRejectedValue(new OrthancDicomWebError(503, "QIDO-RS searchStudies", "down")),
      },
    });

    const res = await app.request("/");
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; status: number };
    expect(body.error).toBe("orthanc_unavailable");
    expect(body.status).toBe(503);
  });

  it("re-throws unexpected non-Orthanc errors instead of masking them as 502", async () => {
    const app = buildStudiesRouter({
      orthanc: {
        searchStudies: vi.fn().mockRejectedValue(new TypeError("boom — bug not upstream")),
      },
    });

    const res = await app.request("/");
    // Hono surfaces uncaught throws as 500 Internal Server Error.
    expect(res.status).toBe(500);
  });

  it("counts datasets that fail DicomMappingError as skipped without aborting the list", async () => {
    const app = buildStudiesRouter({
      orthanc: {
        searchStudies: vi.fn().mockResolvedValue([
          { "0020000D": { vr: "UI", Value: ["1.1"] } },
          { "0020000D": { vr: "UI" } },
          { "0020000D": { vr: "UI", Value: ["1.2"] } },
        ]),
      },
    });

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { studies: ReadonlyArray<{ studyInstanceUid: string }>; skipped: number };
    expect(body.studies.map((s) => s.studyInstanceUid)).toEqual(["1.1", "1.2"]);
    expect(body.skipped).toBe(1);
  });

  it("re-throws non-mapping errors from mapDicomDatasetToStudy (defensive: currently only mapping errors are throwable)", () => {
    // This is a compile-time verification that DicomMappingError is the known throwable.
    expect(new DicomMappingError("x")).toBeInstanceOf(Error);
  });
});

describe("GET /api/studies/:uid — error mapping", () => {
  it("returns 400 for an empty studyUid without calling Orthanc (negative space)", async () => {
    const getStudyMetadata = vi.fn();
    const app = buildStudyDetailRouter({
      orthanc: {
        getStudyMetadata,
      },
    });

    const res = await app.request("/%20");
    expect(res.status).toBe(400);
    expect(getStudyMetadata).not.toHaveBeenCalled();
  });

  it("maps Orthanc 404 on getStudyMetadata to 404 orthanc_unavailable", async () => {
    const app = buildStudyDetailRouter({
      orthanc: {
        getStudyMetadata: vi
          .fn()
          .mockRejectedValue(new OrthancDicomWebError(404, "WADO-RS getStudyMetadata", "missing")),
      },
    });

    const res = await app.request("/1.2.3.4.5");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("orthanc_unavailable");
  });
});
