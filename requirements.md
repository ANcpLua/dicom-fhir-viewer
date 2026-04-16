# DICOM/FHIR Viewer — Requirements Specification

**Document ID:** DICOM-FHIR-001  
**Version:** 1.0.0  
**Date:** 2026-04-11  
**Author:** Alexander Nachtmann  
**Status:** Approved for Implementation  
**Classification:** Learning Project / Domain Ramp-Up

---

## 1. Purpose & Strategic Context

### 1.1 Mission Statement

Build a minimal but functional DICOM/FHIR web application that demonstrates the ability to ingest, store, query, and
display medical imaging data through modern web technologies. This project serves as a learning exercise for a
medical-imaging software engineer role.

### 1.2 Success Criteria

The project is successful when:

- SC-1: A DICOM file can be uploaded via a web interface and stored in Orthanc.
- SC-2: DICOM metadata is extractable and displayable in a React dashboard.
- SC-3: A FHIR ImagingStudy resource is created from DICOM metadata.
- SC-4: The FHIR resource links back to the DICOMweb endpoint for image retrieval.
- SC-5: The entire stack runs locally via Docker Compose with a single command.
- SC-6: The codebase has meaningful test coverage (unit + integration).
- SC-7: The README documents the architecture, decisions, and what was learned.

### 1.3 Non-Goals (Explicitly Out of Scope)

- NG-1: Production-grade security, RBAC, or OAuth2/OIDC integration.
- NG-2: Real patient data. Only public DICOM sample datasets.
- NG-3: Full PACS feature parity. This is a learning project, not a product.
- NG-4: Mobile responsiveness or design polish.
- NG-5: OMOP transformation (Gold layer). Bronze + Silver only.
- NG-6: Federated learning, ML pipelines, or model registry.
- NG-7: Deployment to cloud/Railway. Local-only.
- NG-8: CE marking, MDR/IVDR compliance, or regulatory documentation.

---

## 2. Domain Model

### 2.1 DICOM Concepts

| Concept                 | Definition                                                                                                                                                     | Relevance                                 |
|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|
| DICOM                   | Digital Imaging and Communications in Medicine. Standard for medical imaging file format and network protocol. Established 1993 (ACR/NEMA).                    | Core data format for medical imaging workflows. |
| DICOM File (.dcm)       | Binary file containing image pixel data + structured metadata (tags). Tags include Patient ID, Study Date, Modality, Series Description, Slice Thickness, etc. | Input data format.                        |
| DICOM Tag               | Key-value pair identified by (Group, Element) tuple. Example: (0010,0010) = Patient Name. Defined in DICOM PS3.6 Data Dictionary.                              | Metadata extraction target.               |
| Study                   | Top-level container. One patient visit producing images. Contains one or more Series.                                                                          | Primary query/display unit.               |
| Series                  | Subset of a Study. One acquisition sequence (e.g., T1-weighted MRI). Contains one or more Instances.                                                           | Grouping unit in UI.                      |
| Instance (SOP Instance) | Single image or object. One .dcm file.                                                                                                                         | Atomic display unit.                      |
| Modality                | Type of imaging equipment. CT, MR, US, CR, DX, PT, etc.                                                                                                        | Filter/facet in dashboard.                |
| PACS                    | Picture Archiving and Communication System. Server that stores and serves DICOM data.                                                                          | Orthanc fulfills this role.               |
| DICOMweb                | RESTful API standard (DICOM PS3.18) for web-based DICOM operations. Replaces legacy DIMSE TCP protocol.                                                        | Primary API layer.                        |
| WADO-RS                 | Web Access to DICOM Objects — Retrieve. GET images/metadata by Study/Series/Instance UID.                                                                      | Read path.                                |
| QIDO-RS                 | Query based on ID for DICOM Objects. Search Studies/Series/Instances by tag filters.                                                                           | Search/list path.                         |
| STOW-RS                 | Store Over the Web. POST DICOM files to server.                                                                                                                | Upload/ingest path.                       |

### 2.2 FHIR Concepts

