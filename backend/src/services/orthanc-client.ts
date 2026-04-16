import type { DicomDataset } from "../models/study.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OrthancClientOptions {
  readonly baseUrl: string;
  readonly dicomWebRoot: string;
  readonly fetch?: FetchLike;
}

export class OrthancDicomWebError extends Error {
  constructor(
    public readonly status: number,
    public readonly operation: string,
    public readonly responseBody: string,
  ) {
    super(`${operation} failed: HTTP ${status} — ${responseBody.slice(0, 200)}`);
    this.name = "OrthancDicomWebError";
  }
}

export interface StowResult {
  readonly raw: DicomDataset;
  readonly retrieveUrl: string | null;
  readonly studyInstanceUid: string | null;
  readonly failedSopCount: number;
  readonly referencedSopCount: number;
}

export class OrthancClient {
  readonly #rootUrl: string;
  readonly #origin: string;
  readonly #fetch: FetchLike;

  constructor(options: OrthancClientOptions) {
    const base = options.baseUrl.replace(/\/+$/, "");
    const root = options.dicomWebRoot.startsWith("/") ? options.dicomWebRoot : `/${options.dicomWebRoot}`;
    this.#rootUrl = `${base}${root.replace(/\/+$/, "")}`;
    this.#origin = new URL(base).origin;
    this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async searchStudies(): Promise<DicomDataset[]> {
    const res = await this.#fetch(`${this.#rootUrl}/studies`, {
      method: "GET",
      headers: { Accept: "application/dicom+json" },
    });
    if (res.status === 204) return [];
    if (!res.ok) throw new OrthancDicomWebError(res.status, "QIDO-RS searchStudies", await res.text());
    return (await res.json()) as DicomDataset[];
  }

  async getStudyMetadata(studyInstanceUid: string): Promise<DicomDataset[]> {
    if (studyInstanceUid.trim() === "") throw new TypeError("studyInstanceUid must be non-empty");
    const url = `${this.#rootUrl}/studies/${encodeURIComponent(studyInstanceUid)}/metadata`;
    const res = await this.#fetch(url, {
      method: "GET",
      headers: { Accept: "application/dicom+json" },
    });
    if (!res.ok) throw new OrthancDicomWebError(res.status, "WADO-RS getStudyMetadata", await res.text());
    return (await res.json()) as DicomDataset[];
  }

  async proxyDicomWebRaw(
    subpath: string,
    acceptHeader: string,
  ): Promise<{ readonly status: number; readonly contentType: string; readonly body: Uint8Array }> {
    const normalized = subpath.startsWith("/") ? subpath : `/${subpath}`;
    const res = await this.#fetch(`${this.#rootUrl}${normalized}`, {
      method: "GET",
      headers: { Accept: acceptHeader },
    });
    if (!res.ok) {
      throw new OrthancDicomWebError(res.status, `DICOMweb proxy ${normalized}`, await res.text());
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const body = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, contentType, body };
  }

  async storeInstances(instances: ReadonlyArray<Uint8Array>): Promise<StowResult> {
    if (instances.length === 0) throw new TypeError("storeInstances requires at least one instance");
    const { contentType, body } = buildMultipartRelated(instances);
    const res = await this.#fetch(`${this.#rootUrl}/studies`, {
      method: "POST",
      headers: { "Content-Type": contentType, Accept: "application/dicom+json" },
      body: body as unknown as NonNullable<RequestInit["body"]>,
    });
    if (!res.ok) throw new OrthancDicomWebError(res.status, "STOW-RS storeInstances", await res.text());
    const raw = (await res.json()) as DicomDataset;
    return summarizeStow(raw, this.#origin);
  }
}

export function buildMultipartRelated(parts: ReadonlyArray<Uint8Array>): {
  contentType: string;
  body: Uint8Array;
} {
  const boundary = `DicomBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const enc = new TextEncoder();
  const CRLF = "\r\n";
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    chunks.push(enc.encode(`--${boundary}${CRLF}Content-Type: application/dicom${CRLF}${CRLF}`));
    chunks.push(part);
    chunks.push(enc.encode(CRLF));
  }
  chunks.push(enc.encode(`--${boundary}--${CRLF}`));
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    body.set(c, offset);
    offset += c.byteLength;
  }
  return {
    contentType: `multipart/related; type="application/dicom"; boundary=${boundary}`,
    body,
  };
}

function summarizeStow(raw: DicomDataset, origin: string): StowResult {
  const retrieveUrlAttr = raw["00081190"];
  const retrieveUrlValue = retrieveUrlAttr?.Value?.[0];
  const retrieveUrl =
    typeof retrieveUrlValue === "string" ? rewriteOrigin(retrieveUrlValue, origin) : null;
  const studyInstanceUid = retrieveUrl !== null ? extractStudyUidFromUrl(retrieveUrl) : null;

  const failedAttr = raw["00081198"];
  const failedSopCount = failedAttr?.Value?.length ?? 0;

  const refAttr = raw["00081199"];
  const referencedSopCount = refAttr?.Value?.length ?? 0;

  return { raw, retrieveUrl, studyInstanceUid, failedSopCount, referencedSopCount };
}

function extractStudyUidFromUrl(url: string): string | null {
  const marker = "/studies/";
  const start = url.indexOf(marker);
  if (start === -1) return null;
  const rest = url.slice(start + marker.length);
  const end = rest.search(/[/?#]/);
  const uid = end === -1 ? rest : rest.slice(0, end);
  return uid === "" ? null : decodeURIComponent(uid);
}

export function rewriteOrigin(url: string, origin: string): string {
  try {
    const parsed = new URL(url);
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
