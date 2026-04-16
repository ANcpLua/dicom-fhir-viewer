export interface BackendConfig {
  readonly port: number;
  readonly orthancBaseUrl: string;
  readonly dicomWebRoot: string;
  readonly corsOrigins: ReadonlyArray<string>;
  readonly fhirStorePath: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_PORT = 3000;
const DEFAULT_ORTHANC_BASE_URL = "http://localhost:8042";
const DEFAULT_DICOMWEB_ROOT = "/dicom-web";
const DEFAULT_CORS_ORIGINS = "http://localhost:5173";
const DEFAULT_FHIR_STORE_PATH = "./data/fhir.db";

export function loadConfig(env: NodeJS.ProcessEnv): BackendConfig {
  const port = parsePort(env["BACKEND_PORT"]);
  const orthancBaseUrl = parseBaseUrl(env["ORTHANC_BASE_URL"]);
  const dicomWebRoot = parseDicomWebRoot(env["ORTHANC_DICOMWEB_ROOT"]);
  const corsOrigins = parseCorsOrigins(env["CORS_ORIGINS"]);
  const fhirStorePath = env["FHIR_STORE_PATH"]?.trim() || DEFAULT_FHIR_STORE_PATH;
  return { port, orthancBaseUrl, dicomWebRoot, corsOrigins, fhirStorePath };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_PORT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new ConfigError(`BACKEND_PORT must be an integer in [1..65535], got "${raw}"`);
  }
  return n;
}

function parseBaseUrl(raw: string | undefined): string {
  const value = raw ?? DEFAULT_ORTHANC_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigError(`ORTHANC_BASE_URL is not a valid URL: "${value}"`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConfigError(`ORTHANC_BASE_URL must use http(s) scheme, got "${parsed.protocol}" in "${value}"`);
  }
  return value.replace(/\/+$/, "");
}

function parseDicomWebRoot(raw: string | undefined): string {
  const value = raw ?? DEFAULT_DICOMWEB_ROOT;
  if (!value.startsWith("/")) {
    throw new ConfigError(`ORTHANC_DICOMWEB_ROOT must start with "/", got "${value}"`);
  }
  return value.replace(/\/+$/, "");
}

function parseCorsOrigins(raw: string | undefined): ReadonlyArray<string> {
  const value = raw ?? DEFAULT_CORS_ORIGINS;
  const origins = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (origins.length === 0) {
    throw new ConfigError(`CORS_ORIGINS must list at least one origin, got "${raw}"`);
  }
  for (const origin of origins) {
    if (origin === "*") continue;
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ConfigError(`CORS_ORIGINS entry must be http(s) or "*", got "${origin}"`);
      }
    } catch {
      throw new ConfigError(`CORS_ORIGINS entry is not a valid URL: "${origin}"`);
    }
  }
  return origins;
}