| Concept      | Definition                                                                                                                                | Relevance                                |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------|
| FHIR         | Fast Healthcare Interoperability Resources. HL7 standard (R4, 2019). RESTful API for clinical data exchange.                              | Clinical data layer linking to imaging.  |
| Resource     | Atomic unit in FHIR. Everything is a Resource with a type and URL. JSON or XML.                                                           | Data model building block.               |
| Patient      | Person receiving care. Demographics, identifiers.                                                                                         | Links imaging to person.                 |
| ImagingStudy | FHIR representation of a DICOM Study. Contains references to Series and Instances. Links to DICOMweb endpoint for actual image retrieval. | Bridge between DICOM and clinical world. |
| Endpoint     | FHIR resource describing a DICOMweb server URL. Referenced by ImagingStudy for image retrieval.                                           | Connection configuration.                |
| Reference    | FHIR link between resources. Example: ImagingStudy.subject → Patient/123.                                                                 | Relational integrity.                    |

### 2.3 Data Flow (Bronze → Silver)

```
[DICOM .dcm files]
    │
    ▼ STOW-RS
[Orthanc PACS]  ←── Bronze Layer (raw DICOM storage)
    │
    ▼ QIDO-RS / WADO-RS (metadata)
[TypeScript Ingestion Service]
    │
    ▼ Transform DICOM tags → FHIR ImagingStudy
[FHIR Store (SQLite, WAL)]  ←── Silver Layer
    │
    ▼ REST API
[React Dashboard]
    │
    ▼ WADO-RS RetrieveInstance (raw DICOM bytes, multipart/related unwrapped backend-side)
    ▼ dicom-parser decode → HTML canvas
[Image Viewer Component]
```

---

## 3. Functional Requirements

### 3.1 DICOM Ingestion (FR-INGEST)

| ID           | Requirement                                                                 | Priority |
|--------------|-----------------------------------------------------------------------------|----------|
| FR-INGEST-01 | The system SHALL accept DICOM file uploads via a web UI drag-and-drop zone. | Must     |
| FR-INGEST-02 | The system SHALL forward uploaded DICOM files to Orthanc via STOW-RS.       | Must     |
| FR-INGEST-03 | The system SHALL display upload progress and success/failure status.        | Must     |
| FR-INGEST-04 | The system SHALL accept multi-file uploads (entire Study folder).           | Should   |
| FR-INGEST-05 | The system SHALL reject non-DICOM files with a clear error message.         | Should   |

### 3.2 DICOM Query & Browse (FR-BROWSE)

| ID           | Requirement                                                                                                                             | Priority |
|--------------|-----------------------------------------------------------------------------------------------------------------------------------------|----------|
| FR-BROWSE-01 | The system SHALL list all Studies stored in Orthanc via QIDO-RS.                                                                        | Must     |
| FR-BROWSE-02 | Each Study row SHALL display: Patient Name, Patient ID, Study Date, Modality, Study Description, Number of Series, Number of Instances. | Must     |
| FR-BROWSE-03 | The system SHALL support filtering by Modality and date range.                                                                          | Should   |
| FR-BROWSE-04 | The system SHALL support text search across Patient Name and Study Description.                                                         | Should   |
| FR-BROWSE-05 | Clicking a Study SHALL expand to show its Series with Series Description, Modality, and Instance count.                                 | Must     |

### 3.3 DICOM Image Display (FR-VIEW)

| ID         | Requirement                                                                                                                                            | Priority |
|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| FR-VIEW-01 | The system SHALL display a DICOM image retrieved via WADO-RS for a selected Instance.                                                                  | Must     |
| FR-VIEW-02 | The system SHALL fetch raw DICOM bytes via `/api/wado/instance/...` and decode them client-side with `dicom-parser`, rendering the result to an HTML canvas. | Must     |
| FR-VIEW-03 | The system SHALL display key DICOM tags alongside the image (Patient Name, Study Date, Modality, Series Description, Slice info).                             | Must     |
| FR-VIEW-04 | The system SHALL support window center / window width adjustment via drag interaction on the canvas, including MONOCHROME1 inversion and rescale slope/intercept. | Must     |

### 3.4 FHIR Transformation (FR-FHIR)

