import { Hono } from "hono";
import type { OrthancClient, StowResult } from "../services/orthanc-client.js";
import type { FhirStore } from "../services/fhir-store.js";
import { syncStudy } from "../services/fhir-sync.js";
import { respondOrthancError } from "./orthanc-error.js";

export interface UploadRouterDeps {
  readonly orthanc: Pick<OrthancClient, "storeInstances" | "getStudyMetadata">;
  readonly store?: Pick<FhirStore, "upsertPatient" | "upsertImagingStudy">;
}

export interface UploadResponse {
  readonly fileCount: number;
  readonly referencedSopCount: number;
  readonly failedSopCount: number;
  readonly retrieveUrl: string | null;
}

const DICM_MAGIC = [0x44, 0x49, 0x43, 0x4d] as const; // "DICM"
const DICM_MAGIC_OFFSET = 128;

export function buildUploadRouter(deps: UploadRouterDeps): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return c.json({ error: "expected multipart/form-data" }, 415);
    }

    const form = await c.req.formData();
    const entries = form.getAll("file");
    if (entries.length === 0) {
      return c.json({ error: 'no files provided (expected form field "file")' }, 400);
    }

    const instances: Uint8Array[] = [];
    for (const entry of entries) {
      if (!(entry instanceof File)) {
        return c.json({ error: "form field \"file\" must be a file part" }, 400);
      }
      const bytes = new Uint8Array(await entry.arrayBuffer());
      if (!hasDicomMagic(bytes)) {
        return c.json({ error: "not a DICOM file (missing DICM magic)", filename: entry.name }, 400);
      }
      instances.push(bytes);
    }

    let result: StowResult;
    try {
      result = await deps.orthanc.storeInstances(instances);
    } catch (error) {
      const mapped = respondOrthancError(c, error, "orthanc_stow_failed");
      if (mapped !== null) return mapped;
      throw error;
    }

    if (deps.store !== undefined && result.studyInstanceUid !== null) {
      try {
        await syncStudy(
          { orthanc: deps.orthanc, store: deps.store },
          result.studyInstanceUid,
        );
      } catch (error) {
        console.warn(`[upload] FHIR sync failed for study ${result.studyInstanceUid}:`, error);
      }
    }

    const payload: UploadResponse = {
      fileCount: instances.length,
      referencedSopCount: result.referencedSopCount,
      failedSopCount: result.failedSopCount,
      retrieveUrl: result.retrieveUrl,
    };
    return c.json(payload, 201);
  });

  return app;
}

function hasDicomMagic(bytes: Uint8Array): boolean {
  if (bytes.length < DICM_MAGIC_OFFSET + DICM_MAGIC.length) return false;
  for (let i = 0; i < DICM_MAGIC.length; i += 1) {
    if (bytes[DICM_MAGIC_OFFSET + i] !== DICM_MAGIC[i]) return false;
  }
  return true;
}
