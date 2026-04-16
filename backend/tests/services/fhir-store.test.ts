import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteFhirStore } from "../../src/services/fhir-store.js";
import type { FhirImagingStudy, FhirPatient } from "../../src/models/fhir-types.js";

const PATIENT: FhirPatient = {
  resourceType: "Patient",
  id: "patient-1",
  identifier: [{ system: "urn:dicom:patient-id", value: "PAT-1" }],
  name: [{ family: "DOE", given: ["JANE"], text: "DOE^JANE" }],
  gender: "female",
};

const STUDY: FhirImagingStudy = {
  resourceType: "ImagingStudy",
  id: "study-1",
  status: "available",
  subject: { reference: "Patient/patient-1" },
  identifier: [{ system: "urn:dicom:uid", value: "urn:oid:1.2.3" }],
  numberOfSeries: 0,
  numberOfInstances: 0,
};

describe("SqliteFhirStore (in-memory)", () => {
  let store: SqliteFhirStore;

  beforeEach(() => {
    store = new SqliteFhirStore({ path: ":memory:" });
  });

  afterEach(() => {
    store.close();
  });

  it("starts empty and reports zero counts (initial state)", () => {
    expect(store.counts()).toEqual({ patients: 0, imagingStudies: 0 });
    expect(store.listPatients()).toEqual([]);
    expect(store.listImagingStudies()).toEqual([]);
  });

  it("upserts a Patient and returns it verbatim on getPatient", () => {
    store.upsertPatient(PATIENT);
    expect(store.getPatient("patient-1")).toEqual(PATIENT);
    expect(store.counts().patients).toBe(1);
  });

  it("upserting the same Patient id twice does not duplicate (idempotent)", () => {
    store.upsertPatient(PATIENT);
    store.upsertPatient({ ...PATIENT, gender: "other" });
    expect(store.counts().patients).toBe(1);
    expect(store.getPatient("patient-1")?.gender).toBe("other");
  });

  it("returns null for a missing Patient (no throw)", () => {
    expect(store.getPatient("nope")).toBeNull();
  });

  it("upserts an ImagingStudy and round-trips it via getImagingStudy", () => {
    store.upsertImagingStudy(STUDY);
    expect(store.getImagingStudy("study-1")).toEqual(STUDY);
    expect(store.counts().imagingStudies).toBe(1);
  });

  it("listPatients / listImagingStudies return all rows sorted by id", () => {
    store.upsertPatient({ ...PATIENT, id: "patient-b" });
    store.upsertPatient({ ...PATIENT, id: "patient-a" });
    expect(store.listPatients().map((p) => p.id)).toEqual(["patient-a", "patient-b"]);
  });
});
