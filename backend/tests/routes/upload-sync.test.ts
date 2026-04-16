import { describe, expect, it, vi } from "vitest";
import { buildUploadRouter } from "../../src/routes/upload.js";
import { SqliteFhirStore } from "../../src/services/fhir-store.js";
import type { DicomDataset } from "../../src/models/study.js";
import type { StowResult } from "../../src/services/orthanc-client.js";

const STUDY_UID = "1.2.840.113619.2.55.3.604688119.969.1268071029.320";

function makeDicomBytes(): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(256));
  bytes[128] = 0x44;
  bytes[129] = 0x49;
  bytes[130] = 0x43;
  bytes[131] = 0x4d;
  return bytes;
}

const STOW_OK: StowResult = {
  raw: {},
  retrieveUrl: `http://orthanc/studies/${STUDY_UID}`,
  studyInstanceUid: STUDY_UID,
  failedSopCount: 0,
  referencedSopCount: 1,
};

const METADATA_INSTANCE: DicomDataset = {
  "0020000D": { vr: "UI", Value: [STUDY_UID] },
  "00100010": { vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] },
  "00100020": { vr: "LO", Value: ["PAT-001"] },
  "00100040": { vr: "CS", Value: ["F"] },
  "00080020": { vr: "DA", Value: ["20240315"] },
  "00080060": { vr: "CS", Value: ["CT"] },
  "0020000E": { vr: "UI", Value: ["1.2.840.113619.2.55.3.604688119.969.1268071029.321"] },
  "00200011": { vr: "IS", Value: ["1"] },
  "00080018": { vr: "UI", Value: ["1.2.840.113619.2.55.3.604688119.969.1268071029.322"] },
};

describe("POST /api/upload — FHIR auto-sync branch", () => {
  it("syncs the uploaded study into the provided FHIR store after a successful STOW", async () => {
    const getStudyMetadata = vi.fn().mockResolvedValue([METADATA_INSTANCE]);
    const store = new SqliteFhirStore({ path: ":memory:" });
    const app = buildUploadRouter({
      orthanc: {
        storeInstances: vi.fn().mockResolvedValue(STOW_OK),
        getStudyMetadata,
      },
      store,
    });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm"));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(201);
    expect(getStudyMetadata).toHaveBeenCalledWith(STUDY_UID);
    expect(store.counts()).toEqual({ patients: 1, imagingStudies: 1 });
    store.close();
  });

  it("still returns 201 when FHIR sync fails (DICOM wins — Silver is best-effort)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = new SqliteFhirStore({ path: ":memory:" });
    const app = buildUploadRouter({
      orthanc: {
        storeInstances: vi.fn().mockResolvedValue(STOW_OK),
        getStudyMetadata: vi.fn().mockRejectedValue(new Error("upstream exploded")),
      },
      store,
    });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm"));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(201);
    expect(store.counts()).toEqual({ patients: 0, imagingStudies: 0 });
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
    store.close();
  });

  it("does NOT run FHIR sync when the STOW response has no parseable studyInstanceUid (negative space)", async () => {
    const getStudyMetadata = vi.fn();
    const store = new SqliteFhirStore({ path: ":memory:" });
    const app = buildUploadRouter({
      orthanc: {
        storeInstances: vi.fn().mockResolvedValue({ ...STOW_OK, studyInstanceUid: null }),
        getStudyMetadata,
      },
      store,
    });

    const form = new FormData();
    form.append("file", new File([makeDicomBytes()], "ct.dcm"));
    const res = await app.request("/", { method: "POST", body: form });

    expect(res.status).toBe(201);
    expect(getStudyMetadata).not.toHaveBeenCalled();
    expect(store.counts()).toEqual({ patients: 0, imagingStudies: 0 });
    store.close();
  });
});
