import { Hono } from "hono";
import type { FhirStore } from "../services/fhir-store.js";
import type { OrthancClient } from "../services/orthanc-client.js";
import { buildEndpoint, ENDPOINT_ID } from "../services/fhir-transform.js";
import { syncAllStudies } from "../services/fhir-sync.js";

export interface FhirRouterDeps {
  readonly store: FhirStore;
  readonly orthanc: Pick<OrthancClient, "searchStudies" | "getStudyMetadata">;
  readonly endpointAddress: string;
}

export function buildFhirRouter(deps: FhirRouterDeps): Hono {
  const app = new Hono();

  app.get("/Patient", (c) => c.json(bundle("searchset", deps.store.listPatients())));

  app.get("/Patient/:id", (c) => {
    const id = c.req.param("id");
    const patient = deps.store.getPatient(id);
    if (patient === null) return c.json(notFound("Patient", id), 404);
    return c.json(patient);
  });

  app.get("/ImagingStudy", (c) =>
    c.json(bundle("searchset", deps.store.listImagingStudies())),
  );

  app.get("/ImagingStudy/:id", (c) => {
    const id = c.req.param("id");
    const study = deps.store.getImagingStudy(id);
    if (study === null) return c.json(notFound("ImagingStudy", id), 404);
    return c.json(study);
  });

  app.get("/Endpoint/:id", (c) => {
    const id = c.req.param("id");
    if (id !== ENDPOINT_ID) return c.json(notFound("Endpoint", id), 404);
    return c.json(buildEndpoint(deps.endpointAddress));
  });

  app.post("/sync", async (c) => {
    const result = await syncAllStudies({ orthanc: deps.orthanc, store: deps.store });
    return c.json(result);
  });

  return app;
}

function bundle<T extends { id: string }>(type: "searchset", entries: ReadonlyArray<T>): {
  resourceType: "Bundle";
  type: "searchset";
  total: number;
  entry: ReadonlyArray<{ resource: T }>;
} {
  return {
    resourceType: "Bundle",
    type,
    total: entries.length,
    entry: entries.map((resource) => ({ resource })),
  };
}

function notFound(resourceType: string, id: string): {
  resourceType: "OperationOutcome";
  issue: { severity: "error"; code: "not-found"; diagnostics: string }[];
} {
  return {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity: "error",
        code: "not-found",
        diagnostics: `${resourceType}/${id} not found`,
      },
    ],
  };
}
