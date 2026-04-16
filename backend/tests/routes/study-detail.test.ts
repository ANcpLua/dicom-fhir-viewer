import { describe, expect, it, vi } from "vitest";
import { buildStudyDetailRouter } from "../../src/routes/study-detail.js";
import { OrthancDicomWebError } from "../../src/services/orthanc-client.js";
import type { DicomDataset } from "../../src/models/study.js";

const STUDY_UID = "1.2.840.113619.2.55.3.320";

const SAMPLE_METADATA: DicomDataset[] = [
  {
    "00080018": { vr: "UI", Value: ["1.1"] },
    "00080060": { vr: "CS", Value: ["CT"] },
    "00100010": { vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] },
    "0020000D": { vr: "UI", Value: [STUDY_UID] },
    "0020000E": { vr: "UI", Value: ["1.2.840.113619.2.55.3.320.1"] },
    "00200011": { vr: "IS", Value: ["1"] },
    "00200013": { vr: "IS", Value: ["1"] },
  },
];

describe("GET /api/studies/:studyUid", () => {
  it("returns the mapped StudyDetail with series tree", async () => {
    const orthanc = {
      getStudyMetadata: vi.fn().mockResolvedValue(SAMPLE_METADATA),
    };
    const app = buildStudyDetailRouter({ orthanc });

    const res = await app.request(`/${STUDY_UID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { studyInstanceUid: string; series: { modality: string }[] };
    expect(body.studyInstanceUid).toBe(STUDY_UID);
    expect(body.series).toHaveLength(1);
    expect(body.series[0]?.modality).toBe("CT");
    expect(orthanc.getStudyMetadata).toHaveBeenCalledWith(STUDY_UID);
  });

  it("returns 404 when Orthanc reports an unknown study", async () => {
    const app = buildStudyDetailRouter({
      orthanc: {
        getStudyMetadata: async () => {
          throw new OrthancDicomWebError(404, "WADO-RS getStudyMetadata", "not found");
        },
      },
    });

    const res = await app.request(`/${STUDY_UID}`);
    expect(res.status).toBe(404);
  });

  it("returns 502 on Orthanc 5xx failure", async () => {
    const app = buildStudyDetailRouter({
      orthanc: {
        getStudyMetadata: async () => {
          throw new OrthancDicomWebError(503, "WADO-RS getStudyMetadata", "down");
        },
      },
    });

    const res = await app.request(`/${STUDY_UID}`);
    expect(res.status).toBe(502);
  });
});
