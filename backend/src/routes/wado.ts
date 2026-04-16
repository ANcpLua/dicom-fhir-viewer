import { Hono } from "hono";
import type { OrthancClient } from "../services/orthanc-client.js";
import { OrthancDicomWebError } from "../services/orthanc-client.js";
import { extractFirstPart, MultipartParseError } from "../services/multipart-related.js";

export interface WadoRouterDeps {
  readonly orthanc: Pick<OrthancClient, "proxyDicomWebRaw">;
}

const DICOM_INSTANCE_ACCEPT = 'multipart/related; type="application/dicom"; transfer-syntax=*';

export function buildWadoRouter(deps: WadoRouterDeps): Hono {
  const app = new Hono();

  // Returns a single raw-DICOM file for a given SOP instance.
  //
  // Cornerstone's `wadouri` scheme fetches any URL returning DICOM bytes and
  // parses them client-side. Orthanc's DICOMweb RetrieveInstance endpoint
  // answers with `multipart/related; type="application/dicom"` wrapping the
  // single DICOM part, so we proxy that upstream response and unwrap the
  // multipart here rather than forcing the browser to understand multipart.
  app.get("/instance/:studyUid/:seriesUid/:sopInstanceUid", async (c) => {
    const studyUid = c.req.param("studyUid");
    const seriesUid = c.req.param("seriesUid");
    const sopInstanceUid = c.req.param("sopInstanceUid");
    const path = `/studies/${studyUid}/series/${seriesUid}/instances/${sopInstanceUid}`;

    try {
      const upstream = await deps.orthanc.proxyDicomWebRaw(path, DICOM_INSTANCE_ACCEPT);
      const dicomBytes = extractFirstPart(upstream.body, upstream.contentType);
      return c.body(dicomBytes as unknown as ArrayBuffer, 200, {
        "Content-Type": "application/dicom",
        "Cache-Control": "private, max-age=300",
      });
    } catch (error) {
      if (error instanceof OrthancDicomWebError) {
        return c.json({ error: "wado_instance_upstream", upstreamStatus: error.status }, 502);
      }
      if (error instanceof MultipartParseError) {
        return c.json({ error: "wado_instance_multipart", message: error.message }, 502);
      }
      throw error;
    }
  });

  return app;
}
