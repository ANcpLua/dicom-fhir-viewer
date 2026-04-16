import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackendUrl } from "../env.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBackendUrl", () => {
  it("returns the configured URL with trailing slashes stripped", () => {
    vi.stubEnv("VITE_BACKEND_URL", "http://backend:3000///");
    expect(getBackendUrl()).toBe("http://backend:3000");
  });

  it("throws when VITE_BACKEND_URL is empty (fail-fast at call time)", () => {
    vi.stubEnv("VITE_BACKEND_URL", "");
    expect(() => getBackendUrl()).toThrow(/VITE_BACKEND_URL/);
  });
});
