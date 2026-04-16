import { describe, expect, it, vi } from "vitest";
import {
  OrthancClient,
  type FetchLike,
} from "../../src/services/orthanc-client.js";

const OPTIONS = { baseUrl: "http://orthanc:8042/", dicomWebRoot: "/dicom-web/" } as const;

describe("OrthancClient.proxyDicomWebRaw", () => {
  it("GETs the rooted URL with the caller's Accept header and returns status + contentType + body", async () => {
    const payload = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: { "Content-Type": 'multipart/related; boundary=abc' },
      }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.proxyDicomWebRaw("/studies/1.2/series/1.3/instances/1.4", 'multipart/related; type="application/dicom"');

    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("http://orthanc:8042/dicom-web/studies/1.2/series/1.3/instances/1.4");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>)["Accept"]).toBe(
      'multipart/related; type="application/dicom"',
    );
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("multipart/related; boundary=abc");
    expect(Array.from(result.body)).toEqual([0x01, 0x02, 0x03, 0x04]);
  });

  it("normalizes a subpath that does not start with a slash", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      new Response(new Uint8Array([]), { status: 200 }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await client.proxyDicomWebRaw("studies/1.2", "application/octet-stream");

    const [url] = spy.mock.calls[0]!;
    expect(url).toBe("http://orthanc:8042/dicom-web/studies/1.2");
  });

  it("falls back to application/octet-stream when the upstream omits Content-Type", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(
      new Response(new Uint8Array([0xaa]), { status: 200 }),
    );
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    const result = await client.proxyDicomWebRaw("/studies/1.2", "any");
    expect(result.contentType).toBe("application/octet-stream");
  });

  it("throws OrthancDicomWebError with the operation path when upstream returns non-2xx", async () => {
    const spy = vi.fn<FetchLike>().mockResolvedValue(new Response("missing", { status: 404 }));
    const client = new OrthancClient({ ...OPTIONS, fetch: spy });

    await expect(client.proxyDicomWebRaw("/studies/nope", "application/dicom+json")).rejects.toMatchObject({
      name: "OrthancDicomWebError",
      status: 404,
      operation: "DICOMweb proxy /studies/nope",
    });
    expect(spy).toHaveBeenCalledOnce();
  });
});
