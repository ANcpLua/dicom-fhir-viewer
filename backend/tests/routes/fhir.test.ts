import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFhirRouter } from "../../src/routes/fhir.js";
import { SqliteFhirStore } from "../../src/services/fhir-store.js";
import type { FhirImagingStudy, FhirPatient } from "../../src/models/fhir-types.js";

const PATIENT: FhirPatient = {
  resourceType: "Patient",
  id: "patient-1",
  identifier: [{ system: "urn:dicom:patient-id", value: "PAT-1" }],
  gender: "female",
};

const STUDY: FhirImagingStudy = {
  resourceType: "ImagingStudy",
  id: "study-1",
  status: "available",
  subject: { reference: "Patient/patient-1" },
  identifier: [{ system: "urn:dicom:uid", value: "urn:oid:1.2.3" }],
  numberOfSeries: 1,
  numberOfInstances: 1,
};

describe("buildFhirRouter", () => {
  let store: SqliteFhirStore;

  beforeEach(() => {
    store = new SqliteFhirStore({ path: ":memory:" });
    store.upsertPatient(PATIENT);
    store.upsertImagingStudy(STUDY);
  });

  afterEach(() => {
    store.close();
  });

  const deps = () => ({
    store,
    orthanc: {
      searchStudies: vi.fn().mockResolvedValue([]),
      getStudyMetadata: vi.fn(),
    },
    endpointAddress: "http://localhost:8042/dicom-web",
  });

  it("GET /Patient returns a searchset Bundle with 1 entry", async () => {
    const app = buildFhirRouter(deps());
    const res = await app.request("/Patient");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resourceType: string; total: number; entry: { resource: FhirPatient }[] };
    expect(body.resourceType).toBe("Bundle");
    expect(body.total).toBe(1);
    expect(body.entry[0]?.resource.id).toBe("patient-1");
  });

  it("GET /Patient/:id returns the resource directly", async () => {
    const app = buildFhirRouter(deps());
    const res = await app.request("/Patient/patient-1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as FhirPatient;
    expect(body.id).toBe("patient-1");
    expect(body.gender).toBe("female");
  });

  it("GET /Patient/:id returns OperationOutcome 404 for unknown id", async () => {
    const app = buildFhirRouter(deps());
    const res = await app.request("/Patient/nope");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { resourceType: string; issue: { code: string }[] };
    expect(body.resourceType).toBe("OperationOutcome");
    expect(body.issue[0]?.code).toBe("not-found");
  });

  it("GET /ImagingStudy/:id returns the ImagingStudy resource", async () => {
    const app = buildFhirRouter(deps());
    const res = await app.request("/ImagingStudy/study-1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as FhirImagingStudy;
    expect(body.subject.reference).toBe("Patient/patient-1");
  });

  it("GET /Endpoint/orthanc-dicomweb returns the configured WADO-RS endpoint", async () => {
    const app = buildFhirRouter(deps());
    const res = await app.request("/Endpoint/orthanc-dicomweb");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { address: string; connectionType: { code: string } };
    expect(body.address).toBe("http://localhost:8042/dicom-web");
    expect(body.connectionType.code).toBe("dicom-wado-rs");
  });

  it("GET /Endpoint/:other returns 404 (only one Endpoint exists)", async () => {
    const app = buildFhirRouter(deps());
    const res = await app.request("/Endpoint/does-not-exist");
    expect(res.status).toBe(404);
  });
});
