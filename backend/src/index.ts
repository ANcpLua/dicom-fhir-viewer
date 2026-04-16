import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { OrthancClient } from "./services/orthanc-client.js";
import { SqliteFhirStore } from "./services/fhir-store.js";
import { buildFhirRouter } from "./routes/fhir.js";
import { buildStatsRouter } from "./routes/stats.js";
import { buildStudiesRouter } from "./routes/studies.js";
import { buildStudyDetailRouter } from "./routes/study-detail.js";
import { buildUploadRouter } from "./routes/upload.js";
import { buildWadoRouter } from "./routes/wado.js";

const config = loadConfig(process.env);

const orthanc = new OrthancClient({
  baseUrl: config.orthancBaseUrl,
  dicomWebRoot: config.dicomWebRoot,
});

mkdirSync(dirname(config.fhirStorePath), { recursive: true });
const fhirStore = new SqliteFhirStore({ path: config.fhirStorePath });
const endpointAddress = `${config.orthancBaseUrl}${config.dicomWebRoot}`;

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: [...config.corsOrigins],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Accept"],
    exposeHeaders: ["Content-Type", "Content-Length"],
    maxAge: 600,
  }),
);

app.get("/api/health", (c) =>
  c.json({ ok: true, orthancBaseUrl: config.orthancBaseUrl, dicomWebRoot: config.dicomWebRoot }),
);

app.route("/api/studies", buildStudiesRouter({ orthanc }));
app.route("/api/studies", buildStudyDetailRouter({ orthanc }));
app.route("/api/upload", buildUploadRouter({ orthanc, store: fhirStore }));
app.route("/api/fhir", buildFhirRouter({ store: fhirStore, orthanc, endpointAddress }));
app.route("/api/stats", buildStatsRouter({ store: fhirStore }));
app.route("/api/wado", buildWadoRouter({ orthanc }));

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `[backend] listening on http://localhost:${info.port}  →  Orthanc ${config.orthancBaseUrl}${config.dicomWebRoot}`,
  );
});
