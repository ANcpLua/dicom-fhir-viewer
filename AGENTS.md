# AGENTS.md

Instructions for AI coding agents working in this repo.

**Scope:** Browser-first viewer that uploads DICOM to Orthanc PACS, projects studies into FHIR R4, and renders images + resources from a Hono backend and a React frontend.

<not_yet_implemented>
- Authentication / multi-tenant separation (Orthanc runs with `AuthenticationEnabled: false`, backend has no auth layer)
- FHIR search parameters beyond `GET /api/fhir/{Patient,ImagingStudy}[/:id]`
- Non-monochrome / compressed transfer syntax rendering in `frontend/src/lib/dicom-pixels.ts`
- Persistent queue / retry for `fhir-sync` (currently best-effort, failures are swallowed per study)
</not_yet_implemented>

## Topology
**does:** Frontend (`:5173`) → Backend (`:3000`, `/api/*`) → Orthanc (`:8042`, `/dicom-web`, `/wado`). Backend persists FHIR resources in SQLite at `FHIR_STORE_PATH` (default `./data/fhir.db`, WAL mode).
**does_not_do:** Frontend never calls Orthanc directly; all DICOMweb traffic is proxied through `/api/wado` and `/api/upload`.

## backend/src/services/orthanc-client.ts
**does:** STOW-RS (multipart/related DICOM) on upload, QIDO-RS for study lists, WADO-RS for instance bytes and rendered frames. Throws `OrthancDicomWebError` with status + operation + body on non-2xx.
**does_not_do:** Retries, caching, or connection pooling — every call is a fresh `fetch`.

## backend/src/services/fhir-store.ts
**does:** `SqliteFhirStore` — prepared-statement CRUD over `patients` / `imaging_studies` tables, JSON-serialised resource column, WAL journal. Implements `FhirStore` interface for test substitution.
**does_not_do:** Schema migrations, versioning, soft delete, transactions across tables.

## backend/src/services/fhir-transform.ts
**does:** Pure functions `transformToFhirPatient` / `transformToFhirImagingStudy` from `StudyDetail` → FHIR R4 resources. IDs are deterministic: `patient-<slug(patientId|studyUid)>`, `study-<slug(studyUid)>`.
**does_not_do:** I/O, store writes, or network calls — composed by `fhir-sync.ts`.

## backend/src/routes/
**does:** One router factory per concern (`studies`, `study-detail`, `upload`, `fhir`, `stats`, `wado`) mounted in `backend/src/index.ts`. Each factory takes its dependencies as a typed object and returns a `Hono` sub-app.
**does_not_do:** Instantiate singletons or read `process.env` — config flows from `loadConfig` → `index.ts` → factory.

## frontend/src/hooks/useAsyncResource.ts
**does:** Generic `AbortController`-aware async state hook (`idle | loading | success | error`) — all data hooks (`useStudies`, `useStudyDetail`, `useFhirLists`, `useStats`, `useFhirResource`) compose it.
**does_not_do:** Global cache, request deduping, revalidation — no SWR / React Query here.

## frontend/src/lib/dicom-pixels.ts
**does:** Parses a DICOM instance with `dicom-parser`, extracts monochrome pixel data, applies window/level (WC/WW) to produce an `ImageData` for canvas rendering.
**does_not_do:** JPEG/JPEG-2000/RLE decoding, colour space conversion, multi-frame playback.

## Environment Variables

```dotenv
BACKEND_PORT=3000                          # backend/src/config.ts
ORTHANC_BASE_URL=http://localhost:8042     # backend
ORTHANC_DICOMWEB_ROOT=/dicom-web           # backend
CORS_ORIGINS=http://localhost:5173         # backend — comma-separated, * allowed
FHIR_STORE_PATH=./data/fhir.db             # backend
FRONTEND_PORT=5173                         # frontend/vite.config.ts
ORTHANC_HTTP_PORT=8042                     # docker-compose.yml
ORTHANC_DICOM_PORT=4242                    # docker-compose.yml
VITE_BACKEND_URL=http://localhost:3000     # frontend/src/lib/env.ts
```

## Patterns
- Interface-first services (`FhirStore`, `FetchLike`) so tests substitute in-memory / `vi.fn()` implementations
- Router factories take typed dependency objects; `buildXxxRouter({ orthanc, store })`
- Prepared SQLite statements held in a `readonly #stmts` bag on the store class
- ESM imports with explicit `.js` extensions (`import { x } from "./y.js"`) — TypeScript emits `.js`, tsx resolves the source
- Readonly tuple types (`ReadonlyArray`, `as const`) for FHIR payload construction
- Integration tests live under `backend/tests/integration/**`, hit a real Orthanc on `localhost:8042`

## Anti-Patterns
- Importing `better-sqlite3` anywhere except `backend/src/services/fhir-store.ts` — the store is the only persistence boundary
- Calling `globalThis.fetch` from a route — go through `OrthancClient` so `FetchLike` stays test-substitutable
- Bare `.ts` imports inside `backend/src/**` — module resolution is NodeNext, use `.js`
- Adding React state libraries (Redux / Zustand / React Query) — current stack is `useAsyncResource` + context-free hooks; don't introduce a global cache without a demonstrated need
- Reading `process.env` outside `backend/src/config.ts` — config loader is the single parse/validate site
- Rendering DICOM pixel data without window/level — `dicom-pixels.ts` is the only sanctioned path

## Constraints
- Node `>=20` (backend), Node 22 in CI
- TypeScript strict, `"type": "module"` in both workspaces
- Backend coverage excludes `src/index.ts` (bootstrap) and `src/models/fhir-types.ts` (type-only) per `vitest.config.ts`
- Frontend coverage excludes `App.tsx`, `main.tsx`, `src/lib/types.ts`, `__tests__/**`, `src/test/**` per `vite.config.ts`
- Integration tests require Orthanc on `localhost:8042` — CI starts it via `docker run`, locally use `docker compose up -d`

## Build & Test

```bash
# Full dev stack
docker compose up -d                           # Orthanc PACS
cd backend  && npm install && npm run dev      # Hono on :3000
cd frontend && npm install && npm run dev      # Vite on :5173

# Backend
cd backend
npm run typecheck              # tsc -p tsconfig.test.json
npm test                       # vitest run (unit + integration)
npm run test:unit              # excludes tests/integration/**
npm run test:integration       # requires Orthanc on :8042
npm test -- --coverage         # v8 coverage → coverage/lcov.info
npx vitest run tests/routes/studies.test.ts        # single file
npx vitest run -t "rejects non-DICOM upload"       # single test by name

# Frontend
cd frontend
npm run typecheck              # tsc --noEmit
npm test                       # vitest run (jsdom)
npm test -- --coverage
npx vitest run src/hooks/__tests__/useStudies.test.ts
```
