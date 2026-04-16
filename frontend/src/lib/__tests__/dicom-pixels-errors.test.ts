// Pathological DataSet branches in decodeDicomInstance. The happy-path suite
// uses the real CT_small.dcm; these branches only fire when dicom-parser
// returns a dataset missing required tags. Mocking the external parser is
// cheaper (and more mutation-resistant) than hand-crafting malformed DICOM.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeDicomInstance, type DecodeError } from "../dicom-pixels.js";

interface FakeElement {
  readonly dataOffset: number;
  readonly length: number;
}

interface FakeDataSet {
  readonly byteArray: Uint8Array;
  readonly elements: Record<string, FakeElement | undefined>;
  uint16(tag: string): number | undefined;
  string(tag: string): string | undefined;
}

const parseDicomMock = vi.fn<(bytes: Uint8Array) => FakeDataSet>();

vi.mock("dicom-parser", () => ({
  default: {
    parseDicom: (bytes: Uint8Array) => parseDicomMock(bytes),
  },
}));

type Overrides = {
  rows?: number | undefined;
  columns?: number | undefined;
  bitsAllocated?: number | undefined;
  pixelRepresentation?: number | undefined;
  photometricInterpretation?: string | undefined;
  windowCenter?: string | undefined;
  windowWidth?: string | undefined;
  pixelElement?: FakeElement | undefined;
  pixelBytes?: Uint8Array;
};

function makeDataSet(overrides: Overrides = {}): FakeDataSet {
  const pixelBytes = overrides.pixelBytes ?? new Uint8Array([10, 20, 30, 250]);
  const has = <K extends keyof Overrides>(key: K): boolean =>
    Object.prototype.hasOwnProperty.call(overrides, key);

  const uint16Tags: Record<string, number | undefined> = {
    x00280010: has("rows") ? overrides.rows : 2,
    x00280011: has("columns") ? overrides.columns : 2,
    x00280100: has("bitsAllocated") ? overrides.bitsAllocated : 8,
    x00280103: has("pixelRepresentation") ? overrides.pixelRepresentation : 0,
  };
  const stringTags: Record<string, string | undefined> = {
    x00280004: has("photometricInterpretation")
      ? overrides.photometricInterpretation
      : "MONOCHROME2",
    x00281050: overrides.windowCenter,
    x00281051: overrides.windowWidth,
  };

  return {
    byteArray: pixelBytes,
    elements: {
      x7fe00010: has("pixelElement")
        ? overrides.pixelElement
        : { dataOffset: 0, length: pixelBytes.length },
    },
    uint16: (tag) => uint16Tags[tag],
    string: (tag) => stringTags[tag],
  };
}

function decode(overrides: Overrides = {}): ReturnType<typeof decodeDicomInstance> {
  parseDicomMock.mockReturnValue(makeDataSet(overrides));
  return decodeDicomInstance(new Uint8Array(0));
}

function expectErr(
  result: ReturnType<typeof decodeDicomInstance>,
  expected: DecodeError,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error).toEqual(expected);
}

beforeEach(() => {
  parseDicomMock.mockReset();
});

describe("decodeDicomInstance — parse-failed branch discrimination", () => {
  it("formats an Error thrown by the parser via err.message (instanceof-Error branch)", () => {
    // Note: the real dicom-parser throws plain strings, not Error instances,
    // which is why the happy-path "bad bytes" test in dicom-pixels.test.ts
    // does NOT cover this branch. Force it explicitly via the mock.
    parseDicomMock.mockImplementation(() => {
      throw new Error("parser-error-boom");
    });
    const result = decodeDicomInstance(new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "parse-failed", message: "parser-error-boom" });
  });

  it("formats a non-Error thrown by the parser via String(err) (defensive else-arm)", () => {
    parseDicomMock.mockImplementation(() => {
      // dicom-parser in practice throws plain strings, not Error instances.
      // This mirrors that real behavior to exercise the defensive String(err) arm.
      throw "raw-string-boom";
    });
    const result = decodeDicomInstance(new Uint8Array(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: "parse-failed", message: "raw-string-boom" });
  });
});

describe("decodeDicomInstance — missing required tags (Result Err branches)", () => {
  it("returns Err missing-tag for Rows (0028,0010)", () => {
    expectErr(decode({ rows: undefined }), { kind: "missing-tag", tag: "Rows (0028,0010)" });
  });

  it("returns Err missing-tag for Columns (0028,0011)", () => {
    expectErr(decode({ columns: undefined }), {
      kind: "missing-tag",
      tag: "Columns (0028,0011)",
    });
  });

  it("returns Err missing-tag for BitsAllocated (0028,0100)", () => {
    expectErr(decode({ bitsAllocated: undefined }), {
      kind: "missing-tag",
      tag: "BitsAllocated (0028,0100)",
    });
  });

  it("returns Err missing-pixel-data when PixelData element is absent", () => {
    expectErr(decode({ pixelElement: undefined }), { kind: "missing-pixel-data" });
  });

  it("propagates Err unsupported-bits-allocated from extractPixels through decodeDicomInstance", () => {
    expectErr(decode({ bitsAllocated: 24 }), {
      kind: "unsupported-bits-allocated",
      bits: 24,
    });
  });
});

describe("decodeDicomInstance — optional tag fallbacks", () => {
  it("derives windowWidth from max-min when the DS tag is absent (semantic branch vs stored)", () => {
    // pixelBytes span 10..250 → fallback width = 240, center = 10 + 120 = 130
    const result = decode({ windowWidth: undefined, windowCenter: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.windowWidth).toBe(240);
    expect(result.value.windowCenter).toBe(130);
  });

  it("inverts display when PhotometricInterpretation is MONOCHROME1 (branch pair vs MONOCHROME2)", () => {
    const result = decode({ photometricInterpretation: "MONOCHROME1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.invertForDisplay).toBe(true);
  });

  it("defaults PhotometricInterpretation to MONOCHROME2 when the tag is absent (nullish fallback)", () => {
    const result = decode({ photometricInterpretation: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.invertForDisplay).toBe(false);
  });

  it("defaults PixelRepresentation to 0 (unsigned) when the tag is absent (nullish fallback)", () => {
    const result = decode({ pixelRepresentation: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pixelRepresentation).toBe(0);
  });

  it("derives windowWidth from max-min when storedWidth parses to 0 (non-positive branch, not null)", () => {
    // parseDs("0") → 0 → the `storedWidth > 0` check fails even though storedWidth !== null,
    // forcing the Math.max fallback at dicom-pixels.ts:105.
    const result = decode({ windowWidth: "0", windowCenter: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // pixelBytes [10,20,30,250] → min 10, max 250 → fallback width = 240
    expect(result.value.windowWidth).toBe(240);
  });

  it("derives windowWidth from max-min when storedWidth parses to a negative number", () => {
    const result = decode({ windowWidth: "-50", windowCenter: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.windowWidth).toBe(240);
  });

  it("parseDs: takes the first value from a backslash-separated DS tag", () => {
    const result = decode({ windowWidth: "1500\\800", windowCenter: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.windowWidth).toBe(1500);
  });

  it("parseDs: treats a whitespace-only DS tag as null (trimmed === '' branch → fallback)", () => {
    const result = decode({ windowWidth: "   ", windowCenter: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.windowWidth).toBe(240);
  });

  it("parseDs: treats a non-numeric DS tag as null (isFinite false branch → fallback)", () => {
    const result = decode({ windowWidth: "not-a-number", windowCenter: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.windowWidth).toBe(240);
  });
});
