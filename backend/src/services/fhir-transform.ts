import type { StudyDetail } from "../models/study-detail.js";
import type {
  FhirEndpoint,
  FhirGender,
  FhirHumanName,
  FhirImagingStudy,
  FhirImagingStudyInstance,
  FhirImagingStudySeries,
  FhirPatient,
} from "../models/fhir-types.js";

export const ENDPOINT_ID = "orthanc-dicomweb";
export const DICOM_SOP_CLASS_SYSTEM = "urn:ietf:rfc:3986";
export const DICOM_MODALITY_SYSTEM = "http://dicom.nema.org/resources/ontology/DCM";
export const DICOM_UID_SYSTEM = "urn:dicom:uid";
export const PATIENT_IDENTIFIER_SYSTEM = "urn:dicom:patient-id";

export function patientIdFor(detail: Pick<StudyDetail, "patientId" | "studyInstanceUid">): string {
  const raw = detail.patientId?.trim();
  if (raw !== undefined && raw !== "") {
    return `patient-${slugify(raw)}`;
  }
  return `patient-${slugify(detail.studyInstanceUid)}`;
}

export function studyIdFor(detail: Pick<StudyDetail, "studyInstanceUid">): string {
  return `study-${slugify(detail.studyInstanceUid)}`;
}

export function transformToFhirPatient(detail: StudyDetail): FhirPatient {
  const id = patientIdFor(detail);
  const base = { resourceType: "Patient", id } as const;

  const identifier = detail.patientId
    ? ([{ system: PATIENT_IDENTIFIER_SYSTEM, value: detail.patientId }] as const)
    : null;
  const name = detail.patientName ? parseHumanName(detail.patientName) : null;
  const gender = mapGender(detail.patientSex);

  return {
    ...base,
    ...(identifier ? { identifier } : {}),
    ...(name ? { name: [name] } : {}),
    ...(gender ? { gender } : {}),
  };
}

export function transformToFhirImagingStudy(detail: StudyDetail): FhirImagingStudy {
  const id = studyIdFor(detail);
  const patientRef = `Patient/${patientIdFor(detail)}`;
  const numberOfInstances = detail.series.reduce((sum, s) => sum + s.instances.length, 0);

  const series: FhirImagingStudySeries[] = detail.series.map((s) => {
    const modalityCode = s.modality ?? "OT";
    const base = {
      uid: s.seriesInstanceUid,
      modality: { system: DICOM_MODALITY_SYSTEM, code: modalityCode },
      numberOfInstances: s.instances.length,
    } as const;
    return {
      ...base,
      ...(s.seriesNumber !== null ? { number: s.seriesNumber } : {}),
      ...(s.seriesDescription !== null ? { description: s.seriesDescription } : {}),
      ...(s.instances.length > 0 ? { instance: s.instances.map(toFhirInstance) } : {}),
    };
  });

  const base = {
    resourceType: "ImagingStudy",
    id,
    status: "available",
    subject: { reference: patientRef },
    identifier: [{ system: DICOM_UID_SYSTEM, value: `urn:oid:${detail.studyInstanceUid}` }],
    numberOfSeries: detail.series.length,
    numberOfInstances,
    endpoint: [{ reference: `Endpoint/${ENDPOINT_ID}` }],
  } as const;

  return {
    ...base,
    ...(detail.studyDate !== null ? { started: formatStudyStarted(detail.studyDate) } : {}),
    ...(detail.studyDescription !== null ? { description: detail.studyDescription } : {}),
    ...(series.length > 0 ? { series } : {}),
  };
}

export function buildEndpoint(address: string): FhirEndpoint {
  return {
    resourceType: "Endpoint",
    id: ENDPOINT_ID,
    status: "active",
    connectionType: {
      system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
      code: "dicom-wado-rs",
    },
    payloadType: [{ text: "DICOM WADO-RS / QIDO-RS / STOW-RS" }],
    address,
  };
}

function toFhirInstance(instance: StudyDetail["series"][number]["instances"][number]): FhirImagingStudyInstance {
  const base = { uid: instance.sopInstanceUid } as const;
  return {
    ...base,
    ...(instance.instanceNumber !== null ? { number: instance.instanceNumber } : {}),
    ...(instance.sopClassUid !== null
      ? {
          sopClass: {
            system: DICOM_SOP_CLASS_SYSTEM,
            code: `urn:oid:${instance.sopClassUid}`,
          },
        }
      : {}),
  };
}

function parseHumanName(raw: string): FhirHumanName {
  const parts = raw.split("^");
  const family = parts[0]?.trim();
  const given = parts
    .slice(1)
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
  const name: FhirHumanName = { text: raw };
  return {
    ...name,
    ...(family && family !== "" ? { family } : {}),
    ...(given.length > 0 ? { given } : {}),
  };
}

function mapGender(raw: string | null): FhirGender | null {
  if (raw === null) return null;
  const normalized = raw.trim().toUpperCase();
  if (normalized === "M") return "male";
  if (normalized === "F") return "female";
  if (normalized === "O") return "other";
  return "unknown";
}

function formatStudyStarted(dicomDate: string): string {
  if (/^\d{8}$/.test(dicomDate)) {
    return `${dicomDate.slice(0, 4)}-${dicomDate.slice(4, 6)}-${dicomDate.slice(6, 8)}`;
  }
  return dicomDate;
}

function slugify(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9.-]/g, "-");
}
