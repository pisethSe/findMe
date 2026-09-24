import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Correlation id shared by the success and error paths. A client may supply a
 * value for log correlation only; it is never used for authorization.
 */
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

export interface RequestContext {
  requestId: string;
  method: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Accepts a client-supplied correlation id only when it is a short,
 * log-safe token. Anything else is replaced with a generated id.
 */
export function normalizeRequestId(value: string | undefined): string {
  const candidate = value?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}

export function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => T,
): T {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
