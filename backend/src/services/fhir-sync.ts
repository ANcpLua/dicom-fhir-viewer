import { readString } from "../models/dicom-accessors.js";
import { DicomTag } from "../models/dicom-tags.js";
import { mapMetadataToStudyDetail } from "../models/study-detail.js";
import type { OrthancClient } from "./orthanc-client.js";
import type { FhirStore } from "./fhir-store.js";
import { transformToFhirImagingStudy, transformToFhirPatient } from "./fhir-transform.js";

export interface FhirSyncResult {
  readonly syncedStudies: number;
  readonly syncedPatients: number;
  readonly errors: ReadonlyArray<{ readonly studyUid: string; readonly message: string }>;
}

export interface SyncOneDeps {
  readonly orthanc: Pick<OrthancClient, "getStudyMetadata">;
  readonly store: Pick<FhirStore, "upsertPatient" | "upsertImagingStudy">;
}

export interface SyncAllDeps extends SyncOneDeps {
  readonly orthanc: Pick<OrthancClient, "searchStudies" | "getStudyMetadata">;
}

export async function syncAllStudies(deps: SyncAllDeps): Promise<FhirSyncResult> {
  const studies = await deps.orthanc.searchStudies();
  const patientIdsSynced = new Set<string>();
  const errors: { studyUid: string; message: string }[] = [];
  let syncedStudies = 0;

  for (const dataset of studies) {
    const uid = readString(dataset, DicomTag.StudyInstanceUID);
    if (uid === null) continue;
    try {
      await syncStudyInternal(deps, uid, patientIdsSynced);
      syncedStudies += 1;
    } catch (error) {
      errors.push({ studyUid: uid, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { syncedStudies, syncedPatients: patientIdsSynced.size, errors };
}

export async function syncStudy(deps: SyncOneDeps, studyInstanceUid: string): Promise<void> {
  await syncStudyInternal(deps, studyInstanceUid, new Set<string>());
}

async function syncStudyInternal(
  deps: SyncOneDeps,
  studyInstanceUid: string,
  patientIdsSynced: Set<string>,
): Promise<void> {
  const metadata = await deps.orthanc.getStudyMetadata(studyInstanceUid);
  const detail = mapMetadataToStudyDetail(studyInstanceUid, metadata);
  const patient = transformToFhirPatient(detail);
  const imagingStudy = transformToFhirImagingStudy(detail);
  deps.store.upsertPatient(patient);
  patientIdsSynced.add(patient.id);
  deps.store.upsertImagingStudy(imagingStudy);
}