| ID         | Requirement                                                                                                                                                                  | Priority |
|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| FR-FHIR-01 | The system SHALL create a FHIR Patient resource from DICOM Patient tags (0010,0010 Patient Name; 0010,0020 Patient ID; 0010,0030 Patient Birth Date; 0010,0040 Patient Sex). | Must     |
| FR-FHIR-02 | The system SHALL create a FHIR ImagingStudy resource from DICOM Study-level tags, containing Series and Instance references.                                                 | Must     |
| FR-FHIR-03 | The ImagingStudy resource SHALL contain a reference to the DICOMweb Endpoint for image retrieval (WADO-RS base URL).                                                         | Must     |
| FR-FHIR-04 | The system SHALL expose FHIR resources via a REST API: GET /Patient, GET /Patient/:id, GET /ImagingStudy, GET /ImagingStudy/:id.                                             | Must     |
| FR-FHIR-05 | The system SHALL trigger FHIR transformation automatically when a new Study is ingested (via Orthanc change callback or polling).                                            | Should   |
| FR-FHIR-06 | The FHIR ImagingStudy SHALL conform to FHIR R4 ImagingStudy schema.                                                                                                          | Must     |

### 3.5 Dashboard (FR-DASH)

| ID         | Requirement                                                                                                              | Priority |
|------------|--------------------------------------------------------------------------------------------------------------------------|----------|
| FR-DASH-01 | The dashboard SHALL display summary statistics: total Studies, total Patients, Modality distribution, Studies over time. | Must     |
| FR-DASH-02 | The dashboard SHALL provide navigation between Study Browser, Image Viewer, and FHIR Explorer views.                     | Must     |
| FR-DASH-03 | The FHIR Explorer SHALL display raw FHIR JSON for any Patient or ImagingStudy resource.                                  | Must     |
| FR-DASH-04 | The dashboard SHALL use React + TypeScript + Tailwind CSS.                                                               | Must     |

---

## 4. Non-Functional Requirements

| ID     | Requirement                                                                                                                          | Category        |
|--------|--------------------------------------------------------------------------------------------------------------------------------------|-----------------|
| NFR-01 | The entire stack SHALL start with a single `docker compose up` command.                                                              | Operability     |
| NFR-02 | The system SHALL use TypeScript (strict mode) for all application code.                                                              | Maintainability |
| NFR-03 | The system SHALL use React 19 + Tailwind CSS 4 + Vite for the frontend.                                                              | Tech Stack      |
| NFR-04 | The backend SHALL be a Node.js/TypeScript service (Hono, Express, or Fastify).                                                       | Tech Stack      |
| NFR-05 | The system SHALL include unit tests for DICOM tag extraction and FHIR transformation logic.                                          | Quality         |
| NFR-06 | The system SHALL include integration tests that verify STOW-RS upload → QIDO-RS query round-trip against real Orthanc.               | Quality         |
| NFR-07 | All API calls to Orthanc SHALL use the DICOMweb REST API, not the legacy Orthanc REST API except where DICOMweb has no equivalent.   | Standards       |
| NFR-08 | The README SHALL document: architecture diagram, setup instructions, DICOM/FHIR mapping decisions, known limitations, and learnings. | Documentation   |
| NFR-09 | The codebase SHALL contain zero hardcoded URLs. All endpoints configurable via environment variables.                                | Configuration   |
| NFR-10 | The system SHALL use public DICOM sample data only. No real patient data.                                                            | Privacy         |

---

## 5. Technical Architecture

### 5.1 Component Overview

