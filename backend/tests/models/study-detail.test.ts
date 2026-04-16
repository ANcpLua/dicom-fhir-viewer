import { describe, expect, it } from "vitest";
import { mapMetadataToStudyDetail } from "../../src/models/study-detail.js";
import { DicomMappingError, type DicomDataset } from "../../src/models/study.js";

const STUDY_UID = "1.2.840.113619.2.55.3.320";
const SERIES_A = "1.2.840.113619.2.55.3.320.1";
const SERIES_B = "1.2.840.113619.2.55.3.320.2";

function instance(overrides: Partial<Record<string, DicomDataset[string]>>): DicomDataset {
  return {
    "00080016": { vr: "UI", Value: ["1.2.840.10008.5.1.4.1.1.2"] },
    "00080018": { vr: "UI", Value: ["1.2.3"] },
    "00080060": { vr: "CS", Value: ["CT"] },
    "00100010": { vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] },
    "00100020": { vr: "LO", Value: ["PAT-001"] },
    "0020000D": { vr: "UI", Value: [STUDY_UID] },
    "0020000E": { vr: "UI", Value: [SERIES_A] },
    "00200011": { vr: "IS", Value: ["1"] },
    "00200013": { vr: "IS", Value: ["1"] },
    "00280010": { vr: "US", Value: [512] },
    "00280011": { vr: "US", Value: [512] },
    "00280100": { vr: "US", Value: [16] },
    ...overrides,
  };
}

