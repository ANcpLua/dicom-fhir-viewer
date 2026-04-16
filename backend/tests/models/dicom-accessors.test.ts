import { describe, expect, it } from "vitest";
import {
  firstValue,
  readInteger,
  readPersonName,
  readString,
} from "../../src/models/dicom-accessors.js";
import type { DicomDataset } from "../../src/models/study.js";

const TAG = "00100010";

function dataset(attr: DicomDataset[string] | undefined): DicomDataset {
  return attr === undefined ? {} : { [TAG]: attr };
}

describe("firstValue", () => {
  it("returns undefined when the tag is absent", () => {
    expect(firstValue(dataset(undefined), TAG)).toBeUndefined();
  });

  it("returns undefined when Value array is empty or missing", () => {
    expect(firstValue(dataset({ vr: "PN", Value: [] }), TAG)).toBeUndefined();
    expect(firstValue(dataset({ vr: "PN" }), TAG)).toBeUndefined();
  });

  it("returns the first element when Value has entries", () => {
    expect(firstValue(dataset({ vr: "LO", Value: ["a", "b"] }), TAG)).toBe("a");
  });
});

describe("readString", () => {
  it("returns the trimmed string for string values", () => {
    expect(readString(dataset({ vr: "LO", Value: ["  hello  "] }), TAG)).toBe("hello");
  });

  it("returns null for empty-after-trim strings (negative space)", () => {
    expect(readString(dataset({ vr: "LO", Value: ["   "] }), TAG)).toBeNull();
  });

  it("returns null for missing tag, null value, or non-string types", () => {
    expect(readString(dataset(undefined), TAG)).toBeNull();
    expect(readString(dataset({ vr: "LO", Value: [null] }), TAG)).toBeNull();
    expect(readString(dataset({ vr: "IS", Value: [42] }), TAG)).toBeNull();
  });
});

describe("readInteger", () => {
  it("returns the numeric value for integer numbers", () => {
    expect(readInteger(dataset({ vr: "IS", Value: [42] }), TAG)).toBe(42);
  });

  it("returns null for non-integer numeric values", () => {
    expect(readInteger(dataset({ vr: "DS", Value: [3.14] }), TAG)).toBeNull();
  });

  it("parses numeric strings as base-10 integers", () => {
    expect(readInteger(dataset({ vr: "IS", Value: ["7"] }), TAG)).toBe(7);
  });

  it("returns null when a string value is unparseable", () => {
    expect(readInteger(dataset({ vr: "IS", Value: ["not-a-number"] }), TAG)).toBeNull();
  });

  it("returns null when the value is an object (PersonName-shaped payload)", () => {
    // This is the explicit fallback at dicom-accessors.ts:27 — if a caller
    // points readInteger at a PN tag, it must not coerce the object shape.
    expect(
      readInteger(dataset({ vr: "PN", Value: [{ Alphabetic: "DOE^JANE" }] }), TAG),
    ).toBeNull();
  });

  it("returns null for missing tag or null value", () => {
    expect(readInteger(dataset(undefined), TAG)).toBeNull();
    expect(readInteger(dataset({ vr: "IS", Value: [null] }), TAG)).toBeNull();
  });
});

describe("readPersonName", () => {
  it("returns the trimmed string when value is a plain string", () => {
    expect(readPersonName(dataset({ vr: "PN", Value: ["  DOE^JANE  "] }), TAG)).toBe(
      "DOE^JANE",
    );
  });

  it("returns null when the string is empty after trim", () => {
    expect(readPersonName(dataset({ vr: "PN", Value: ["   "] }), TAG)).toBeNull();
  });

  it("prefers Alphabetic over Ideographic and Phonetic when all three are present", () => {
    expect(
      readPersonName(
        dataset({
          vr: "PN",
          Value: [{ Alphabetic: "ALPHA", Ideographic: "IDE", Phonetic: "PHO" }],
        }),
        TAG,
      ),
    ).toBe("ALPHA");
  });

  it("falls back to Ideographic when Alphabetic is missing", () => {
    expect(
      readPersonName(dataset({ vr: "PN", Value: [{ Ideographic: "IDE" }] }), TAG),
    ).toBe("IDE");
  });

  it("falls back to Phonetic when Alphabetic and Ideographic are blank", () => {
    expect(
      readPersonName(
        dataset({ vr: "PN", Value: [{ Alphabetic: "   ", Phonetic: "PHO" }] }),
        TAG,
      ),
    ).toBe("PHO");
  });

  it("returns null when all three PN subfields are missing or blank", () => {
    expect(readPersonName(dataset({ vr: "PN", Value: [{}] }), TAG)).toBeNull();
    expect(
      readPersonName(dataset({ vr: "PN", Value: [{ Alphabetic: "   " }] }), TAG),
    ).toBeNull();
  });

  it("returns null for missing tag, null, or non-string / non-object values", () => {
    expect(readPersonName(dataset(undefined), TAG)).toBeNull();
    expect(readPersonName(dataset({ vr: "PN", Value: [null] }), TAG)).toBeNull();
    expect(readPersonName(dataset({ vr: "PN", Value: [42] }), TAG)).toBeNull();
  });
});
