import dicomParser, { type DataSet } from "dicom-parser";

/**
 * Decoded DICOM instance ready for canvas rendering.
 *
 * Supports only uncompressed Explicit/Implicit VR Little Endian grayscale,
 * which is all the public sample data uses. Compressed transfer
 * syntaxes (JPEG, JPEG 2000, RLE) would require codec wasm modules —
 * exactly what we avoid by skipping cornerstone's dicom-image-loader.
 */
export interface DecodedInstance {
  readonly rows: number;
  readonly columns: number;
  readonly bitsAllocated: number;
  readonly pixelRepresentation: 0 | 1;
  readonly invertForDisplay: boolean;
  readonly pixelData: Int16Array | Uint16Array | Uint8Array;
  readonly minPixelValue: number;
  readonly maxPixelValue: number;
  readonly windowCenter: number;
  readonly windowWidth: number;
  readonly rescaleIntercept: number;
  readonly rescaleSlope: number;
}

/**
 * Predictable domain refusals surfaced by the decoder. These are not bugs —
 * they are the enumerated ways a DICOM file can legitimately fail to decode
 * (malformed bytes, missing required tags, unsupported bit depth). Callers
 * must handle every variant; the type system forces the switch.
 */
export type DecodeError =
  | { readonly kind: "parse-failed"; readonly message: string }
  | { readonly kind: "missing-tag"; readonly tag: string }
  | { readonly kind: "missing-pixel-data" }
  | { readonly kind: "unsupported-bits-allocated"; readonly bits: number };

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DecodeError };

export function formatDecodeError(error: DecodeError): string {
  switch (error.kind) {
    case "parse-failed":
      return `Failed to parse DICOM: ${error.message}`;
    case "missing-tag":
      return `Required DICOM tag missing: ${error.tag}`;
    case "missing-pixel-data":
      return "PixelData (7FE0,0010) missing";
    case "unsupported-bits-allocated":
      return `Unsupported BitsAllocated: ${error.bits}`;
  }
}

export function decodeDicomInstance(bytes: Uint8Array): DecodeResult<DecodedInstance> {
  let dataSet: DataSet;
  try {
    dataSet = dicomParser.parseDicom(bytes);
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else {
      message = String(err);
    }
    return { ok: false, error: { kind: "parse-failed", message } };
  }

  const rows = dataSet.uint16("x00280010");
  if (rows === undefined) {
    return { ok: false, error: { kind: "missing-tag", tag: "Rows (0028,0010)" } };
  }
  const columns = dataSet.uint16("x00280011");
  if (columns === undefined) {
    return { ok: false, error: { kind: "missing-tag", tag: "Columns (0028,0011)" } };
  }
  const bitsAllocated = dataSet.uint16("x00280100");
  if (bitsAllocated === undefined) {
    return { ok: false, error: { kind: "missing-tag", tag: "BitsAllocated (0028,0100)" } };
  }

  const pixelRepresentation = (dataSet.uint16("x00280103") ?? 0) === 1 ? 1 : 0;
  const invertForDisplay = (dataSet.string("x00280004") ?? "MONOCHROME2").trim() === "MONOCHROME1";

  const pixelElement = dataSet.elements["x7fe00010"];
  if (pixelElement === undefined) return { ok: false, error: { kind: "missing-pixel-data" } };

  const pixelsResult = extractPixels(
    dataSet,
    pixelElement.dataOffset,
    pixelElement.length,
    bitsAllocated,
    pixelRepresentation,
  );
  if (!pixelsResult.ok) return pixelsResult;
  const pixelData = pixelsResult.value;

  const { min: minPixelValue, max: maxPixelValue } = minMax(pixelData);

  const storedCenter = parseDs(dataSet, "x00281050");
  const storedWidth = parseDs(dataSet, "x00281051");
  let windowWidth: number;
  if (storedWidth !== null && storedWidth > 0) {
    windowWidth = storedWidth;
  } else {
    windowWidth = Math.max(1, maxPixelValue - minPixelValue);
  }
  const windowCenter = storedCenter ?? minPixelValue + windowWidth / 2;

  return {
    ok: true,
    value: {
      rows,
      columns,
      bitsAllocated,
      pixelRepresentation,
      invertForDisplay,
      pixelData,
      minPixelValue,
      maxPixelValue,
      windowCenter,
      windowWidth,
      rescaleIntercept: parseDs(dataSet, "x00281052") ?? 0,
      rescaleSlope: parseDs(dataSet, "x00281053") ?? 1,
    },
  };
}

/**
 * Paint an instance into an `ImageData` buffer using the given window
 * center and width. MONOCHROME1 inverts the grayscale ramp so the display
 * matches MONOCHROME2 semantics.
 */
export function renderToImageData(
  instance: DecodedInstance,
  windowCenter: number,
  windowWidth: number,
): ImageData {
  const { rows, columns, pixelData, rescaleIntercept, rescaleSlope, invertForDisplay } = instance;
  const image = new ImageData(columns, rows);
  const out = image.data;
  const halfWidth = windowWidth / 2;
  const lower = windowCenter - halfWidth;
  const range = Math.max(1, windowWidth);

  for (const [i, stored] of pixelData.entries()) {
    const hu = stored * rescaleSlope + rescaleIntercept;
    const clipped = hu <= lower ? 0 : hu >= lower + range ? 255 : ((hu - lower) / range) * 255;
    const gray = invertForDisplay ? 255 - clipped : clipped;
    const offset = i * 4;
    out[offset] = gray;
    out[offset + 1] = gray;
    out[offset + 2] = gray;
    out[offset + 3] = 255;
  }
  return image;
}

/**
 * Extract the raw pixel buffer as a typed view into the DICOM byte array.
 * Exported for direct testing of the bit-depth switch — production code
 * reaches this via `decodeDicomInstance`, which propagates the Result.
 */
export function extractPixels(
  dataSet: Pick<DataSet, "byteArray">,
  byteOffset: number,
  byteLength: number,
  bitsAllocated: number,
  pixelRepresentation: 0 | 1,
): DecodeResult<Int16Array | Uint16Array | Uint8Array> {
  const buffer = dataSet.byteArray.buffer;
  const base = dataSet.byteArray.byteOffset + byteOffset;
  if (bitsAllocated === 16) {
    const count = byteLength / 2;
    const value =
      pixelRepresentation === 1
        ? new Int16Array(buffer, base, count)
        : new Uint16Array(buffer, base, count);
    return { ok: true, value };
  }
  if (bitsAllocated === 8) {
    return { ok: true, value: new Uint8Array(buffer, base, byteLength) };
  }
  return { ok: false, error: { kind: "unsupported-bits-allocated", bits: bitsAllocated } };
}

function minMax(pixels: Int16Array | Uint16Array | Uint8Array): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of pixels) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { min, max };
}

// DS (decimal string) tags may carry multiple backslash-separated values;
// the first is canonical for display.
function parseDs(dataSet: DataSet, tag: string): number | null {
  const raw = dataSet.string(tag);
  if (raw === undefined) return null;
  const backslash = raw.indexOf("\\");
  const firstPart = backslash === -1 ? raw : raw.slice(0, backslash);
  const trimmed = firstPart.trim();
  if (trimmed === "") return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
