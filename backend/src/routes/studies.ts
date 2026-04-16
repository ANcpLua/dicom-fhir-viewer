import { Hono } from "hono";
import type { OrthancClient } from "../services/orthanc-client.js";
import { DicomMappingError, mapDicomDatasetToStudy, type Study } from "../models/study.js";
import { respondOrthancError } from "./orthanc-error.js";

export interface StudiesRouterDeps {
  readonly orthanc: Pick<OrthancClient, "searchStudies">;
}

export interface StudiesListResponse {
  readonly studies: ReadonlyArray<Study>;
  readonly skipped: number;
}

export function buildStudiesRouter(deps: StudiesRouterDeps): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    try {
      const datasets = await deps.orthanc.searchStudies();
      const studies: Study[] = [];
      let skipped = 0;
      for (const ds of datasets) {
        try {
          studies.push(mapDicomDatasetToStudy(ds));
        } catch (error) {
          if (error instanceof DicomMappingError) {
            skipped += 1;
            continue;
          }
          throw error;
        }
      }
      const payload: StudiesListResponse = { studies, skipped };
      return c.json(payload);
    } catch (error) {
      const mapped = respondOrthancError(c, error, "orthanc_unavailable");
      if (mapped !== null) return mapped;
      throw error;
    }
  });

  return app;
}
