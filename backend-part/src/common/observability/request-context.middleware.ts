import type { NextFunction, Request, Response } from "express";

import {
  REQUEST_ID_HEADER,
  normalizeRequestId,
  runWithRequestContext,
} from "./request-context.js";

/**
 * Registers the correlation id before routing so successful responses and
 * error responses always share one value.
 */
export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = normalizeRequestId(request.header(REQUEST_ID_HEADER));
  response.setHeader(REQUEST_ID_HEADER, requestId);
  runWithRequestContext({ requestId, method: request.method }, () => next());
}
