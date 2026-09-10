import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

interface ExceptionPayload {
  code?: unknown;
  message?: unknown;
  fields?: unknown;
  retryAfterSeconds?: unknown;
}

function requestIdFrom(request: Request): string {
  const candidate = request.header("x-request-id")?.trim();
  return candidate && /^[a-zA-Z0-9._:-]{1,128}$/.test(candidate)
    ? candidate
    : randomUUID();
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = requestIdFrom(request);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const rawPayload =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload: ExceptionPayload =
      typeof rawPayload === "object" && rawPayload !== null ? rawPayload : {};

    response.setHeader("x-request-id", requestId);
    const retryAfterSeconds =
      (status === 429 || status === 503) &&
      typeof payload.retryAfterSeconds === "number" &&
      Number.isSafeInteger(payload.retryAfterSeconds) &&
      payload.retryAfterSeconds > 0
        ? payload.retryAfterSeconds
        : status === 429
          ? 3600
          : undefined;
    if (retryAfterSeconds !== undefined) {
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.setHeader("Cache-Control", "private, no-store");
    }
    response.status(status).json({
      error: {
        code:
          typeof payload.code === "string"
            ? payload.code
            : status === HttpStatus.INTERNAL_SERVER_ERROR
              ? "INTERNAL_SERVER_ERROR"
              : "REQUEST_FAILED",
        message:
          typeof payload.message === "string"
            ? payload.message
            : status === HttpStatus.INTERNAL_SERVER_ERROR
              ? "The server could not complete the request."
              : "The request could not be completed.",
        requestId,
        fields: Array.isArray(payload.fields) ? payload.fields : null,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
    });
  }
}
