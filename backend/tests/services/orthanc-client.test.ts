import { describe, expect, it, vi } from "vitest";
import {
  OrthancClient,
  OrthancDicomWebError,
  buildMultipartRelated,
  rewriteOrigin,
  type FetchLike,
} from "../../src/services/orthanc-client.js";

const OPTIONS = { baseUrl: "http://orthanc:8042/", dicomWebRoot: "/dicom-web/" } as const;
const STUDY = "1.2.3.4.5";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/dicom+json" },
  });
}

describe("OrthancClient.searchStudies", () => {
  it("GETs /studies with dicom+json Accept and returns parsed datasets", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(jsonResponse([{ "0020000D": { vr: "UI", Value: ["1.1"] } }]));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.searchStudies();

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("http://orthanc:8042/dicom-web/studies");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>)["Accept"]).toBe("application/dicom+json");
    expect(result).toEqual([{ "0020000D": { vr: "UI", Value: ["1.1"] } }]);
  });

  it("returns empty array on HTTP 204 (DICOMweb empty-search semantics)", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    expect(await client.searchStudies()).toEqual([]);
  });

  it("throws OrthancDicomWebError on non-2xx with status and body", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(new Response("boom", { status: 503 }));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await expect(client.searchStudies()).rejects.toMatchObject({
      name: "OrthancDicomWebError",
      status: 503,
      operation: "QIDO-RS searchStudies",
    });
  });
});

describe("OrthancClient.getStudyMetadata", () => {
  it("requests /studies/{uid}/metadata and returns the array", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(jsonResponse([{ "00080060": { vr: "CS", Value: ["CT"] } }]));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.getStudyMetadata(STUDY);

    expect(spy.mock.calls[0]![0]).toBe(`http://orthanc:8042/dicom-web/studies/${STUDY}/metadata`);
    expect(result).toHaveLength(1);
  });

  it("rejects an empty studyInstanceUid without making a request", async () => {
    const spy = vi.fn<FetchLike>();
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await expect(client.getStudyMetadata("   ")).rejects.toThrow(TypeError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws OrthancDicomWebError when Orthanc returns 404 for an unknown UID", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(new Response("not found", { status: 404 }));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await expect(client.getStudyMetadata("9.9.9")).rejects.toThrow(OrthancDicomWebError);
  });
});

describe("OrthancClient.storeInstances", () => {
  const DCM = new Uint8Array([0x44, 0x49, 0x43, 0x4d, 0x00, 0x01, 0x02, 0x03]);

  it("POSTs multipart/related with application/dicom parts and summarizes the STOW response", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        "00081190": { vr: "UR", Value: ["http://orthanc/studies/1.2.3"] },
        "00081198": { vr: "SQ" },
        "00081199": { vr: "SQ", Value: [{}, {}] },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);

    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("http://orthanc:8042/dicom-web/studies");
    expect(init?.method).toBe("POST");
    const contentType = (init?.headers as Record<string, string>)["Content-Type"];
    expect(contentType).toMatch(/^multipart\/related; type="application\/dicom"; boundary=/);
    // Orthanc returns Host-based URLs (e.g. http://0.0.0.0/...); the client
    // rewrites the origin so callers get a URL bound to the configured baseUrl.
    expect(result.retrieveUrl).toBe("http://orthanc:8042/studies/1.2.3");
    expect(result.failedSopCount).toBe(0);
    expect(result.referencedSopCount).toBe(2);
  });

  it("rejects an empty instance list without calling fetch", async () => {
    const spy = vi.fn<FetchLike>();
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await expect(client.storeInstances([])).rejects.toThrow(TypeError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws OrthancDicomWebError on a failed STOW response", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(new Response("invalid dicom", { status: 400 }));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await expect(client.storeInstances([DCM])).rejects.toThrow(OrthancDicomWebError);
  });
});

describe("OrthancClient constructor normalization", () => {
  it("prepends '/' to dicomWebRoot when it lacks a leading slash (constructor branch)", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(jsonResponse([]));
    const client = new OrthancClient({
      baseUrl: "http://orthanc:8042",
      dicomWebRoot: "dicom-web", // no leading slash — forces the normalization branch
      fetch: spy,
    });

    await client.searchStudies();
    expect(spy.mock.calls[0]?.[0]).toBe("http://orthanc:8042/dicom-web/studies");
  });
});

