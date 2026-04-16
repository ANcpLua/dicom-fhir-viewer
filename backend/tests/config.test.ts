import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";

type Env = NodeJS.ProcessEnv;

describe("loadConfig", () => {
  const emptyEnv: Env = {};

  it("returns defaults when no env vars are set", () => {
    const cfg = loadConfig(emptyEnv);
    expect(cfg).toEqual({
      port: 3000,
      orthancBaseUrl: "http://localhost:8042",
      dicomWebRoot: "/dicom-web",
      corsOrigins: ["http://localhost:5173"],
      fhirStorePath: "./data/fhir.db",
    });
  });

  it("honors FHIR_STORE_PATH when provided", () => {
    const cfg = loadConfig({ FHIR_STORE_PATH: "/tmp/fhir-custom.db" });
    expect(cfg.fhirStorePath).toBe("/tmp/fhir-custom.db");
  });

  describe("CORS_ORIGINS", () => {
    it("parses a comma-separated list and trims whitespace", () => {
      const cfg = loadConfig({ CORS_ORIGINS: "http://a.example, http://b.example:8080" });
      expect(cfg.corsOrigins).toEqual(["http://a.example", "http://b.example:8080"]);
    });

    it("accepts wildcard '*' unchanged (local-dev convenience)", () => {
      const cfg = loadConfig({ CORS_ORIGINS: "*" });
      expect(cfg.corsOrigins).toEqual(["*"]);
    });

    it("rejects an entry that is not a parseable URL", () => {
      expect(() => loadConfig({ CORS_ORIGINS: "not-a-url" })).toThrow(ConfigError);
    });

    it("rejects a non-http(s) scheme", () => {
      expect(() => loadConfig({ CORS_ORIGINS: "ftp://bad.example" })).toThrow(ConfigError);
    });

    it("rejects an empty string (needs at least one origin)", () => {
      expect(() => loadConfig({ CORS_ORIGINS: "  ,  " })).toThrow(ConfigError);
    });
  });

  describe("BACKEND_PORT", () => {
    it("honors a valid custom port", () => {
      const cfg = loadConfig({ BACKEND_PORT: "4000" });
      expect(cfg.port).toBe(4000);
    });

    it("uses default when BACKEND_PORT is empty string", () => {
      const cfg = loadConfig({ BACKEND_PORT: "" });
      expect(cfg.port).toBe(3000);
    });

    it("rejects a non-numeric port", () => {
      expect(() => loadConfig({ BACKEND_PORT: "abc" })).toThrow(ConfigError);
    });

    it("rejects a negative port", () => {
      expect(() => loadConfig({ BACKEND_PORT: "-1" })).toThrow(ConfigError);
    });

    it("rejects a zero port", () => {
      expect(() => loadConfig({ BACKEND_PORT: "0" })).toThrow(ConfigError);
    });

    it("rejects a port above 65535", () => {
      expect(() => loadConfig({ BACKEND_PORT: "65536" })).toThrow(ConfigError);
    });

    it("rejects a floating point port", () => {
      expect(() => loadConfig({ BACKEND_PORT: "3000.5" })).toThrow(ConfigError);
    });
  });

  describe("ORTHANC_BASE_URL", () => {
    it("honors a valid http URL", () => {
      const cfg = loadConfig({ ORTHANC_BASE_URL: "http://orthanc:8042" });
      expect(cfg.orthancBaseUrl).toBe("http://orthanc:8042");
    });

    it("honors a valid https URL", () => {
      const cfg = loadConfig({ ORTHANC_BASE_URL: "https://pacs.example.org" });
      expect(cfg.orthancBaseUrl).toBe("https://pacs.example.org");
    });

    it("strips trailing slashes so paths can be joined safely", () => {
      const cfg = loadConfig({ ORTHANC_BASE_URL: "http://orthanc:8042//" });
      expect(cfg.orthancBaseUrl).toBe("http://orthanc:8042");
    });

    it("rejects a URL without scheme", () => {
      expect(() => loadConfig({ ORTHANC_BASE_URL: "orthanc:8042" })).toThrow(ConfigError);
    });

    it("rejects a non-http(s) scheme", () => {
      expect(() => loadConfig({ ORTHANC_BASE_URL: "ftp://orthanc:8042" })).toThrow(ConfigError);
    });

    it("rejects a malformed URL", () => {
      expect(() => loadConfig({ ORTHANC_BASE_URL: "http://" })).toThrow(ConfigError);
    });
  });

  describe("ORTHANC_DICOMWEB_ROOT", () => {
    it("honors a valid root path", () => {
      const cfg = loadConfig({ ORTHANC_DICOMWEB_ROOT: "/dicomweb" });
      expect(cfg.dicomWebRoot).toBe("/dicomweb");
    });

    it("strips trailing slash", () => {
      const cfg = loadConfig({ ORTHANC_DICOMWEB_ROOT: "/dicom-web/" });
      expect(cfg.dicomWebRoot).toBe("/dicom-web");
    });

    it("rejects a path that does not start with slash", () => {
      expect(() => loadConfig({ ORTHANC_DICOMWEB_ROOT: "dicom-web" })).toThrow(ConfigError);
    });
  });
});
