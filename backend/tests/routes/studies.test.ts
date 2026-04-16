import { describe, expect, it } from "vitest";
import { buildStudiesRouter } from "../../src/routes/studies.js";
import { OrthancDicomWebError } from "../../src/services/orthanc-client.js";
import type { DicomDataset } from "../../src/models/study.js";

const VALID_DATASET: DicomDataset = {
  "0020000D": { vr: "UI", Value: ["1.2.3"] },
  "00100010": { vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] },
};

const INVALID_DATASET: DicomDataset = {
  // no StudyInstanceUID → mapDicomDatasetToStudy throws
  "00100010": { vr: "PN", Value: [{ Alphabetic: "BROKEN" }] },
};

describe("GET /api/studies", () => {
  it("returns mapped studies and skipped=0 on a clean QIDO-RS result", async () => {
    const app = buildStudiesRouter({
      orthanc: { searchStudies: async () => [VALID_DATASET] },
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { studies: { patientName: string }[]; skipped: number };
    expect(body.skipped).toBe(0);
    expect(body.studies).toHaveLength(1);
    expect(body.studies[0]?.patientName).toBe("DOE^JANE");
  });

  it("skips malformed datasets and reports the skip count (no crash)", async () => {
    const app = buildStudiesRouter({
      orthanc: { searchStudies: async () => [VALID_DATASET, INVALID_DATASET] },
    });

    const res = await app.request("/");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { studies: unknown[]; skipped: number };
    expect(body.studies).toHaveLength(1);
    expect(body.skipped).toBe(1);
  });

  it("returns 502 with orthanc_unavailable when Orthanc errors", async () => {
    const app = buildStudiesRouter({
      orthanc: {
        searchStudies: async () => {
          throw new OrthancDicomWebError(503, "QIDO-RS searchStudies", "service unavailable");
        },
      },
    });

    const res = await app.request("/");

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; status: number };
    expect(body.error).toBe("orthanc_unavailable");
    expect(body.status).toBe(503);
  });
});