describe("mapMetadataToStudyDetail", () => {
  it("groups instances by SeriesInstanceUID and extracts patient/study fields from the first dataset", () => {
    const metadata: DicomDataset[] = [
      instance({ "00080018": { vr: "UI", Value: ["1.1"] } }),
      instance({ "00080018": { vr: "UI", Value: ["1.2"] }, "00200013": { vr: "IS", Value: ["2"] } }),
      instance({
        "00080018": { vr: "UI", Value: ["2.1"] },
        "0020000E": { vr: "UI", Value: [SERIES_B] },
        "00200011": { vr: "IS", Value: ["2"] },
        "00200013": { vr: "IS", Value: ["1"] },
        "0008103E": { vr: "LO", Value: ["T2 AX"] },
      }),
    ];

    const detail = mapMetadataToStudyDetail(STUDY_UID, metadata);

    expect(detail.studyInstanceUid).toBe(STUDY_UID);
    expect(detail.patientName).toBe("DOE^JANE");
    expect(detail.patientId).toBe("PAT-001");
    expect(detail.series).toHaveLength(2);
    const [first, second] = detail.series;
    expect(first?.seriesInstanceUid).toBe(SERIES_A);
    expect(first?.instances).toHaveLength(2);
    expect(first?.modality).toBe("CT");
    expect(second?.seriesInstanceUid).toBe(SERIES_B);
    expect(second?.seriesDescription).toBe("T2 AX");
  });

  it("sorts series by SeriesNumber and instances by InstanceNumber within each series", () => {
    const metadata: DicomDataset[] = [
      instance({
        "00080018": { vr: "UI", Value: ["b.2"] },
        "0020000E": { vr: "UI", Value: [SERIES_B] },
        "00200011": { vr: "IS", Value: ["3"] },
        "00200013": { vr: "IS", Value: ["2"] },
      }),
      instance({
        "00080018": { vr: "UI", Value: ["a.2"] },
        "00200011": { vr: "IS", Value: ["1"] },
        "00200013": { vr: "IS", Value: ["2"] },
      }),
      instance({
        "00080018": { vr: "UI", Value: ["b.1"] },
        "0020000E": { vr: "UI", Value: [SERIES_B] },
        "00200011": { vr: "IS", Value: ["3"] },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
      instance({
        "00080018": { vr: "UI", Value: ["a.1"] },
        "00200011": { vr: "IS", Value: ["1"] },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
    ];

    const detail = mapMetadataToStudyDetail(STUDY_UID, metadata);

    expect(detail.series.map((s) => s.seriesNumber)).toEqual([1, 3]);
    expect(detail.series[0]?.instances.map((i) => i.sopInstanceUid)).toEqual(["a.1", "a.2"]);
    expect(detail.series[1]?.instances.map((i) => i.sopInstanceUid)).toEqual(["b.1", "b.2"]);
  });

  it("returns an empty series list when no datasets carry a SeriesInstanceUID (negative space)", () => {
    const detail = mapMetadataToStudyDetail(STUDY_UID, [
      { "00080018": { vr: "UI", Value: ["1.2"] } },
    ]);
    expect(detail.series).toEqual([]);
    expect(detail.patientName).toBeNull();
  });

  it("throws DicomMappingError when studyInstanceUid is blank", () => {
    expect(() => mapMetadataToStudyDetail("   ", [])).toThrow(DicomMappingError);
  });

  it("sorts series with null SeriesNumber to the end via the MAX_SAFE_INTEGER fallback", () => {
    const metadata: DicomDataset[] = [
      instance({
        "00080018": { vr: "UI", Value: ["b.1"] },
        "0020000E": { vr: "UI", Value: [SERIES_B] },
        "00200011": { vr: "IS" }, // series without a number → sorted to the end
        "00200013": { vr: "IS", Value: ["1"] },
      }),
      instance({
        "00080018": { vr: "UI", Value: ["a.1"] },
        "00200011": { vr: "IS", Value: ["1"] },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
    ];

    const detail = mapMetadataToStudyDetail(STUDY_UID, metadata);

    expect(detail.series.map((s) => s.seriesInstanceUid)).toEqual([SERIES_A, SERIES_B]);
    expect(detail.series[1]?.seriesNumber).toBeNull();
  });

  it("sorts instances with null InstanceNumber to the end via the MAX_SAFE_INTEGER fallback", () => {
    const metadata: DicomDataset[] = [
      instance({
        "00080018": { vr: "UI", Value: ["null-inst"] },
        "00200013": { vr: "IS" }, // instance without a number → sorted to the end
      }),
      instance({
        "00080018": { vr: "UI", Value: ["first"] },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
    ];

    const detail = mapMetadataToStudyDetail(STUDY_UID, metadata);

    expect(detail.series[0]?.instances.map((i) => i.sopInstanceUid)).toEqual([
      "first",
      "null-inst",
    ]);
  });

  it("keeps a valid-SeriesNumber series before a null-SeriesNumber series when already in order (cmp(valid, null) direction)", () => {
    // Array order [valid, null] forces the sort comparator to be called as
    // bySeriesNumber(valid, null), hitting the RIGHT-hand `?? MAX_SAFE_INTEGER`
    // fallback (complements the left-hand fallback test above).
    const metadata: DicomDataset[] = [
      instance({
        "00080018": { vr: "UI", Value: ["a.1"] },
        "00200011": { vr: "IS", Value: ["1"] },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
      instance({
        "00080018": { vr: "UI", Value: ["b.1"] },
        "0020000E": { vr: "UI", Value: [SERIES_B] },
        "00200011": { vr: "IS" },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
    ];

    const detail = mapMetadataToStudyDetail(STUDY_UID, metadata);
    expect(detail.series.map((s) => s.seriesInstanceUid)).toEqual([SERIES_A, SERIES_B]);
  });

  it("keeps a valid-InstanceNumber before a null-InstanceNumber within a series when already in order (cmp(valid, null))", () => {
    const metadata: DicomDataset[] = [
      instance({
        "00080018": { vr: "UI", Value: ["a.1"] },
        "00200013": { vr: "IS", Value: ["1"] },
      }),
      instance({
        "00080018": { vr: "UI", Value: ["a.2"] },
        "00200013": { vr: "IS" },
      }),
    ];

    const detail = mapMetadataToStudyDetail(STUDY_UID, metadata);
    expect(detail.series[0]?.instances.map((i) => i.sopInstanceUid)).toEqual(["a.1", "a.2"]);
  });
});
