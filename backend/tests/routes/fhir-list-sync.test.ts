import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFhirRouter } from "../../src/routes/fhir.js";
import { SqliteFhirStore } from "../../src/services/fhir-store.js";
import type { DicomDataset } from "../../src/models/study.js";

const STUDY_UID = "1.2.840.113619.2.55.3.999";

const METADATA: DicomDataset = {
  "0020000D": { vr: "UI", Value: [STUDY_UID] },
  "00100010": { vr: "PN", Value: [{ Alphabetic: "TEST^ONE" }] },
  "00100020": { vr: "LO", Value: ["PID-1"] },
  "00080060": { vr: "CS", Value: ["CT"] },
  "0020000E": { vr: "UI", Value: ["1.2.840.113619.2.55.3.999.1"] },
  "00080018": { vr: "UI", Value: ["1.2.840.113619.2.55.3.999.1.1"] },
};

describe("buildFhirRouter — list + sync branches", () => {
  let store: SqliteFhirStore;

  beforeEach(() => {
    store = new SqliteFhirStore({ path: ":memory:" });
  });

  afterEach(() => {
    store.close();
  });

  it("GET /ImagingStudy returns an empty searchset Bundle when the store is empty", async () => {
    const app = buildFhirRouter({
      store,
      orthanc: {
        searchStudies: vi.fn(),
        getStudyMetadata: vi.fn(),
      },
      endpointAddress: "http://localhost:8042/dicom-web",
    });

    const res = await app.request("/ImagingStudy");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; entry: ReadonlyArray<unknown> };
    expect(body.total).toBe(0);
    expect(body.entry).toEqual([]);
  });

  it("GET /ImagingStudy/:id returns OperationOutcome 404 for an unknown id", async () => {
    const app = buildFhirRouter({
      store,
      orthanc: {
        searchStudies: vi.fn(),
        getStudyMetadata: vi.fn(),
      },
      endpointAddress: "http://localhost:8042/dicom-web",
    });

    const res = await app.request("/ImagingStudy/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      resourceType: string;
      issue: { code: string; diagnostics: string }[];
    };
    expect(body.resourceType).toBe("OperationOutcome");
    expect(body.issue[0]?.code).toBe("not-found");
    expect(body.issue[0]?.diagnostics).toMatch(/ImagingStudy\/nope/);
  });

  it("POST /sync runs syncAllStudies and returns the aggregated counts + errors", async () => {
    const searchStudies = vi.fn().mockResolvedValue([METADATA]);
    const getStudyMetadata = vi.fn().mockResolvedValue([METADATA]);
    const app = buildFhirRouter({
      store,
      orthanc: { searchStudies, getStudyMetadata },
      endpointAddress: "http://localhost:8042/dicom-web",
    });

    const res = await app.request("/sync", { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      syncedStudies: number;
      syncedPatients: number;
      errors: ReadonlyArray<unknown>;
    };
    expect(body.syncedStudies).toBe(1);
    expect(body.syncedPatients).toBe(1);
    expect(body.errors).toEqual([]);
    expect(store.counts()).toEqual({ patients: 1, imagingStudies: 1 });
  });

  it("POST /sync returns zero counts on an empty Orthanc (negative space)", async () => {
    const app = buildFhirRouter({
      store,
      orthanc: {
        searchStudies: vi.fn().mockResolvedValue([]),
        getStudyMetadata: vi.fn(),
      },
      endpointAddress: "http://localhost:8042/dicom-web",
    });

    const res = await app.request("/sync", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { syncedStudies: number; syncedPatients: number };
    expect(body.syncedStudies).toBe(0);
    expect(body.syncedPatients).toBe(0);
    expect(store.counts()).toEqual({ patients: 0, imagingStudies: 0 });
  });
});