describe("OrthancClient.storeInstances — summarizeStow attribute fallbacks", () => {
  const DCM = new Uint8Array([0x44, 0x49, 0x43, 0x4d]);

  it("returns null retrieveUrl, null studyInstanceUid, and zero SOP counts when the STOW response is empty", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(jsonResponse({}));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);

    expect(result.retrieveUrl).toBeNull();
    expect(result.studyInstanceUid).toBeNull();
    expect(result.failedSopCount).toBe(0);
    expect(result.referencedSopCount).toBe(0);
  });

  it("returns null retrieveUrl when the 00081190 Value[0] is not a string (defensive type check)", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ "00081190": { vr: "UR", Value: [42] } }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    expect(result.retrieveUrl).toBeNull();
    expect(result.studyInstanceUid).toBeNull();
  });

  it("extracts the UID when the retrieveUrl continues into /series/...", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        "00081190": { vr: "UR", Value: ["http://orthanc/studies/1.2.3/series/9.9.9"] },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    expect(result.studyInstanceUid).toBe("1.2.3");
  });

  it("extracts the UID when the retrieveUrl carries a query string", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        "00081190": { vr: "UR", Value: ["http://orthanc/studies/1.2.3?modality=CT"] },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    expect(result.studyInstanceUid).toBe("1.2.3");
  });

  it("extracts the UID when the retrieveUrl carries a fragment", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        "00081190": { vr: "UR", Value: ["http://orthanc/studies/1.2.3#top"] },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    expect(result.studyInstanceUid).toBe("1.2.3");
  });

  it("returns null studyInstanceUid when the retrieveUrl has no /studies/ segment (rewriteOrigin still applies)", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        "00081190": { vr: "UR", Value: ["http://orthanc/other/path"] },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    // rewriteOrigin still normalizes the host to the configured baseUrl origin.
    expect(result.retrieveUrl).toBe("http://orthanc:8042/other/path");
    expect(result.studyInstanceUid).toBeNull();
  });

  it("reports a non-zero failedSopCount when 00081198 FailedSOPSequence carries entries (length fallback vs populated)", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({
        "00081198": { vr: "SQ", Value: [{}, {}, {}] },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    expect(result.failedSopCount).toBe(3);
  });

  it("returns null studyInstanceUid when /studies/ is present but the UID segment is empty", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      jsonResponse({ "00081190": { vr: "UR", Value: ["http://orthanc/studies/"] } }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.storeInstances([DCM]);
    expect(result.studyInstanceUid).toBeNull();
  });
});

describe("rewriteOrigin", () => {
  const ORIGIN = "http://orthanc:8042";

  it("replaces 0.0.0.0 with the configured origin, preserving the DICOMweb path", () => {
    expect(rewriteOrigin("http://0.0.0.0/dicom-web/studies/1.2.3", ORIGIN)).toBe(
      "http://orthanc:8042/dicom-web/studies/1.2.3",
    );
  });

  it("replaces a mismatched host and port", () => {
    expect(rewriteOrigin("https://elsewhere.example:9999/studies/1", ORIGIN)).toBe(
      "http://orthanc:8042/studies/1",
    );
  });

  it("preserves query string and fragment", () => {
    expect(rewriteOrigin("http://0.0.0.0/studies?modality=CT#top", ORIGIN)).toBe(
      "http://orthanc:8042/studies?modality=CT#top",
    );
  });

  it("returns the raw input unchanged when it is not a parseable URL", () => {
    expect(rewriteOrigin("not a url", ORIGIN)).toBe("not a url");
  });
});

describe("buildMultipartRelated", () => {
  it("wraps each part with its own Content-Type header and closes with boundary--", () => {
    const a = new TextEncoder().encode("AAA");
    const b = new TextEncoder().encode("BBB");

    const { contentType, body } = buildMultipartRelated([a, b]);

    expect(contentType).toMatch(/^multipart\/related; type="application\/dicom"; boundary=DicomBoundary/);
    const asText = new TextDecoder("latin1").decode(body);
    const parts = asText.split(/--DicomBoundary[a-z0-9]+/);
    // ["", partA, partB, "--\r\n"]
    expect(parts).toHaveLength(4);
    expect(parts[1]).toContain("Content-Type: application/dicom");
    expect(parts[1]).toContain("AAA");
    expect(parts[2]).toContain("BBB");
    expect(parts[3]).toBe("--\r\n");
  });
});
