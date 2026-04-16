import Database from "better-sqlite3";
import type { FhirImagingStudy, FhirPatient } from "../models/fhir-types.js";

export interface FhirStore {
  upsertPatient(patient: FhirPatient): void;
  getPatient(id: string): FhirPatient | null;
  listPatients(): ReadonlyArray<FhirPatient>;
  upsertImagingStudy(study: FhirImagingStudy): void;
  getImagingStudy(id: string): FhirImagingStudy | null;
  listImagingStudies(): ReadonlyArray<FhirImagingStudy>;
  counts(): { readonly patients: number; readonly imagingStudies: number };
  close(): void;
}

interface ResourceRow {
  readonly resource: string;
}

export interface SqliteFhirStoreOptions {
  readonly path: string;
}

export class SqliteFhirStore implements FhirStore {
  readonly #db: Database.Database;
  readonly #stmts: {
    readonly upsertPatient: Database.Statement<[string, string]>;
    readonly getPatient: Database.Statement<[string]>;
    readonly listPatients: Database.Statement<[]>;
    readonly upsertImagingStudy: Database.Statement<[string, string]>;
    readonly getImagingStudy: Database.Statement<[string]>;
    readonly listImagingStudies: Database.Statement<[]>;
    readonly counts: Database.Statement<[]>;
  };

  constructor(options: SqliteFhirStoreOptions) {
    this.#db = new Database(options.path);
    this.#db.pragma("journal_mode = WAL");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS imaging_studies (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL
      );
    `);
    this.#stmts = {
      upsertPatient: this.#db.prepare(
        "INSERT INTO patients (id, resource) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET resource = excluded.resource",
      ),
      getPatient: this.#db.prepare("SELECT resource FROM patients WHERE id = ?"),
      listPatients: this.#db.prepare("SELECT resource FROM patients ORDER BY id"),
      upsertImagingStudy: this.#db.prepare(
        "INSERT INTO imaging_studies (id, resource) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET resource = excluded.resource",
      ),
      getImagingStudy: this.#db.prepare("SELECT resource FROM imaging_studies WHERE id = ?"),
      listImagingStudies: this.#db.prepare("SELECT resource FROM imaging_studies ORDER BY id"),
      counts: this.#db.prepare(
        "SELECT (SELECT COUNT(*) FROM patients) AS patients, (SELECT COUNT(*) FROM imaging_studies) AS imagingStudies",
      ),
    };
  }

  upsertPatient(patient: FhirPatient): void {
    this.#stmts.upsertPatient.run(patient.id, JSON.stringify(patient));
  }

  getPatient(id: string): FhirPatient | null {
    const row = this.#stmts.getPatient.get(id) as ResourceRow | undefined;
    return row ? (JSON.parse(row.resource) as FhirPatient) : null;
  }

  listPatients(): ReadonlyArray<FhirPatient> {
    const rows = this.#stmts.listPatients.all() as ResourceRow[];
    return rows.map((r) => JSON.parse(r.resource) as FhirPatient);
  }

  upsertImagingStudy(study: FhirImagingStudy): void {
    this.#stmts.upsertImagingStudy.run(study.id, JSON.stringify(study));
  }

  getImagingStudy(id: string): FhirImagingStudy | null {
    const row = this.#stmts.getImagingStudy.get(id) as ResourceRow | undefined;
    return row ? (JSON.parse(row.resource) as FhirImagingStudy) : null;
  }

  listImagingStudies(): ReadonlyArray<FhirImagingStudy> {
    const rows = this.#stmts.listImagingStudies.all() as ResourceRow[];
    return rows.map((r) => JSON.parse(r.resource) as FhirImagingStudy);
  }

  counts(): { readonly patients: number; readonly imagingStudies: number } {
    return this.#stmts.counts.get() as { readonly patients: number; readonly imagingStudies: number };
  }

  close(): void {
    this.#db.close();
  }
}
