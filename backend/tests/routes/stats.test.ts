import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildStatsRouter } from "../../src/routes/stats.js";
import { SqliteFhirStore } from "../../src/services/fhir-store.js";
import type { FhirImagingStudy, FhirPatient } from "../../src/models/fhir-types.js";

const PATIENT: FhirPatient = { resourceType: "Patient", id: "patient-1" };

const ctStudy: FhirImagingStudy = {
  resourceType: "ImagingStudy",
  id: "study-ct",
  status: "available",
  subject: { reference: "Patient/patient-1" },
  identifier: [{ system: "urn:dicom:uid", value: "urn:oid:1.2.1" }],
  numberOfSeries: 2,
  numberOfInstances: 60,
  started: "2024-03-15",
  series: [
    {
      uid: "1.2.1.1",
      modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "CT" },
      numberOfInstances: 30,
    },
    {
      uid: "1.2.1.2",
      modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "CT" },
      numberOfInstances: 30,
    },
  ],
};

const mrStudy: FhirImagingStudy = {
  ...ctStudy,
  id: "study-mr",
  identifier: [{ system: "urn:dicom:uid", value: "urn:oid:1.2.2" }],
  numberOfSeries: 1,
  numberOfInstances: 15,
  started: "2024-04-01",
  series: [
    {
      uid: "1.2.2.1",
      modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "MR" },
      numberOfInstances: 15,
    },
  ],
};

describe("GET /api/stats", () => {
  let store: SqliteFhirStore;

  beforeEach(() => {
    store = new SqliteFhirStore({ path: ":memory:" });
  });

  afterEach(() => store.close());

  it("returns zero totals on an empty store (initial state)", async () => {
    const res = await buildStatsRouter({ store }).request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totalPatients: number;
      totalStudies: number;
      totalInstances: number;
      modalityDistribution: unknown[];
      studiesByDate: unknown[];
    };
    expect(body).toMatchObject({
      totalPatients: 0,
      totalStudies: 0,
      totalInstances: 0,
      modalityDistribution: [],
      studiesByDate: [],
    });
  });

  it("aggregates modality counts across all series and sums instances from numberOfInstances", async () => {
    store.upsertPatient(PATIENT);
    store.upsertImagingStudy(ctStudy);
    store.upsertImagingStudy(mrStudy);

    const res = await buildStatsRouter({ store }).request("/");
    const body = (await res.json()) as {
      totalPatients: number;
      totalStudies: number;
      totalInstances: number;
      modalityDistribution: { modality: string; count: number }[];
      studiesByDate: { date: string; count: number }[];
    };
    expect(body.totalPatients).toBe(1);
    expect(body.totalStudies).toBe(2);
    expect(body.totalInstances).toBe(75);
    expect(body.modalityDistribution).toEqual([
      { modality: "CT", count: 2 },
      { modality: "MR", count: 1 },
    ]);
    expect(body.studiesByDate).toEqual([
      { date: "2024-03-15", count: 1 },
      { date: "2024-04-01", count: 1 },
    ]);
  });

  it("buckets a study without 'started' into the 'unknown' date and increments existing buckets", async () => {
    const sameDayA: FhirImagingStudy = {
      ...ctStudy,
      id: "study-sameday-a",
      identifier: [{ system: "urn:dicom:uid", value: "urn:oid:sd.a" }],
      started: "2024-05-01",
    };
    const sameDayB: FhirImagingStudy = {
      ...ctStudy,
      id: "study-sameday-b",
      identifier: [{ system: "urn:dicom:uid", value: "urn:oid:sd.b" }],
      started: "2024-05-01",
    };
    const undated = {
      resourceType: "ImagingStudy" as const,
      id: "study-undated",
      status: "available" as const,
      subject: { reference: "Patient/patient-1" },
      identifier: [{ system: "urn:dicom:uid", value: "urn:oid:undated" }],
      numberOfSeries: 1,
      numberOfInstances: 5,
      series: [
        {
          uid: "1.u.1",
          modality: { system: "http://dicom.nema.org/resources/ontology/DCM", code: "CT" },
          numberOfInstances: 5,
        },
      ],
    } as FhirImagingStudy;

    store.upsertPatient(PATIENT);
    store.upsertImagingStudy(sameDayA);
    store.upsertImagingStudy(sameDayB);
    store.upsertImagingStudy(undated);

    const res = await buildStatsRouter({ store }).request("/");
    const body = (await res.json()) as {
      studiesByDate: { date: string; count: number }[];
    };
    expect(body.studiesByDate.find((d) => d.date === "2024-05-01")?.count).toBe(2);
    expect(body.studiesByDate.find((d) => d.date === "unknown")?.count).toBe(1);
  });

  it("handles an ImagingStudy whose 'series' array is absent (series ?? [] fallback)", async () => {
    const noSeries = {
      resourceType: "ImagingStudy" as const,
      id: "study-noseries",
      status: "available" as const,
      subject: { reference: "Patient/patient-1" },
      identifier: [{ system: "urn:dicom:uid", value: "urn:oid:noseries" }],
      numberOfSeries: 0,
      numberOfInstances: 0,
      started: "2024-07-01",
    } as FhirImagingStudy;

    store.upsertPatient(PATIENT);
    store.upsertImagingStudy(noSeries);

    const res = await buildStatsRouter({ store }).request("/");
    const body = (await res.json()) as {
      totalStudies: number;
      modalityDistribution: unknown[];
    };
    expect(body.totalStudies).toBe(1);
    expect(body.modalityDistribution).toEqual([]);
  });
});
