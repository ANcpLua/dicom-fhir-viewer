import { describe, expect, it } from "vitest";
import { extractFirstPart, MultipartParseError } from "../../src/services/multipart-related.js";

const BOUNDARY = "DicomBoundary1234";
const CONTENT_TYPE = `multipart/related; type="application/dicom"; boundary=${BOUNDARY}`;

function makePart(payload: string, boundary = BOUNDARY): Uint8Array {
  const header = `--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;
  const enc = new TextEncoder();
  const headerBytes = enc.encode(header);
  const payloadBytes = enc.encode(payload);
  const footerBytes = enc.encode(footer);
  const total = new Uint8Array(headerBytes.length + payloadBytes.length + footerBytes.length);
  total.set(headerBytes, 0);
  total.set(payloadBytes, headerBytes.length);
  total.set(footerBytes, headerBytes.length + payloadBytes.length);
  return total;
}

describe("extractFirstPart", () => {
  it("returns the first part payload verbatim", () => {
    const part = extractFirstPart(makePart("DICM\x00\x01\x02"), CONTENT_TYPE);
    expect(new TextDecoder().decode(part)).toBe("DICM\x00\x01\x02");
  });

  it("accepts a quoted boundary parameter", () => {
    const quoted = `multipart/related; boundary="${BOUNDARY}"; type="application/dicom"`;
    const part = extractFirstPart(makePart("BODY"), quoted);
    expect(new TextDecoder().decode(part)).toBe("BODY");
  });

  it("throws MultipartParseError when the Content-Type has no boundary parameter", () => {
    expect(() => extractFirstPart(makePart("x"), "multipart/related")).toThrow(MultipartParseError);
  });

  it("throws MultipartParseError when the opening boundary is missing from the body", () => {
    const body = new TextEncoder().encode("no boundary anywhere");
    expect(() => extractFirstPart(body, CONTENT_TYPE)).toThrow(/opening boundary not found/);
  });

  it("throws MultipartParseError when the header terminator (CRLFCRLF) is missing", () => {
    const body = new TextEncoder().encode(`--${BOUNDARY}\r\nContent-Type: application/dicom\r\nDICM`);
    expect(() => extractFirstPart(body, CONTENT_TYPE)).toThrow(/header terminator not found/);
  });

  it("throws MultipartParseError when the closing boundary is missing", () => {
    const body = new TextEncoder().encode(
      `--${BOUNDARY}\r\nContent-Type: application/dicom\r\n\r\nDICMDATA`,
    );
    expect(() => extractFirstPart(body, CONTENT_TYPE)).toThrow(/closing boundary not found/);
  });

  it("throws MultipartParseError when the part body is empty", () => {
    const enc = new TextEncoder();
    const body = enc.encode(
      `--${BOUNDARY}\r\nContent-Type: application/dicom\r\n\r\n\r\n--${BOUNDARY}--\r\n`,
    );
    expect(() => extractFirstPart(body, CONTENT_TYPE)).toThrow(/empty part/);
  });
});
