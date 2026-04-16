import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrthancClient } from "../../src/services/orthanc-client.js";
import { SqliteFhirStore } from "../../src/services/fhir-store.js";
import { syncAllStudies, syncStudy } from "../../src/services/fhir-sync.js";
import { ENDPOINT_ID } from "../../src/services/fhir-transform.js";

const ORTHANC_BASE = process.env["ORTHANC_BASE_URL"] ?? "http://localhost:8042";
const DICOMWEB_ROOT = process.env["ORTHANC_DICOMWEB_ROOT"] ?? "/dicom-web";
const SAMPLE_DCM = resolve(import.meta.dirname, "../../../sample-data/CT_small.dcm");

const KNOWN_STUDY_UID = "1.3.6.1.4.1.5962.1.2.1.20040119072730.12322";
const KNOWN_PATIENT_ID = "1CT1";

describe("FHIR sync against real Orthanc (integration)", () => {
  let available = false;
  let client: OrthancClient;
  let store: SqliteFhirStore;

  beforeAll(async () => {
    client = new OrthancClient({ baseUrl: ORTHANC_BASE, dicomWebRoot: DICOMWEB_ROOT });
    store = new SqliteFhirStore({ path: ":memory:" });
    try {
      const probe = await fetch(`${ORTHANC_BASE}${DICOMWEB_ROOT}/studies`, {
        headers: { Accept: "application/dicom+json" },
      });
      available = probe.ok || probe.status === 204;
    } catch {
      available = false;
    }
    if (!available) return;
    const buf = await readFile(SAMPLE_DCM);
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    await client.storeInstances([bytes]);
  });

  afterAll(() => {
    store?.close();
    if (!available) console.warn(`Skipped FHIR sync integration: Orthanc not reachable`);
  });

  it("syncStudy fetches WADO-RS metadata and persists Patient + ImagingStudy in the FHIR store", async () => {
    if (!available) return;

    await syncStudy({ orthanc: client, store }, KNOWN_STUDY_UID);

    const patients = store.listPatients();
    expect(patients).toHaveLength(1);
    expect(patients[0]?.id).toBe(`patient-${KNOWN_PATIENT_ID}`);
    expect(patients[0]?.identifier?.[0]?.value).toBe(KNOWN_PATIENT_ID);
    expect(patients[0]?.gender).toBe("other");

    const studies = store.listImagingStudies();
    expect(studies).toHaveLength(1);
    const study = studies[0]!;
    expect(study.subject.reference).toBe(`Patient/patient-${KNOWN_PATIENT_ID}`);
    expect(study.identifier[0]?.value).toBe(`urn:oid:${KNOWN_STUDY_UID}`);
    expect(study.numberOfSeries).toBe(1);
    expect(study.numberOfInstances).toBe(1);
    expect(study.series?.[0]?.modality.code).toBe("CT");
    expect(study.endpoint?.[0]?.reference).toBe(`Endpoint/${ENDPOINT_ID}`);
  });

  it("syncAllStudies reports {syncedStudies:1, syncedPatients:1, errors:[]} for a single-study Orthanc", async () => {
    if (!available) return;

    const freshStore = new SqliteFhirStore({ path: ":memory:" });
    try {
      const result = await syncAllStudies({ orthanc: client, store: freshStore });
      expect(result.errors).toEqual([]);
      expect(result.syncedStudies).toBeGreaterThanOrEqual(1);
      expect(result.syncedPatients).toBeGreaterThanOrEqual(1);
      expect(freshStore.counts().patients).toBeGreaterThanOrEqual(1);
    } finally {
      freshStore.close();
    }
  });
});
