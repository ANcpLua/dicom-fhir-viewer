import type { DicomDataset } from "./study.js";

export function firstValue(dataset: DicomDataset, tag: string): unknown {
  const attr = dataset[tag];
  if (attr === undefined) return undefined;
  const values = attr.Value;
  if (values === undefined || values.length === 0) return undefined;
  return values[0];
}

export function readString(dataset: DicomDataset, tag: string): string | null {
  const value = firstValue(dataset, tag);
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function readInteger(dataset: DicomDataset, tag: string): number | null {
  const value = firstValue(dataset, tag);
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readPersonName(dataset: DicomDataset, tag: string): string | null {
  const value = firstValue(dataset, tag);
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "object") {
    const pn = value as { Alphabetic?: string; Ideographic?: string; Phonetic?: string };
    const alphabetic = pn.Alphabetic?.trim();
    if (alphabetic !== undefined && alphabetic !== "") return alphabetic;
    const ideographic = pn.Ideographic?.trim();
    if (ideographic !== undefined && ideographic !== "") return ideographic;
    const phonetic = pn.Phonetic?.trim();
    if (phonetic !== undefined && phonetic !== "") return phonetic;
  }
  return null;
}
