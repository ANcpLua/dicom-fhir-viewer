const DICOM_DATE_PATTERN = /^\d{8}$/;

export function formatDicomDate(raw: string | null, fallback = "—"): string {
  if (raw === null) return fallback;
  if (DICOM_DATE_PATTERN.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}
