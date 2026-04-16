import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { OrthancDicomWebError } from "../services/orthanc-client.js";

export function respondOrthancError(c: Context, error: unknown, tag: string): Response | null {
  if (!(error instanceof OrthancDicomWebError)) return null;
  const status: ContentfulStatusCode = error.status === 404 ? 404 : 502;
  return c.json(
    { error: tag, status: error.status, operation: error.operation },
    status,
  );
}
