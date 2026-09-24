import type { NextFunction, Request, Response } from "express";

import { routeTemplateFor } from "./http-route.js";
import { MetricsService } from "./metrics.service.js";

/**
 * Records latency and status-class counters for every completed response,
 * including guard rejections and unmatched routes. Labels stay bounded because
 * `routeTemplateFor` returns a route template or `unmatched`.
 */
export function createRequestMetricsMiddleware(metrics: MetricsService) {
  return function requestMetricsMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
  ): void {
    const startedAt = process.hrtime.bigint();

    response.on("finish", () => {
      metrics.recordHttpRequest({
        method: request.method,
        route: routeTemplateFor(request),
        status: response.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      });
    });

    next();
  };
}
