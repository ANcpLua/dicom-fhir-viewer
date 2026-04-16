import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrthancClient } from "../../src/services/orthanc-client.js";
import { mapDicomDatasetToStudy } from "../../src/models/study.js";

const ORTHANC_BASE = process.env["ORTHANC_BASE_URL"] ?? "http://localhost:8042";
const DICOMWEB_ROOT = process.env["ORTHANC_DICOMWEB_ROOT"] ?? "/dicom-web";
const SAMPLE_DCM = resolve(import.meta.dirname, "../../../sample-data/CT_small.dcm");

// CT_small.dcm known identifiers (pydicom test fixture)
const KNOWN_STUDY_UID = "1.3.6.1.4.1.5962.1.2.1.20040119072730.12322";
const KNOWN_PATIENT_NAME = "CompressedSamples^CT1";

describe("OrthancClient against real Orthanc (integration)", () => {
  let available = false;
  let dicom: Uint8Array;
  let client: OrthancClient;

  beforeAll(async () => {
    client = new OrthancClient({ baseUrl: ORTHANC_BASE, dicomWebRoot: DICOMWEB_ROOT });
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
    dicom = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });

  afterAll(() => {
    if (!available) {
      console.warn(`Skipped integration tests: Orthanc not reachable at ${ORTHANC_BASE}${DICOMWEB_ROOT}`);
    }
  });

  it.runIf(true)("STOW -> QIDO -> WADO round-trip stores a study Orthanc can query by UID", async () => {
    if (!available) return;

    const stow = await client.storeInstances([dicom]);
    expect(stow.failedSopCount).toBe(0);
    expect(stow.referencedSopCount).toBeGreaterThanOrEqual(1);

    const allStudies = await client.searchStudies();
    const match = allStudies.find((ds) => {
      const uid = ds["0020000D"]?.Value?.[0];
      return uid === KNOWN_STUDY_UID;
    });
    expect(match, `study ${KNOWN_STUDY_UID} not found in QIDO-RS result`).toBeDefined();

    const mapped = mapDicomDatasetToStudy(match!);
    expect(mapped.studyInstanceUid).toBe(KNOWN_STUDY_UID);
    expect(mapped.patientName).toBe(KNOWN_PATIENT_NAME);
    expect(mapped.numberOfInstances).toBeGreaterThanOrEqual(1);

    const metadata = await client.getStudyMetadata(KNOWN_STUDY_UID);
    expect(metadata.length).toBeGreaterThanOrEqual(1);
    const firstInstance = metadata[0]!;
    expect(firstInstance["00080060"]?.Value?.[0]).toBe("CT");
    expect(firstInstance["00280010"]?.Value?.[0]).toBe(128);
    expect(firstInstance["00280011"]?.Value?.[0]).toBe(128);
  });
});
