export interface Study {
  readonly studyInstanceUid: string;
  readonly patientName: string | null;
  readonly patientId: string | null;
  readonly patientBirthDate: string | null;
  readonly patientSex: string | null;
  readonly studyDate: string | null;
  readonly studyDescription: string | null;
  readonly accessionNumber: string | null;
  readonly numberOfSeries: number | null;
  readonly numberOfInstances: number | null;
}

export interface StudiesListResponse {
  readonly studies: ReadonlyArray<Study>;
  readonly skipped: number;
}

export interface UploadResponse {
  readonly fileCount: number;
  readonly referencedSopCount: number;
  readonly failedSopCount: number;
  readonly retrieveUrl: string | null;
}

export interface Instance {
  readonly sopInstanceUid: string;
  readonly sopClassUid: string | null;
  readonly instanceNumber: number | null;
  readonly rows: number | null;
  readonly columns: number | null;
  readonly bitsAllocated: number | null;
}

export interface Series {
  readonly seriesInstanceUid: string;
  readonly seriesNumber: number | null;
  readonly seriesDescription: string | null;
  readonly modality: string | null;
  readonly manufacturer: string | null;
  readonly instances: ReadonlyArray<Instance>;
}

export interface StudyDetail {
  readonly studyInstanceUid: string;
  readonly patientName: string | null;
  readonly patientId: string | null;
  readonly patientSex: string | null;
  readonly studyDate: string | null;
  readonly studyDescription: string | null;
  readonly series: ReadonlyArray<Series>;
}

export interface StatsResponse {
  readonly totalPatients: number;
  readonly totalStudies: number;
  readonly totalInstances: number;
  readonly modalityDistribution: ReadonlyArray<{ readonly modality: string; readonly count: number }>;
  readonly studiesByDate: ReadonlyArray<{ readonly date: string; readonly count: number }>;
}

export interface FhirResource {
  readonly resourceType: string;
  readonly id: string;
}

export interface FhirBundleEntry<T extends FhirResource> {
  readonly resource: T;
}

export interface FhirBundle<T extends FhirResource> {
  readonly resourceType: "Bundle";
  readonly type: "searchset";
  readonly total: number;
  readonly entry: ReadonlyArray<FhirBundleEntry<T>>;
}

export interface FhirPatientSummary extends FhirResource {
  readonly resourceType: "Patient";
  readonly name?: ReadonlyArray<{ readonly text?: string; readonly family?: string }>;
  readonly gender?: string;
}

export interface FhirImagingStudySummary extends FhirResource {
  readonly resourceType: "ImagingStudy";
  readonly subject: { readonly reference: string };
  readonly started?: string;
  readonly description?: string;
  readonly numberOfSeries: number;
  readonly numberOfInstances: number;
}
