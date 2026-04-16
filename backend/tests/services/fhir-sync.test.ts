import { describe, expect, it, vi } from "vitest";
import { syncAllStudies, syncStudy } from "../../src/services/fhir-sync.js";
import type { DicomDataset } from "../../src/models/study.js";

const STUDY_UID = "1.2.840.113619.2.55.3.320";
const METADATA: DicomDataset[] = [
  {
    "00080018": { vr: "UI", Value: ["1.1"] },
    "00080060": { vr: "CS", Value: ["CT"] },
    "00100010": { vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] },
    "00100020": { vr: "LO", Value: ["PAT-1"] },
    "0020000D": { vr: "UI", Value: [STUDY_UID] },
    "0020000E": { vr: "UI", Value: ["1.2.840.113619.2.55.3.320.1"] },
    "00200011": { vr: "IS", Value: ["1"] },
    "00200013": { vr: "IS", Value: ["1"] },
  },
];

function makeStore() {
  return {
    upsertPatient: vi.fn(),
    upsertImagingStudy: vi.fn(),
  };
}

describe("syncStudy", () => {
  it("fetches metadata, transforms, and upserts both Patient and ImagingStudy", async () => {
    const store = makeStore();
    const orthanc = { getStudyMetadata: vi.fn().mockResolvedValue(METADATA) };

    await syncStudy({ orthanc, store }, STUDY_UID);

    expect(orthanc.getStudyMetadata).toHaveBeenCalledWith(STUDY_UID);
    expect(store.upsertPatient).toHaveBeenCalledOnce();
    expect(store.upsertImagingStudy).toHaveBeenCalledOnce();
    expect(store.upsertPatient.mock.calls[0]?.[0]).toMatchObject({
      resourceType: "Patient",
      id: "patient-PAT-1",
    });
    expect(store.upsertImagingStudy.mock.calls[0]?.[0]).toMatchObject({
      resourceType: "ImagingStudy",
      subject: { reference: "Patient/patient-PAT-1" },
    });
  });
});

describe("syncAllStudies", () => {
  it("stringifies non-Error rejections (thrown string) into the errors list — String(err) fallback branch", async () => {
    const store = makeStore();
    const orthanc = {
      searchStudies: vi.fn().mockResolvedValue([
        { "0020000D": { vr: "UI", Value: [STUDY_UID] } },
      ]),
      getStudyMetadata: vi.fn().mockRejectedValue("raw string boom"),
    };

    const result = await syncAllStudies({ orthanc, store });

    expect(result.syncedStudies).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe("raw string boom");
    expect(result.errors[0]?.studyUid).toBe(STUDY_UID);
  });

  it("skips QIDO entries without a StudyInstanceUID and reports per-study errors", async () => {
    const store = makeStore();
    const orthanc = {
      searchStudies: vi.fn().mockResolvedValue([
        { "0020000D": { vr: "UI", Value: [STUDY_UID] } },
        { "0020000D": { vr: "UI", Value: ["bad"] } },
        {}, // no UID → skipped silently
      ]),
      getStudyMetadata: vi
        .fn()
        .mockResolvedValueOnce(METADATA)
        .mockRejectedValueOnce(new Error("upstream 500")),
    };

    const result = await syncAllStudies({ orthanc, store });

    expect(result.syncedStudies).toBe(1);
    expect(result.syncedPatients).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.studyUid).toBe("bad");
    expect(store.upsertPatient).toHaveBeenCalledOnce();
  });
});
