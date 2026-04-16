/**
 * Minimal parser for `multipart/related` responses — just enough to extract
 * the first (and in the DICOMweb RetrieveInstance case, only) binary part.
 *
 * We deliberately don't pull in a multipart library: the DICOMweb part shape
 * is fixed (one `application/dicom` entry per instance retrieve) and a robust
 * parser would be wasted surface area.
 */

const CRLF_CRLF = new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]);

export class MultipartParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultipartParseError";
  }
}

export function extractFirstPart(body: Uint8Array, contentType: string): Uint8Array {
  const boundary = readBoundary(contentType);
  const boundaryBytes = new TextEncoder().encode(`--${boundary}`);

  const firstBoundary = indexOf(body, boundaryBytes, 0);
  if (firstBoundary < 0) throw new MultipartParseError("opening boundary not found");

  const headerStart = firstBoundary + boundaryBytes.length;
  const bodyStart = indexOf(body, CRLF_CRLF, headerStart);
  if (bodyStart < 0) throw new MultipartParseError("header terminator not found");
  const partStart = bodyStart + CRLF_CRLF.length;

  const closingBoundary = indexOf(body, boundaryBytes, partStart);
  if (closingBoundary < 0) throw new MultipartParseError("closing boundary not found");
  // The part body ends 2 bytes before the closing boundary (the CRLF that precedes `--<boundary>`).
  const partEnd = closingBoundary - 2;
  if (partEnd <= partStart) throw new MultipartParseError("empty part");

  return body.slice(partStart, partEnd);
}

function readBoundary(contentType: string): string {
  const match = contentType.match(/boundary="?([^";\s]+)"?/i);
  if (match === null || match[1] === undefined) {
    throw new MultipartParseError(`boundary parameter missing from Content-Type: ${contentType}`);
  }
  return match[1];
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
