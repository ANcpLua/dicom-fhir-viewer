import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeDicomInstance,
  extractPixels,
  formatDecodeError,
  renderToImageData,
  type DecodedInstance,
} from "../dicom-pixels.js";

const CT_SMALL_PATH = resolve(import.meta.dirname, "../../../../sample-data/CT_small.dcm");

function loadSample(): Uint8Array {
  const buf = readFileSync(CT_SMALL_PATH);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function unwrapOk(bytes: Uint8Array): DecodedInstance {
  const result = decodeDicomInstance(bytes);
  if (!result.ok) throw new Error(`expected Ok, got ${result.error.kind}`);
  return result.value;
}

describe("decodeDicomInstance", () => {
  it("parses CT_small.dcm as 128x128 16-bit with populated pixel data and stored window", () => {
    const instance = unwrapOk(loadSample());

    expect(instance.rows).toBe(128);
    expect(instance.columns).toBe(128);
    expect(instance.bitsAllocated).toBe(16);
    // CT_small is stored with PixelRepresentation=1 (signed), so decoded as Int16.
    expect(instance.pixelData).toBeInstanceOf(Int16Array);
    expect(instance.pixelRepresentation).toBe(1);
    expect(instance.pixelData.length).toBe(128 * 128);
    expect(instance.invertForDisplay).toBe(false);
    // CT_small ships explicit WindowCenter/WindowWidth DS tags
    expect(instance.windowCenter).toBe(1159.5);
    expect(instance.windowWidth).toBe(2063);
  });

  it("records minPixelValue < maxPixelValue (non-blank image)", () => {
    const instance = unwrapOk(loadSample());
    expect(instance.maxPixelValue).toBeGreaterThan(instance.minPixelValue);
  });

  it("returns Err parse-failed on empty and non-DICOM bytes (negative space — no throw)", () => {
    for (const bytes of [new Uint8Array(0), new Uint8Array(256)]) {
      const result = decodeDicomInstance(bytes);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("parse-failed");
    }
  });
});

describe("renderToImageData", () => {
  it("produces a full RGBA buffer at the instance's dimensions", () => {
    const instance = unwrapOk(loadSample());
    const image = renderToImageData(instance, instance.windowCenter, instance.windowWidth);
    expect(image.width).toBe(128);
    expect(image.height).toBe(128);
    expect(image.data.length).toBe(128 * 128 * 4);
    // alpha channel must be fully opaque for every pixel
    for (let i = 3; i < image.data.length; i += 4) {
      expect(image.data[i]).toBe(255);
    }
  });

  it("clips pixels below / within / above the window (covers all three clipping arms)", () => {
    // Synthetic 1x3 instance with deliberately spaced pixel values so the
    // nested clipping ternary at dicom-pixels.ts:148 fires each outcome:
    // - pixel 0 (HU=0)   → below lower (50)       → clipped = 0
    // - pixel 1 (HU=100) → inside the window      → middle formula
    // - pixel 2 (HU=500) → above upper (150)      → clipped = 255
    const synthetic: DecodedInstance = {
      rows: 1,
      columns: 3,
      bitsAllocated: 16,
      pixelRepresentation: 0,
      invertForDisplay: false,
      pixelData: new Uint16Array([0, 100, 500]),
      minPixelValue: 0,
      maxPixelValue: 500,
      windowCenter: 100,
      windowWidth: 100,
      rescaleIntercept: 0,
      rescaleSlope: 1,
    };
    const image = renderToImageData(synthetic, synthetic.windowCenter, synthetic.windowWidth);

    // Channel R of each of the three pixels (stride 4 for RGBA)
    const r0 = image.data[0];
    const r1 = image.data[4];
    const r2 = image.data[8];

    expect(r0).toBe(0);
    expect(r2).toBe(255);
    // Middle pixel: clipped to the linear ramp between 0 and 255
    expect(r1).toBeGreaterThan(0);
    expect(r1).toBeLessThan(255);
  });

  it("inverts gray values when invertForDisplay is true (MONOCHROME1 branch of the gray ternary)", () => {
    const instance = unwrapOk(loadSample());
    const inverted: DecodedInstance = { ...instance, invertForDisplay: true };

    const normal = renderToImageData(instance, instance.windowCenter, instance.windowWidth);
    const flipped = renderToImageData(inverted, instance.windowCenter, instance.windowWidth);

    // Pick any pixel — normal and inverted channels at that position must sum to 255.
    const nR = normal.data[0] ?? 0;
    const fR = flipped.data[0] ?? 0;
    expect(nR + fR).toBe(255);
  });

  it("produces brighter output when the window narrows around the same center", () => {
    const instance = unwrapOk(loadSample());
    const centerX = Math.floor(instance.columns / 2);
    const centerY = Math.floor(instance.rows / 2);
    const middleIndex = (centerY * instance.columns + centerX) * 4;

    const wideWindow = renderToImageData(instance, instance.windowCenter, instance.windowWidth);
    const narrowWindow = renderToImageData(
      instance,
      instance.windowCenter,
      instance.windowWidth / 4,
    );

    const wideMid = wideWindow.data[middleIndex] ?? 0;
    const narrowMid = narrowWindow.data[middleIndex] ?? 0;
    // Narrowing the window around the same center stretches contrast:
    // a mid-tone pixel should either clip to 0/255 or change value.
    expect(narrowMid).not.toBe(wideMid);
  });
});

// Direct tests for the bit-depth switch. Exported so we don't need synthetic
// DICOM files for every branch — a narrow `Pick<DataSet, "byteArray">` stub
// is enough to exercise each path.
describe("extractPixels", () => {
  it("returns Ok Uint8Array for 8-bit allocation", () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    const result = extractPixels({ byteArray: bytes }, 0, 4, 8, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.value)).toEqual([10, 20, 30, 40]);
  });

  it("returns Ok Int16Array for 16-bit signed (preserves negative stored values)", () => {
    const buf = new ArrayBuffer(4);
    new Int16Array(buf).set([-1000, 1000]);
    const result = extractPixels({ byteArray: new Uint8Array(buf) }, 0, 4, 16, 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Int16Array);
    expect(Array.from(result.value)).toEqual([-1000, 1000]);
  });

  it("returns Ok Uint16Array for 16-bit unsigned (semantic branch pair with signed)", () => {
    const buf = new ArrayBuffer(4);
    new Uint16Array(buf).set([0, 65535]);
    const result = extractPixels({ byteArray: new Uint8Array(buf) }, 0, 4, 16, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Uint16Array);
    expect(Array.from(result.value)).toEqual([0, 65535]);
  });

  it("honours the dataSet byteOffset so slice aliases land on the correct bytes", () => {
    const host = new Uint8Array([0xff, 0xff, 10, 20, 30, 40]);
    const slice = new Uint8Array(host.buffer, 2, 4);
    const result = extractPixels({ byteArray: slice }, 0, 4, 8, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.value)).toEqual([10, 20, 30, 40]);
  });

  it("returns Err unsupported-bits-allocated for 12-bit (predictable domain refusal, not throw)", () => {
    const result = extractPixels({ byteArray: new Uint8Array(4) }, 0, 4, 12, 0);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "unsupported-bits-allocated", bits: 12 });
  });
});

describe("formatDecodeError", () => {
  it("formats every DecodeError variant with a distinct message", () => {
    expect(formatDecodeError({ kind: "parse-failed", message: "bad magic" })).toBe(
      "Failed to parse DICOM: bad magic",
    );
    expect(formatDecodeError({ kind: "missing-tag", tag: "Rows (0028,0010)" })).toBe(
      "Required DICOM tag missing: Rows (0028,0010)",
    );
    expect(formatDecodeError({ kind: "missing-pixel-data" })).toBe(
      "PixelData (7FE0,0010) missing",
    );
    expect(formatDecodeError({ kind: "unsupported-bits-allocated", bits: 12 })).toBe(
      "Unsupported BitsAllocated: 12",
    );
  });
});
