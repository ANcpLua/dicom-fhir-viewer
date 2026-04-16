import { Hono } from "hono";
import type { OrthancClient } from "../services/orthanc-client.js";
import { mapMetadataToStudyDetail } from "../models/study-detail.js";
import { respondOrthancError } from "./orthanc-error.js";

export interface StudyDetailRouterDeps {
  readonly orthanc: Pick<OrthancClient, "getStudyMetadata">;
}

export function buildStudyDetailRouter(deps: StudyDetailRouterDeps): Hono {
  const app = new Hono();

  app.get("/:studyUid", async (c) => {
    const studyUid = c.req.param("studyUid");
    if (studyUid.trim() === "") return c.json({ error: "studyUid is required" }, 400);
    try {
      const metadata = await deps.orthanc.getStudyMetadata(studyUid);
      return c.json(mapMetadataToStudyDetail(studyUid, metadata));
    } catch (error) {
      const mapped = respondOrthancError(c, error, "orthanc_unavailable");
      if (mapped !== null) return mapped;
      throw error;
    }
  });

  return app;
}