```
┌─────────────────────────────────────────────────────┐
│                   Docker Compose                     │
│                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Orthanc  │  │   Backend    │  │   Frontend    │ │
│  │  (PACS)   │  │  (Node/TS)   │  │  (React/TS)  │ │
│  │           │  │              │  │              │  │
│  │ DICOMweb  │◄─┤ /api/studies │◄─┤ Dashboard    │ │
│  │ STOW-RS   │  │ /api/fhir/*  │  │ Browser      │ │
│  │ WADO-RS   │  │ /api/upload  │  │ Viewer       │ │
│  │ QIDO-RS   │  │              │  │ FHIR Explorer│ │
│  │           │  │ FHIR Store   │  │              │ │
│  │ Port 8042 │  │ (SQLite)     │  │ Port 5173    │ │
│  └──────────┘  │ Port 3000    │  └───────────────┘ │
│                 └──────────────┘                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 Technology Decisions

| Decision                | Choice                                                                      | Rationale                                                                              |
|-------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| PACS Server             | Orthanc (Docker: `orthancteam/orthanc:25.2.0`)                              | Open source, DICOMweb plugin built-in, gdcm codecs included, lightweight, active community. |
| Backend Runtime         | Node.js + TypeScript                                                        | Matches job profile ("TypeScript, JavaScript"). Fast iteration.                        |
| Backend Framework       | Hono                                                                        | Lightweight, TypeScript-native, edge-ready. Or Express if Hono causes issues.          |
| Frontend                | React 19 + TypeScript + Vite + Tailwind CSS 4                               | Matches job profile exactly. Modern, fast DX.                                          |
| FHIR Store              | SQLite via better-sqlite3                                                   | Simplest possible persistent store. No external dependency. Sufficient for this project.      |
| DICOM Rendering         | Client-side decode via `dicom-parser` + HTML canvas (uncompressed little-endian grayscale). | Small surface area; avoids Cornerstone's wasm codec tooling. Window/level is a drag interaction on the canvas. |
| Test Framework          | Vitest                                                                      | TypeScript-native, fast, compatible with Vite.                                         |
| Container Orchestration | Docker Compose                                                              | Single command startup. Orthanc + Backend + Frontend.                                  |

### 5.3 API Design

**Backend REST API:**

```
POST   /api/upload                                        → Accepts .dcm file(s), forwards to Orthanc STOW-RS, auto-syncs to FHIR store
GET    /api/studies                                       → Proxies QIDO-RS, returns Study list with metadata
GET    /api/studies/:uid                                  → Returns Study detail with Series/Instance tree (WADO-RS metadata)
GET    /api/wado/instance/:studyUid/:seriesUid/:sopUid    → Proxies WADO-RS RetrieveInstance, unwraps multipart/related, returns raw DICOM bytes
GET    /api/fhir/Patient                                  → Returns all FHIR Patient resources
GET    /api/fhir/Patient/:id                              → Returns single FHIR Patient
GET    /api/fhir/ImagingStudy                             → Returns all FHIR ImagingStudy resources
GET    /api/fhir/ImagingStudy/:id                         → Returns single FHIR ImagingStudy
GET    /api/fhir/Endpoint                                 → Returns the singleton Endpoint/orthanc-dicomweb resource
GET    /api/fhir/Endpoint/:id                             → Returns the singleton Endpoint resource by id
POST   /api/fhir/sync                                     → Triggers manual DICOM→FHIR re-sync of all studies
GET    /api/stats                                         → Returns summary statistics (counts, modality distribution, studies over time)
```

### 5.4 DICOM → FHIR Mapping

| DICOM Tag           | Tag ID      | FHIR ImagingStudy Field               |
|---------------------|-------------|---------------------------------------|
| Study Instance UID  | (0020,000D) | ImagingStudy.identifier               |
| Study Date          | (0008,0020) | ImagingStudy.started                  |
| Study Description   | (0008,1030) | ImagingStudy.description              |
| Accession Number    | (0008,0050) | ImagingStudy.identifier (type=ACSN)   |
| Number of Series    | (0020,1206) | ImagingStudy.numberOfSeries           |
| Number of Instances | (0020,1208) | ImagingStudy.numberOfInstances        |
| Modality            | (0008,0060) | ImagingStudy.modality                 |
| Patient Name        | (0010,0010) | Patient.name                          |
| Patient ID          | (0010,0020) | Patient.identifier                    |
| Patient Birth Date  | (0010,0030) | Patient.birthDate                     |
| Patient Sex         | (0010,0040) | Patient.gender                        |
| Series Instance UID | (0020,000E) | ImagingStudy.series.uid               |
| Series Description  | (0008,103E) | ImagingStudy.series.description       |
| Series Number       | (0020,0011) | ImagingStudy.series.number            |
| SOP Instance UID    | (0008,0018) | ImagingStudy.series.instance.uid      |
| SOP Class UID       | (0008,0016) | ImagingStudy.series.instance.sopClass |
| Instance Number     | (0020,0013) | ImagingStudy.series.instance.number   |

---

## 6. Sample Data

### 6.1 Public DICOM Datasets

| Dataset              | Source                      | Content                | Size       |
|----------------------|-----------------------------|------------------------|------------|
| Orthanc Sample       | Built-in Orthanc test data  | Basic CT/MR studies    | ~10 MB     |
| TCIA LIDC-IDRI       | The Cancer Imaging Archive  | Lung CT scans          | Selectable |
| OsiriX DICOM Samples | osirix-viewer.com/resources | Multi-modality samples | ~50 MB     |

Use Orthanc built-in samples first. Download OsiriX samples for variety (CT, MR, US, CR).

### 6.2 Sample Data Loading

```bash
# Download OsiriX DICOM samples
curl -O https://www.dclunie.com/images/dicom/brainix.zip
unzip brainix.zip -d ./sample-data/

