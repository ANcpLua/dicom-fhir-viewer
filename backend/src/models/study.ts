import { DicomTag } from "./dicom-tags.js";
import { readInteger, readPersonName, readString } from "./dicom-accessors.js";

export interface DicomAttribute {
  readonly vr: string;
  readonly Value?: ReadonlyArray<unknown>;
  readonly BulkDataURI?: string;
  readonly InlineBinary?: string;
}

export type DicomDataset = Readonly<Record<string, DicomAttribute>>;

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

export class DicomMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DicomMappingError";
  }
}

export function mapDicomDatasetToStudy(dataset: DicomDataset): Study {
  const studyInstanceUid = readString(dataset, DicomTag.StudyInstanceUID);
  if (studyInstanceUid === null) {
    throw new DicomMappingError(`Missing required tag StudyInstanceUID (${DicomTag.StudyInstanceUID})`);
  }
  return {
    studyInstanceUid,
    patientName: readPersonName(dataset, DicomTag.PatientName),
    patientId: readString(dataset, DicomTag.PatientID),
    patientBirthDate: readString(dataset, DicomTag.PatientBirthDate),
    patientSex: readString(dataset, DicomTag.PatientSex),
    studyDate: readString(dataset, DicomTag.StudyDate),
    studyDescription: readString(dataset, DicomTag.StudyDescription),
    accessionNumber: readString(dataset, DicomTag.AccessionNumber),
    numberOfSeries: readInteger(dataset, DicomTag.NumberOfStudyRelatedSeries),
    numberOfInstances: readInteger(dataset, DicomTag.NumberOfStudyRelatedInstances),
  };
}

