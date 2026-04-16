import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        // Server bootstrap — runs the HTTP listener; exercised only by the
        // live Docker stack, not unit tests. Not meaningful to cover.
        "src/index.ts",
        // Pure type declarations — no runtime branches to measure.
        "src/models/fhir-types.ts",
      ],
    },
  },
});
