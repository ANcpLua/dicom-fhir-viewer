export const DicomTag = {
  SOPClassUID: "00080016",
  SOPInstanceUID: "00080018",
  StudyDate: "00080020",
  AccessionNumber: "00080050",
  Modality: "00080060",
  Manufacturer: "00080070",
  StudyDescription: "00081030",
  SeriesDescription: "0008103E",
  FailedSOPSequence: "00081198",
  ReferencedSOPSequence: "00081199",
  PatientName: "00100010",
  PatientID: "00100020",
  PatientBirthDate: "00100030",
  PatientSex: "00100040",
  StudyInstanceUID: "0020000D",
  SeriesInstanceUID: "0020000E",
  StudyID: "00200010",
  SeriesNumber: "00200011",
  InstanceNumber: "00200013",
  NumberOfStudyRelatedSeries: "00201206",
  NumberOfStudyRelatedInstances: "00201208",
  Rows: "00280010",
  Columns: "00280011",
  BitsAllocated: "00280100",
} as const;

export type DicomTagKey = keyof typeof DicomTag;
export type DicomTagId = (typeof DicomTag)[DicomTagKey];
