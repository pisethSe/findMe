import type { Request } from "express";

interface MatchedRoute {
  path?: unknown;
}

/**
 * Bounded-cardinality route label shared by request logs and metrics.
 * Parameterized segments stay as templates (for example
 * `/api/v1/listings/:slug`) and requests that never matched a route collapse to
 * `unmatched`, so arbitrary URLs cannot explode log or metric cardinality.
 */
export function routeTemplateFor(request: Request): string {
  const matchedPath = (request as Request & { route?: MatchedRoute }).route
    ?.path;
  if (typeof matchedPath !== "string" || matchedPath.length === 0) {
    return "unmatched";
  }

  return `${request.baseUrl ?? ""}${matchedPath}`;
}
