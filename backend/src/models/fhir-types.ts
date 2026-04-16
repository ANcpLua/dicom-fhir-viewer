export type FhirStatus = "available" | "entered-in-error" | "unknown";
export type FhirGender = "male" | "female" | "other" | "unknown";

export interface FhirCoding {
  readonly system: string;
  readonly code: string;
  readonly display?: string;
}

export interface FhirCodeableConcept {
  readonly coding?: ReadonlyArray<FhirCoding>;
  readonly text?: string;
}

export interface FhirIdentifier {
  readonly system: string;
  readonly value: string;
  readonly type?: FhirCodeableConcept;
}

export interface FhirReference {
  readonly reference: string;
  readonly display?: string;
}

export interface FhirHumanName {
  readonly use?: "usual" | "official" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
  readonly family?: string;
  readonly given?: ReadonlyArray<string>;
  readonly text?: string;
}

export interface FhirPatient {
  readonly resourceType: "Patient";
  readonly id: string;
  readonly identifier?: ReadonlyArray<FhirIdentifier>;
  readonly name?: ReadonlyArray<FhirHumanName>;
  readonly gender?: FhirGender;
  readonly birthDate?: string;
}

export interface FhirImagingStudyInstance {
  readonly uid: string;
  readonly number?: number;
  readonly sopClass?: FhirCoding;
}

export interface FhirImagingStudySeries {
  readonly uid: string;
  readonly number?: number;
  readonly modality: FhirCoding;
  readonly description?: string;
  readonly numberOfInstances: number;
  readonly instance?: ReadonlyArray<FhirImagingStudyInstance>;
}

export interface FhirImagingStudy {
  readonly resourceType: "ImagingStudy";
  readonly id: string;
  readonly status: FhirStatus;
  readonly subject: FhirReference;
  readonly identifier: ReadonlyArray<FhirIdentifier>;
  readonly started?: string;
  readonly description?: string;
  readonly numberOfSeries: number;
  readonly numberOfInstances: number;
  readonly series?: ReadonlyArray<FhirImagingStudySeries>;
  readonly endpoint?: ReadonlyArray<FhirReference>;
}

export interface FhirEndpointConnectionType {
  readonly system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type";
  readonly code: "dicom-wado-rs" | "dicom-qido-rs" | "dicom-stow-rs";
}

export interface FhirEndpoint {
  readonly resourceType: "Endpoint";
  readonly id: string;
  readonly status: "active" | "suspended" | "off";
  readonly connectionType: FhirEndpointConnectionType;
  readonly payloadType: ReadonlyArray<FhirCodeableConcept>;
  readonly address: string;
}
