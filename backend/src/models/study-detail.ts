import { DicomTag } from "./dicom-tags.js";
import { readInteger, readPersonName, readString } from "./dicom-accessors.js";
import { type DicomDataset, DicomMappingError } from "./study.js";



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

export function mapMetadataToStudyDetail(
  studyInstanceUid: string,
  metadata: ReadonlyArray<DicomDataset>,
): StudyDetail {
  if (studyInstanceUid.trim() === "") {
    throw new DicomMappingError("studyInstanceUid must be non-empty");
  }

  const seriesByUid = new Map<string, MutableSeries>();
  let patientName: string | null = null;
  let patientId: string | null = null;
  let patientSex: string | null = null;
  let studyDate: string | null = null;
  let studyDescription: string | null = null;

  for (const dataset of metadata) {
    const seriesUid = readString(dataset, DicomTag.SeriesInstanceUID);
    const sopInstanceUid = readString(dataset, DicomTag.SOPInstanceUID);
    if (seriesUid === null || sopInstanceUid === null) continue;

    patientName ??= readPersonName(dataset, DicomTag.PatientName);
    patientId ??= readString(dataset, DicomTag.PatientID);
    patientSex ??= readString(dataset, DicomTag.PatientSex);
    studyDate ??= readString(dataset, DicomTag.StudyDate);
    studyDescription ??= readString(dataset, DicomTag.StudyDescription);

    let bucket = seriesByUid.get(seriesUid);
    if (bucket === undefined) {
      bucket = {
        seriesInstanceUid: seriesUid,
        seriesNumber: readInteger(dataset, DicomTag.SeriesNumber),
        seriesDescription: readString(dataset, DicomTag.SeriesDescription),
        modality: readString(dataset, DicomTag.Modality),
        manufacturer: readString(dataset, DicomTag.Manufacturer),
        instances: [],
      };
      seriesByUid.set(seriesUid, bucket);
    }

    bucket.instances.push({
      sopInstanceUid,
      sopClassUid: readString(dataset, DicomTag.SOPClassUID),
      instanceNumber: readInteger(dataset, DicomTag.InstanceNumber),
      rows: readInteger(dataset, DicomTag.Rows),
      columns: readInteger(dataset, DicomTag.Columns),
      bitsAllocated: readInteger(dataset, DicomTag.BitsAllocated),
    });
  }

  const series: Series[] = Array.from(seriesByUid.values())
    .map((s) => ({ ...s, instances: [...s.instances].sort(byInstanceNumber) }))
    .sort(bySeriesNumber);

  return {
    studyInstanceUid,
    patientName,
    patientId,
    patientSex,
    studyDate,
    studyDescription,
    series,
  };
}

interface MutableSeries {
  seriesInstanceUid: string;
  seriesNumber: number | null;
  seriesDescription: string | null;
  modality: string | null;
  manufacturer: string | null;
  instances: Instance[];
}

function bySeriesNumber(a: Series, b: Series): number {
  return (a.seriesNumber ?? Number.MAX_SAFE_INTEGER) - (b.seriesNumber ?? Number.MAX_SAFE_INTEGER);
}

function byInstanceNumber(a: Instance, b: Instance): number {
  return (a.instanceNumber ?? Number.MAX_SAFE_INTEGER) - (b.instanceNumber ?? Number.MAX_SAFE_INTEGER);
}
