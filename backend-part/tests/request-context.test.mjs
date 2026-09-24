import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, HttpException } from "@nestjs/common";

import { ApiExceptionFilter } from "../dist/common/http/api-exception.filter.js";
import {
  REQUEST_ID_HEADER,
  getRequestContext,
  getRequestId,
  normalizeRequestId,
  runWithRequestContext,
} from "../dist/common/observability/request-context.js";
import { requestContextMiddleware } from "../dist/common/observability/request-context.middleware.js";

const GENERATED_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function createRequest(id, method = "POST") {
  return {
    method,
    url: "/api/v1/example?access_token=should-never-be-logged",
    header: (name) =>
      name.toLowerCase() === REQUEST_ID_HEADER ? id : undefined,
  };
}

function createResponse() {
  const headers = new Map();
  const response = {
    headers,
    statusCode: 0,
    body: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
      return response;
    },
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(payload) {
      response.body = payload;
      return response;
    },
  };
  return response;
}

function argumentsHostFor(request, response) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };
}

test("request ids keep safe client values and replace everything else", () => {
  assert.equal(normalizeRequestId("trace-1.2:3_4"), "trace-1.2:3_4");
  assert.equal(normalizeRequestId("  trimmed-id  "), "trimmed-id");
  assert.match(normalizeRequestId(undefined), GENERATED_ID_PATTERN);
  assert.match(normalizeRequestId(""), GENERATED_ID_PATTERN);
  assert.match(normalizeRequestId("   "), GENERATED_ID_PATTERN);
  assert.match(normalizeRequestId("bad id with spaces"), GENERATED_ID_PATTERN);
  assert.match(normalizeRequestId("a".repeat(129)), GENERATED_ID_PATTERN);
  assert.notEqual(normalizeRequestId(undefined), normalizeRequestId(undefined));
});

test("middleware publishes the correlation id to the response and the handler", () => {
  const request = createRequest("client-trace-id");
  const response = createResponse();
  let observed;

  requestContextMiddleware(request, response, () => {
    observed = getRequestContext();
  });

  assert.equal(response.headers.get(REQUEST_ID_HEADER), "client-trace-id");
  assert.deepEqual(observed, {
    requestId: "client-trace-id",
    method: "POST",
  });
  assert.equal(getRequestId(), undefined);
});

test("middleware replaces an unsafe client id before it is echoed back", () => {
  const response = createResponse();
  let observed;

  requestContextMiddleware(
    createRequest("<script>alert(1)</script>"),
    response,
    () => {
      observed = getRequestId();
    },
  );

  assert.match(observed, GENERATED_ID_PATTERN);
  assert.equal(response.headers.get(REQUEST_ID_HEADER), observed);
});

test("middleware propagates the context through asynchronous request work", async () => {
  let observed;

  await new Promise((resolve) => {
    requestContextMiddleware(
      createRequest("async-trace-id"),
      createResponse(),
      () => {
        void Promise.resolve().then(() => {
          observed = getRequestId();
          resolve();
        });
      },
    );
  });

  assert.equal(observed, "async-trace-id");
});

test("sequential requests never share a correlation id", () => {
  requestContextMiddleware(createRequest("first-id"), createResponse(), () => {
    assert.equal(getRequestId(), "first-id");
  });
  assert.equal(getRequestId(), undefined);

  runWithRequestContext({ requestId: "second-id", method: "GET" }, () => {
    assert.equal(getRequestId(), "second-id");
  });
  assert.equal(getRequestId(), undefined);
});

test("the error payload reuses the middleware correlation id", () => {
  const request = createRequest("client-trace-id");
  const response = createResponse();
  const filter = new ApiExceptionFilter();

  requestContextMiddleware(request, response, () => {
    filter.catch(
      new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "One or more request fields are invalid.",
      }),
      argumentsHostFor(request, response),
    );
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.headers.get(REQUEST_ID_HEADER), "client-trace-id");
  assert.equal(response.body.error.requestId, "client-trace-id");
  assert.equal(response.body.error.code, "VALIDATION_FAILED");
});

test("the error payload falls back to the request header without middleware", () => {
  const request = createRequest("header-only-id");
  const response = createResponse();

  new ApiExceptionFilter().catch(
    new HttpException("Nope", 403),
    argumentsHostFor(request, response),
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.headers.get(REQUEST_ID_HEADER), "header-only-id");
  assert.equal(response.body.error.requestId, "header-only-id");
  assert.equal(response.body.error.code, "REQUEST_FAILED");
});

test("unexpected failures never expose the thrown message or secrets", () => {
  const request = createRequest(undefined);
  const response = createResponse();

  new ApiExceptionFilter().catch(
    new Error("password comparison failed for student@example.com"),
    argumentsHostFor(request, response),
  );

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error.code, "INTERNAL_SERVER_ERROR");
  assert.equal(
    response.body.error.message,
    "The server could not complete the request.",
  );
  assert.doesNotMatch(
    JSON.stringify(response.body),
    /password|student@example\.com|should-never-be-logged/,
  );
  assert.match(response.body.error.requestId, GENERATED_ID_PATTERN);
  assert.equal(
    response.headers.get(REQUEST_ID_HEADER),
    response.body.error.requestId,
  );
});
