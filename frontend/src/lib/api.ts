import { getBackendUrl } from "./env.js";
import type {
  FhirBundle,
  FhirImagingStudySummary,
  FhirPatientSummary,
  FhirResource,
  StatsResponse,
  StudiesListResponse,
  StudyDetail,
  UploadResponse,
} from "./types.js";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly operation: string,
    public readonly responseBody: string,
  ) {
    super(`${operation}: HTTP ${status} — ${responseBody.slice(0, 200)}`);
    this.name = "ApiError";
  }
}

export function listStudies(signal?: AbortSignal): Promise<StudiesListResponse> {
  return getJson<StudiesListResponse>("/api/studies", signal);
}

export async function uploadDicom(files: ReadonlyArray<File>): Promise<UploadResponse> {
  if (files.length === 0) throw new TypeError("uploadDicom requires at least one file");
  const form = new FormData();
  for (const file of files) form.append("file", file);
  const res = await fetch(`${getBackendUrl()}/api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, "uploadDicom", await res.text());
  return (await res.json()) as UploadResponse;
}

export async function getStudyDetail(
  studyInstanceUid: string,
  signal?: AbortSignal,
): Promise<StudyDetail> {
  if (studyInstanceUid.trim() === "") throw new TypeError("studyInstanceUid must be non-empty");
  return getJson<StudyDetail>(
    `/api/studies/${encodeURIComponent(studyInstanceUid)}`,
    signal,
  );
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const init: RequestInit = signal ? { signal } : {};
  const res = await fetch(`${getBackendUrl()}${path}`, init);
  if (!res.ok) throw new ApiError(res.status, `GET ${path}`, await res.text());
  return (await res.json()) as T;
}

export function getStats(signal?: AbortSignal): Promise<StatsResponse> {
  return getJson<StatsResponse>("/api/stats", signal);
}

export function listFhirPatients(signal?: AbortSignal): Promise<FhirBundle<FhirPatientSummary>> {
  return getJson<FhirBundle<FhirPatientSummary>>("/api/fhir/Patient", signal);
}

export function listFhirImagingStudies(
  signal?: AbortSignal,
): Promise<FhirBundle<FhirImagingStudySummary>> {
  return getJson<FhirBundle<FhirImagingStudySummary>>("/api/fhir/ImagingStudy", signal);
}

export function getFhirResource<T extends FhirResource>(
  resourceType: "Patient" | "ImagingStudy",
  id: string,
  signal?: AbortSignal,
): Promise<T> {
  return getJson<T>(`/api/fhir/${resourceType}/${encodeURIComponent(id)}`, signal);
}

export async function triggerFhirSync(): Promise<{ syncedStudies: number; syncedPatients: number }> {
  const res = await fetch(`${getBackendUrl()}/api/fhir/sync`, { method: "POST" });
  if (!res.ok) throw new ApiError(res.status, "triggerFhirSync", await res.text());
  return (await res.json()) as { syncedStudies: number; syncedPatients: number };
}
