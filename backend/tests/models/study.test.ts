import { describe, expect, it } from "vitest";
import {
  DicomMappingError,
  type DicomDataset,
  mapDicomDatasetToStudy,
} from "../../src/models/study.js";

const MINIMAL_DATASET: DicomDataset = {
  "0020000D": { vr: "UI", Value: ["1.2.3.4.5"] },
};

const FULL_DATASET: DicomDataset = {
  "00080020": { vr: "DA", Value: ["20240315"] },
  "00080050": { vr: "SH", Value: ["ACC-001"] },
  "00081030": { vr: "LO", Value: ["MR Brain without contrast"] },
  "00100010": { vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] },
  "00100020": { vr: "LO", Value: ["PAT-001"] },
  "00100030": { vr: "DA", Value: ["19800101"] },
  "00100040": { vr: "CS", Value: ["F"] },
  "0020000D": { vr: "UI", Value: ["1.2.840.113619.2.55.3.604688119.969.1268071029.320"] },
  "00201206": { vr: "IS", Value: ["3"] },
  "00201208": { vr: "IS", Value: ["47"] },
};

describe("mapDicomDatasetToStudy", () => {
  it("maps a minimal dataset and returns nulls for every optional field", () => {
    const study = mapDicomDatasetToStudy(MINIMAL_DATASET);
    expect(study).toEqual({
      studyInstanceUid: "1.2.3.4.5",
      patientName: null,
      patientId: null,
      patientBirthDate: null,
      patientSex: null,
      studyDate: null,
      studyDescription: null,
      accessionNumber: null,
      numberOfSeries: null,
      numberOfInstances: null,
    });
  });

  it("maps a full dataset with every tag populated", () => {
    const study = mapDicomDatasetToStudy(FULL_DATASET);
    expect(study).toEqual({
      studyInstanceUid: "1.2.840.113619.2.55.3.604688119.969.1268071029.320",
      patientName: "DOE^JANE",
      patientId: "PAT-001",
      patientBirthDate: "19800101",
      patientSex: "F",
      studyDate: "20240315",
      studyDescription: "MR Brain without contrast",
      accessionNumber: "ACC-001",
      numberOfSeries: 3,
      numberOfInstances: 47,
    });
  });

  describe("StudyInstanceUID (required)", () => {
    it("throws DicomMappingError when the tag is absent", () => {
      expect(() => mapDicomDatasetToStudy({})).toThrow(DicomMappingError);
    });

    it("throws when the tag exists but has no Value array", () => {
      expect(() => mapDicomDatasetToStudy({ "0020000D": { vr: "UI" } })).toThrow(DicomMappingError);
    });

    it("throws when the Value array is empty", () => {
      expect(() => mapDicomDatasetToStudy({ "0020000D": { vr: "UI", Value: [] } })).toThrow(DicomMappingError);
    });

    it("throws when the Value is a whitespace-only string", () => {
      expect(() => mapDicomDatasetToStudy({ "0020000D": { vr: "UI", Value: ["   "] } })).toThrow(
        DicomMappingError,
      );
    });
  });

  describe("PatientName", () => {
    it("extracts the Alphabetic component from a PersonName object", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00100010": { vr: "PN", Value: [{ Alphabetic: "SMITH^JOHN" }] },
      });
      expect(study.patientName).toBe("SMITH^JOHN");
    });

    it("falls back to the Ideographic component when Alphabetic is missing", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00100010": { vr: "PN", Value: [{ Ideographic: "山田^太郎" }] },
      });
      expect(study.patientName).toBe("山田^太郎");
    });

    it("returns null when the PersonName object is empty", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00100010": { vr: "PN", Value: [{}] },
      });
      expect(study.patientName).toBeNull();
    });

    it("returns null when the Value array is empty", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00100010": { vr: "PN", Value: [] },
      });
      expect(study.patientName).toBeNull();
    });

    it("accepts a plain string (some servers use non-conformant shape)", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00100010": { vr: "PN", Value: ["DOE^JOHN"] },
      });
      expect(study.patientName).toBe("DOE^JOHN");
    });
  });

  describe("Integer-valued tags", () => {
    it("parses IS-encoded strings as integers", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00201206": { vr: "IS", Value: ["12"] },
        "00201208": { vr: "IS", Value: ["345"] },
      });
      expect(study.numberOfSeries).toBe(12);
      expect(study.numberOfInstances).toBe(345);
    });

    it("preserves a native integer Value", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00201206": { vr: "IS", Value: [7] },
      });
      expect(study.numberOfSeries).toBe(7);
    });

    it("returns null when the integer string is not parseable", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00201206": { vr: "IS", Value: ["not-a-number"] },
      });
      expect(study.numberOfSeries).toBeNull();
    });

    it("returns null when the numeric Value is not an integer", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00201206": { vr: "IS", Value: [3.14] },
      });
      expect(study.numberOfSeries).toBeNull();
    });
  });

  describe("Empty / missing semantics (negative space)", () => {
    it("does not crash when optional string tag has empty Value array", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00081030": { vr: "LO", Value: [] },
      });
      expect(study.studyDescription).toBeNull();
    });

    it("returns null (not empty string) when optional tag value is a blank string", () => {
      const study = mapDicomDatasetToStudy({
        ...MINIMAL_DATASET,
        "00080050": { vr: "SH", Value: [""] },
      });
      expect(study.accessionNumber).toBeNull();
    });
  });
});
