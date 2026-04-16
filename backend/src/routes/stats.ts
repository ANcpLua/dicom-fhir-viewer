import { Hono } from "hono";
import type { FhirStore } from "../services/fhir-store.js";

export interface StatsRouterDeps {
  readonly store: Pick<FhirStore, "listImagingStudies" | "listPatients">;
}

export interface StatsResponse {
  readonly totalPatients: number;
  readonly totalStudies: number;
  readonly totalInstances: number;
  readonly modalityDistribution: ReadonlyArray<{ readonly modality: string; readonly count: number }>;
  readonly studiesByDate: ReadonlyArray<{ readonly date: string; readonly count: number }>;
}

export function buildStatsRouter(deps: StatsRouterDeps): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    const patients = deps.store.listPatients();
    const studies = deps.store.listImagingStudies();

    const modalityCount = new Map<string, number>();
    const dateCount = new Map<string, number>();
    let totalInstances = 0;

    for (const study of studies) {
      totalInstances += study.numberOfInstances;
      const date = study.started ?? "unknown";
      dateCount.set(date, (dateCount.get(date) ?? 0) + 1);
      for (const series of study.series ?? []) {
        const code = series.modality.code;
        modalityCount.set(code, (modalityCount.get(code) ?? 0) + 1);
      }
    }

    const response: StatsResponse = {
      totalPatients: patients.length,
      totalStudies: studies.length,
      totalInstances,
      modalityDistribution: Array.from(modalityCount.entries())
        .map(([modality, count]) => ({ modality, count }))
        .sort((a, b) => b.count - a.count),
      studiesByDate: Array.from(dateCount.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
    return c.json(response);
  });

  return app;
}
