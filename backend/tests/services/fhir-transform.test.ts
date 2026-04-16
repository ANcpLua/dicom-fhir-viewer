import { describe, expect, it } from "vitest";
import {
  ENDPOINT_ID,
  buildEndpoint,
  patientIdFor,
  studyIdFor,
  transformToFhirImagingStudy,
  transformToFhirPatient,
} from "../../src/services/fhir-transform.js";
import type { StudyDetail } from "../../src/models/study-detail.js";

const DETAIL: StudyDetail = {
  studyInstanceUid: "1.2.840.113619.2.55.3.320",
  patientName: "DOE^JANE^MARIE",
  patientId: "PAT-001",
  patientSex: "F",
  studyDate: "20240315",
  studyDescription: "MR Brain without contrast",
  series: [
    {
      seriesInstanceUid: "1.2.840.113619.2.55.3.320.1",
      seriesNumber: 1,
      seriesDescription: "T1 SAG",
      modality: "MR",
      manufacturer: "SIEMENS",
      instances: [
        {
          sopInstanceUid: "1.2.840.113619.2.55.3.320.1.1",
          sopClassUid: "1.2.840.10008.5.1.4.1.1.4",
          instanceNumber: 1,
          rows: 256,
          columns: 256,
          bitsAllocated: 16,
        },
      ],
    },
  ],
};

describe("patientIdFor", () => {
  it("uses the DICOM PatientID when present and slugifies it", () => {
    expect(patientIdFor({ patientId: "PAT 001", studyInstanceUid: "1.2.3" })).toBe("patient-PAT-001");
  });
  it("falls back to the StudyInstanceUID when PatientID is null", () => {
    expect(patientIdFor({ patientId: null, studyInstanceUid: "1.2.3" })).toBe("patient-1.2.3");
  });
});

describe("transformToFhirPatient", () => {
  it("maps every DICOM patient field to FHIR R4 Patient", () => {
    const patient = transformToFhirPatient(DETAIL);
    expect(patient.resourceType).toBe("Patient");
    expect(patient.id).toBe("patient-PAT-001");
    expect(patient.identifier?.[0]).toEqual({
      system: "urn:dicom:patient-id",
      value: "PAT-001",
    });
    expect(patient.name?.[0]).toMatchObject({ family: "DOE", given: ["JANE", "MARIE"], text: "DOE^JANE^MARIE" });
    expect(patient.gender).toBe("female");
  });

  it("omits optional fields when their DICOM source is null (exactOptionalPropertyTypes)", () => {
    const patient = transformToFhirPatient({
      ...DETAIL,
      patientId: null,
      patientName: null,
      patientSex: null,
    });
    expect(patient).not.toHaveProperty("identifier");
    expect(patient).not.toHaveProperty("name");
    expect(patient).not.toHaveProperty("gender");
  });

  it("maps each DICOM gender code to the correct FHIR gender", () => {
    expect(transformToFhirPatient({ ...DETAIL, patientSex: "M" }).gender).toBe("male");
    expect(transformToFhirPatient({ ...DETAIL, patientSex: "F" }).gender).toBe("female");
    expect(transformToFhirPatient({ ...DETAIL, patientSex: "O" }).gender).toBe("other");
    expect(transformToFhirPatient({ ...DETAIL, patientSex: "Z" }).gender).toBe("unknown");
  });
});

describe("transformToFhirImagingStudy", () => {
  it("produces a conformant ImagingStudy with series/instance tree, Endpoint ref, and started date", () => {
    const study = transformToFhirImagingStudy(DETAIL);
    expect(study.resourceType).toBe("ImagingStudy");
    expect(study.id).toBe(studyIdFor(DETAIL));
    expect(study.status).toBe("available");
    expect(study.subject.reference).toBe(`Patient/${patientIdFor(DETAIL)}`);
    expect(study.identifier[0]).toEqual({
      system: "urn:dicom:uid",
      value: `urn:oid:${DETAIL.studyInstanceUid}`,
    });
    expect(study.started).toBe("2024-03-15");
    expect(study.description).toBe("MR Brain without contrast");
    expect(study.numberOfSeries).toBe(1);
    expect(study.numberOfInstances).toBe(1);
    expect(study.endpoint?.[0]?.reference).toBe(`Endpoint/${ENDPOINT_ID}`);
    const series = study.series?.[0];
    expect(series?.uid).toBe(DETAIL.series[0]!.seriesInstanceUid);
    expect(series?.modality).toEqual({
      system: "http://dicom.nema.org/resources/ontology/DCM",
      code: "MR",
    });
    expect(series?.instance?.[0]?.sopClass?.code).toBe("urn:oid:1.2.840.10008.5.1.4.1.1.4");
  });

  it("defaults series.modality to 'OT' when DICOM modality is null (FHIR R4 requires it)", () => {
    const study = transformToFhirImagingStudy({
      ...DETAIL,
      series: [{ ...DETAIL.series[0]!, modality: null }],
    });
    expect(study.series?.[0]?.modality.code).toBe("OT");
  });

  it("passes studyDate through unchanged when it is not 8-digit YYYYMMDD (formatStudyStarted fallback)", () => {
    const study = transformToFhirImagingStudy({ ...DETAIL, studyDate: "2024-03-15" });
    expect(study.started).toBe("2024-03-15");
  });

  it("omits the series.instance array when the series has zero instances (conditional spread)", () => {
    const study = transformToFhirImagingStudy({
      ...DETAIL,
      series: [{ ...DETAIL.series[0]!, instances: [] }],
    });
    expect(study.series?.[0]).not.toHaveProperty("instance");
    expect(study.series?.[0]?.numberOfInstances).toBe(0);
  });

  it("omits the top-level series array when the study has zero series (conditional spread)", () => {
    const study = transformToFhirImagingStudy({ ...DETAIL, series: [] });
    expect(study).not.toHaveProperty("series");
    expect(study.numberOfSeries).toBe(0);
    expect(study.numberOfInstances).toBe(0);
  });

  it("parseHumanName: omits family when the name starts with '^' and given is present", () => {
    const patient = transformToFhirPatient({ ...DETAIL, patientName: "^JANE^MARIE" });
    const name = patient.name?.[0];
    expect(name?.text).toBe("^JANE^MARIE");
    expect(name).not.toHaveProperty("family");
    expect(name?.given).toEqual(["JANE", "MARIE"]);
  });

  it("parseHumanName: omits given when the name ends with '^' and family is present", () => {
    const patient = transformToFhirPatient({ ...DETAIL, patientName: "DOE^" });
    const name = patient.name?.[0];
    expect(name?.text).toBe("DOE^");
    expect(name?.family).toBe("DOE");
    expect(name).not.toHaveProperty("given");
  });
});

describe("buildEndpoint", () => {
  it("emits a dicom-wado-rs Endpoint pointed at the configured address", () => {
    const endpoint = buildEndpoint("http://localhost:8042/dicom-web");
    expect(endpoint.resourceType).toBe("Endpoint");
    expect(endpoint.id).toBe(ENDPOINT_ID);
    expect(endpoint.status).toBe("active");
    expect(endpoint.connectionType.code).toBe("dicom-wado-rs");
    expect(endpoint.address).toBe("http://localhost:8042/dicom-web");
  });
});
