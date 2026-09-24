import type { NextFunction, Request, Response } from "express";

import { routeTemplateFor } from "./http-route.js";
import {
  logLevelEnabled,
  writeLogRecord,
  type LogLevel,
} from "./log-record.js";
import { getRequestId } from "./request-context.js";

function levelForStatus(status: number): LogLevel {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
}

/**
 * Emits one JSON line per completed response. This is middleware rather than an
 * interceptor so guard rejections (401/403/429) and unmatched routes are logged
 * too, and it emits only allow-listed fields: no URL, query string, headers,
 * cookies, or request bodies.
 */
export function requestLogMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();
  const requestId = getRequestId();

  response.on("finish", () => {
    const status = response.statusCode;
    const level = levelForStatus(status);
    if (!logLevelEnabled(level)) return;

    writeLogRecord({
      time: new Date().toISOString(),
      level,
      event: "http_request",
      ...(requestId ? { requestId } : {}),
      method: request.method,
      route: routeTemplateFor(request),
      status,
      durationMs:
        Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10,
    });
  });

  next();
}
