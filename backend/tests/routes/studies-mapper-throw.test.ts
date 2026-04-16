// Covers the defensive `throw error` branch in routes/studies.ts that re-raises
// a mapper failure that is NOT a DicomMappingError. By contract the mapper only
// throws DicomMappingError, so reaching this branch requires mocking the
// mapper. This test exists to catch a regression: if someone adds a new throw
// to the mapper that isn't a DicomMappingError, the route must surface it as
// a 500 instead of silently skipping the dataset.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/models/study.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/models/study.js")>();
  return {
    ...actual,
    mapDicomDatasetToStudy: vi.fn(() => {
      throw new TypeError("unexpected bug in mapper");
    }),
  };
});

// Import AFTER vi.mock so the router picks up the mocked mapper.
const { buildStudiesRouter } = await import("../../src/routes/studies.js");

describe("GET /api/studies — mapper throws a non-DicomMappingError", () => {
  it("re-throws the error so Hono surfaces it as 500 (defensive branch)", async () => {
    const app = buildStudiesRouter({
      orthanc: {
        searchStudies: vi.fn().mockResolvedValue([
          { "0020000D": { vr: "UI", Value: ["1.1"] } },
        ]),
      },
    });
    const res = await app.request("/");
    // Hono surfaces uncaught throws as 500 Internal Server Error.
    expect(res.status).toBe(500);
  });
});