# Upload to Orthanc via STOW-RS (or Orthanc REST API for bulk)
curl -X POST http://localhost:8042/instances \
  --data-binary @./sample-data/brain_001.dcm \
  -H "Content-Type: application/dicom"
```

---

## 7. Project Structure

```
dicom-fhir-viewer/
├── docker-compose.yml                 # Orthanc service, healthcheck, persistent volume
├── orthanc/
│   └── orthanc.json                   # DICOMweb plugin enabled at /dicom-web/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.test.json
│   ├── src/
│   │   ├── index.ts                   # Hono app wiring
│   │   ├── config.ts                  # env-var loader (validated)
│   │   ├── routes/
│   │   │   ├── studies.ts             # GET /api/studies (QIDO-RS)
│   │   │   ├── study-detail.ts        # GET /api/studies/:uid (WADO-RS metadata)
│   │   │   ├── wado.ts                # GET /api/wado/instance/... (RetrieveInstance → raw DICOM bytes)
│   │   │   ├── upload.ts              # POST /api/upload (STOW-RS + FHIR auto-sync)
│   │   │   ├── fhir.ts                # /api/fhir/{Patient,ImagingStudy,Endpoint}[/:id] + /sync
│   │   │   ├── stats.ts               # GET /api/stats
│   │   │   └── orthanc-error.ts       # shared Orthanc error → HTTP mapping
│   │   ├── services/
│   │   │   ├── orthanc-client.ts      # DICOMweb client (STOW/QIDO/WADO + rewriteOrigin)
│   │   │   ├── multipart-related.ts   # multipart/related parser for WADO-RS RetrieveInstance
│   │   │   ├── fhir-transform.ts      # StudyDetail → FHIR Patient + ImagingStudy + Endpoint
│   │   │   ├── fhir-store.ts          # SqliteFhirStore (better-sqlite3, WAL)
│   │   │   └── fhir-sync.ts           # orchestrator: fetch → transform → store
│   │   └── models/
│   │       ├── dicom-tags.ts          # DICOM tag ID constants
│   │       ├── dicom-accessors.ts     # DICOMweb JSON accessors
│   │       ├── study.ts               # Study domain type + mapper
│   │       ├── study-detail.ts        # Series/Instance tree mapper
│   │       └── fhir-types.ts          # FHIR R4 resource interfaces
│   └── tests/                         # Vitest unit + integration (vs real Orthanc)
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx · App.tsx
│       ├── pages/                     # Dashboard · StudyBrowser · StudyDetail · FhirExplorer
│       ├── components/                # AppShell · DicomUpload · StudyTable · ImageViewer · TagsPanel · StatsCards
│       ├── hooks/                     # useStudies · useStudyDetail · useUpload · useStats · useAsyncResource · useFhirLists · useFhirResource · useFhirSync
│       └── lib/                       # api.ts · env.ts · types.ts · dicom-format.ts · dicom-pixels.ts (client-side DICOM decoder)
├── docs/screenshots/                   # Playwright captures per phase
├── sample-data/                        # gitignored; public pydicom fixtures
└── README.md
```

---

## 8. User Stories

### 8.1 Researcher Persona

| ID    | Story                                                                                                                                        | Acceptance Criteria                                                                                          |
|-------|----------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| US-01 | As a researcher, I want to upload DICOM files from my computer so that I can view them in the web application.                               | Upload zone accepts .dcm files; files appear in Study Browser after upload; error shown for non-DICOM files. |
| US-02 | As a researcher, I want to browse all uploaded Studies so that I can find the imaging data I need.                                           | Study list shows Patient Name, Date, Modality, Description; list is filterable and searchable.               |
| US-03 | As a researcher, I want to view a DICOM image in my browser so that I don't need a separate DICOM viewer.                                    | Clicking an Instance shows the image; key metadata displayed alongside.                                      |
| US-04 | As a researcher, I want to see the FHIR representation of my imaging data so that I understand how it integrates with clinical data systems. | FHIR Explorer shows ImagingStudy JSON; Patient reference resolves; Endpoint reference contains DICOMweb URL. |

### 8.2 Engineer Persona (Self — Learning Goals)

| ID    | Story                                                                                                                   | Acceptance Criteria                                                                          |
|-------|-------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------|
| US-10 | As a software engineer, I want to understand the DICOM data model so that I can build imaging-aware applications.       | Can explain Study/Series/Instance hierarchy; can identify key DICOM tags by ID.              |
| US-11 | As a software engineer, I want to implement DICOMweb REST calls so that I can integrate with any PACS.                  | Working STOW-RS, QIDO-RS, WADO-RS calls in TypeScript.                                       |
| US-12 | As a software engineer, I want to transform DICOM metadata to FHIR so that I understand the clinical data bridge.       | Correct FHIR R4 ImagingStudy resources with valid references.                                |
| US-13 | As a software engineer, I want to document my learnings so that I can articulate my DICOM/FHIR knowledge when discussing medical imaging work. | README contains architecture decisions, DICOM/FHIR mapping rationale, and known limitations. |

---

## 9. Risks & Mitigations

| Risk                                                                     | Impact | Probability | Mitigation                                                                                                          |
|--------------------------------------------------------------------------|--------|-------------|---------------------------------------------------------------------------------------------------------------------|
| Orthanc DICOMweb plugin configuration complexity                         | Medium | Medium      | Use default Orthanc Docker image with DICOMweb pre-enabled. Fall back to Orthanc REST API if DICOMweb issues arise. |
| DICOM file format edge cases (compressed transfer syntaxes, multi-frame) | Low    | Medium      | Stick to uncompressed samples initially. Document which transfer syntaxes are supported.                            |
| FHIR ImagingStudy schema complexity                                      | Medium | Low         | Use only required fields. Validate against FHIR R4 schema. Keep it minimal.                                         |
| Scope creep into full PACS features                                      | High   | High        | Requirements spec is the scope boundary. If it's not in this document, it doesn't get built.                        |

---

## 10. Definition of Done

A requirement is Done when:

1. Code is implemented in TypeScript with strict mode, no `any` types.
2. Code has unit tests (transformation logic) or integration tests (API round-trips).
3. Code is linted and formatted.
4. The feature is accessible via the React dashboard.
5. The Docker Compose stack starts cleanly with the feature included.
6. The README is updated if the feature introduces new concepts or decisions.

---

## 11. Implementation Order

| Phase   | Scope                                                                                    | Depends On |
|---------|------------------------------------------------------------------------------------------|------------|
| Phase 0 | Docker Compose with Orthanc + DICOMweb enabled. Verify STOW/QIDO/WADO manually via curl. | Nothing.   |
| Phase 1 | Backend: Orthanc DICOMweb client (TypeScript). Upload route. Studies list route.         | Phase 0.   |
| Phase 2 | Frontend: Study Browser page. Upload component. Basic navigation.                        | Phase 1.   |
| Phase 3 | Frontend: Image Viewer (client-side `dicom-parser` + canvas, window/level drag). Tags panel. Study Detail page. | Phase 2.   |
| Phase 4 | Backend: FHIR transformation service. FHIR store (SQLite). FHIR REST routes.             | Phase 1.   |
| Phase 5 | Frontend: FHIR Explorer page. Dashboard with stats.                                      | Phase 4.   |
| Phase 6 | Tests: Unit tests for FHIR transform. Integration tests for DICOMweb round-trip.         | Phase 4.   |
| Phase 7 | README: Architecture, decisions, learnings, screenshots.                                 | Phase 6.   |

---

## 12. Glossary

| Term         | Definition                                                                                                     |
|--------------|----------------------------------------------------------------------------------------------------------------|
| ACR          | American College of Radiology. Co-creator of DICOM standard.                                                   |
| DIMSE        | DICOM Message Service Element. Legacy TCP-based DICOM network protocol. Replaced by DICOMweb for web contexts. |
| DICOMweb     | RESTful web services for DICOM (PS3.18). STOW-RS, WADO-RS, QIDO-RS.                                            |
| FHIR         | Fast Healthcare Interoperability Resources. HL7 R4 standard for clinical data.                                 |
| HL7          | Health Level Seven International. Standards organization for health informatics.                                |
| ImagingStudy | FHIR Resource representing a DICOM Study with references to Series/Instances.                                  |
| NEMA         | National Electrical Manufacturers Association. Co-creator of DICOM standard.                                   |
| OHIF         | Open Health Imaging Foundation. Open-source DICOM web viewer.                                                  |
| Orthanc      | Open-source, lightweight DICOM server.                                                                         |
| PACS         | Picture Archiving and Communication System. Server for medical image storage/retrieval.                        |
| QIDO-RS      | Query based on ID for DICOM Objects — RESTful Search.                                                          |
| SOP          | Service-Object Pair. DICOM term for a specific object class (e.g., CT Image).                                  |
| STOW-RS      | Store Over the Web — RESTful Upload.                                                                           |
| UID          | Unique Identifier. DICOM uses globally unique OID-based identifiers.                                           |
| WADO-RS      | Web Access to DICOM Objects — RESTful Retrieve.                                                                |

---

## Appendix A: FHIR ImagingStudy R4 Example (Target Output)

```json
{
  "resourceType": "ImagingStudy",
  "id": "study-001",
  "status": "available",
  "subject": {
    "reference": "Patient/patient-001"
  },
  "started": "2024-03-15T10:30:00Z",
  "identifier": [
    {
      "system": "urn:dicom:uid",
      "value": "urn:oid:1.2.840.113619.2.55.3.604688119.969.1268071029.320"
    }
  ],
  "numberOfSeries": 3,
  "numberOfInstances": 47,
  "description": "MR Brain without contrast",
  "series": [
    {
      "uid": "1.2.840.113619.2.55.3.604688119.969.1268071029.321",
      "number": 1,
      "modality": {
        "system": "http://dicom.nema.org/resources/ontology/DCM",
        "code": "MR"
      },
      "description": "T1 SAG",
      "numberOfInstances": 15,
      "instance": [
        {
          "uid": "1.2.840.113619.2.55.3.604688119.969.1268071029.322",
          "sopClass": {
            "system": "urn:ietf:rfc:3986",
            "code": "urn:oid:1.2.840.10008.5.1.4.1.1.4"
          },
          "number": 1
        }
      ]
    }
  ],
  "endpoint": [
    {
      "reference": "Endpoint/orthanc-dicomweb"
    }
  ]
}
```

## Appendix B: Orthanc Docker Configuration (orthanc.json)

```json
{
  "Name": "DICOM-FHIR-Viewer",
  "DicomWeb": {
    "Enable": true,
    "Root": "/dicom-web/",
    "EnableWado": true,
    "WadoRoot": "/wado",
    "Host": "0.0.0.0",
    "Ssl": false
  },
  "RemoteAccessAllowed": true,
  "AuthenticationEnabled": false,
  "DicomAet": "DCMVIEW",
  "DicomPort": 4242,
  "HttpPort": 8042
}
```

## Appendix C: References

- DICOM Standard: https://www.dicomstandard.org/
- DICOM PS3.18 (DICOMweb): https://dicom.nema.org/medical/dicom/current/output/html/part18.html
- FHIR R4 ImagingStudy: https://www.hl7.org/fhir/r4/imagingstudy.html
- FHIR R4 Patient: https://www.hl7.org/fhir/r4/patient.html
- Orthanc: https://www.orthanc-server.com/
- Orthanc DICOMweb Plugin: https://orthanc.uclouvain.be/book/plugins/dicomweb.html
- Cornerstone.js: https://www.cornerstonejs.org/
- OHIF Viewer: https://ohif.org/