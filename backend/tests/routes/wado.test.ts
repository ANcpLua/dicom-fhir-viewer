import { describe, expect, it, vi } from "vitest";
import { buildWadoRouter } from "../../src/routes/wado.js";
import { OrthancDicomWebError } from "../../src/services/orthanc-client.js";

const BOUNDARY = "DicomBoundary4242";
const MULTIPART_CT = `multipart/related; type="application/dicom"; boundary=${BOUNDARY}`;

const STUDY = "1.2.840.113619.2.55.3.604688119.969.1268071029.320";
const SERIES = "1.2.840.113619.2.55.3.604688119.969.1268071029.321";
const SOP = "1.2.840.113619.2.55.3.604688119.969.1268071029.322";
const PATH = `/studies/${STUDY}/series/${SERIES}/instances/${SOP}`;

function makeMultipartBody(payload: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const header = enc.encode(`--${BOUNDARY}\r\nContent-Type: application/dicom\r\n\r\n`);
  const footer = enc.encode(`\r\n--${BOUNDARY}--\r\n`);
  const total = new Uint8Array(header.length + payload.length + footer.length);
  total.set(header, 0);
  total.set(payload, header.length);
  total.set(footer, header.length + payload.length);
  return total;
}

describe("GET /instance/:studyUid/:seriesUid/:sopInstanceUid", () => {
  it("proxies the upstream multipart body and unwraps the single DICOM part", async () => {
    const dicomBytes = new Uint8Array([0x44, 0x49, 0x43, 0x4d, 0xaa, 0xbb, 0xcc, 0xdd]);
    const proxy = vi.fn().mockResolvedValue({
      status: 200,
      contentType: MULTIPART_CT,
      body: makeMultipartBody(dicomBytes),
    });
    const app = buildWadoRouter({ orthanc: { proxyDicomWebRaw: proxy } });

    const res = await app.request(`/instance/${STUDY}/${SERIES}/${SOP}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/dicom");
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    const out = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(out)).toEqual(Array.from(dicomBytes));
    expect(proxy).toHaveBeenCalledOnce();
    const [requestedPath, accept] = proxy.mock.calls[0]!;
    expect(requestedPath).toBe(PATH);
    expect(accept).toMatch(/multipart\/related; type="application\/dicom"/);
  });

  it("returns 502 wado_instance_upstream when Orthanc errors (structured payload)", async () => {
    const proxy = vi.fn().mockImplementation(async () => {
      throw new OrthancDicomWebError(404, "DICOMweb proxy", "not found");
    });
    const app = buildWadoRouter({ orthanc: { proxyDicomWebRaw: proxy } });

    const res = await app.request(`/instance/${STUDY}/${SERIES}/${SOP}`);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; upstreamStatus: number };
    expect(body.error).toBe("wado_instance_upstream");
    expect(body.upstreamStatus).toBe(404);
  });

  it("returns 502 wado_instance_multipart when the upstream body cannot be parsed", async () => {
    const proxy = vi.fn().mockResolvedValue({
      status: 200,
      contentType: MULTIPART_CT,
      body: new TextEncoder().encode("no boundary here"),
    });
    const app = buildWadoRouter({ orthanc: { proxyDicomWebRaw: proxy } });

    const res = await app.request(`/instance/${STUDY}/${SERIES}/${SOP}`);

    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("wado_instance_multipart");
    expect(body.message).toMatch(/opening boundary/);
  });
});
