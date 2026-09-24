import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";

import { requestContextMiddleware } from "../dist/common/observability/request-context.middleware.js";
import { requestLogMiddleware } from "../dist/common/observability/request-log.middleware.js";

const EXPECTED_FIELDS = [
  "durationMs",
  "event",
  "level",
  "method",
  "requestId",
  "route",
  "status",
  "time",
];

function captureStdout() {
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };

  return {
    lines: () =>
      written
        .join("")
        .split("\n")
        .filter((line) => line.includes('"event":"http_request"'))
        .map((line) => JSON.parse(line)),
    restore: () => {
      process.stdout.write = original;
    },
  };
}

function createRequest({
  method = "GET",
  url = "/api/v1/health/live",
  baseUrl = "",
  route,
  headers = {},
} = {}) {
  return {
    method,
    url,
    baseUrl,
    route,
    headers,
    header: (name) => headers[name.toLowerCase()],
  };
}

function createResponse(statusCode) {
  const listeners = new Map();
  const response = {
    statusCode,
    headers: new Map(),
    setHeader(name, value) {
      response.headers.set(name.toLowerCase(), value);
      return response;
    },
    on(event, listener) {
      listeners.set(event, listener);
      return response;
    },
    finish() {
      listeners.get("finish")?.();
    },
  };
  return response;
}

async function loggedLines({
  request,
  statusCode,
  level,
  appEnvironment = "test",
}) {
  const capture = captureStdout();
  const previousLevel = process.env.LOG_LEVEL;
  const previousEnvironment = process.env.APP_ENV;
  process.env.APP_ENV = appEnvironment;
  if (level === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = level;

  try {
    const response = createResponse(statusCode);
    await new Promise((resolve) => {
      requestContextMiddleware(request, response, () =>
        requestLogMiddleware(request, response, resolve),
      );
    });
    response.finish();
    return capture.lines();
  } finally {
    capture.restore();
    if (previousLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previousLevel;
    if (previousEnvironment === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousEnvironment;
  }
}

test("logs one allow-listed JSON line per completed request", async () => {
  const lines = await loggedLines({
    request: createRequest({
      baseUrl: "/api/v1/health",
      route: { path: "/live" },
      headers: { "x-request-id": "log-trace-id" },
    }),
    statusCode: 200,
    level: "info",
  });

  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.equal(line.event, "http_request");
  assert.equal(line.level, "info");
  assert.equal(line.method, "GET");
  assert.equal(line.route, "/api/v1/health/live");
  assert.equal(line.status, 200);
  assert.equal(line.requestId, "log-trace-id");
  assert.equal(typeof line.durationMs, "number");
  assert.ok(line.durationMs >= 0);
  assert.match(line.time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(Object.keys(line).sort(), EXPECTED_FIELDS);
});

test("unmatched requests and failures collapse to bounded route labels", async () => {
  const unmatched = await loggedLines({
    request: createRequest({ url: "/api/v1/not-a-route", route: undefined }),
    statusCode: 404,
    level: "info",
  });
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].route, "unmatched");
  assert.equal(unmatched[0].level, "warn");

  const failed = await loggedLines({
    request: createRequest({
      baseUrl: "/api/v1/listings",
      route: { path: "/:slug" },
    }),
    statusCode: 500,
    level: "info",
  });
  assert.equal(failed.length, 1);
  assert.equal(failed[0].route, "/api/v1/listings/:slug");
  assert.equal(failed[0].level, "error");
});

test("the configured threshold suppresses lower-severity lines", async () => {
  const success = await loggedLines({
    request: createRequest(),
    statusCode: 200,
    level: "error",
  });
  assert.equal(success.length, 0);

  const failure = await loggedLines({
    request: createRequest(),
    statusCode: 503,
    level: "error",
  });
  assert.equal(failure.length, 1);
  assert.equal(failure[0].level, "error");
});

test("request content never reaches the log", async () => {
  const lines = await loggedLines({
    request: createRequest({
      url: "/api/v1/auth/login?access_token=super-secret-token&email=student@example.com",
      baseUrl: "/api/v1/auth",
      route: { path: "/login" },
      headers: {
        authorization: "Bearer super-secret-token",
        cookie: "findme_refresh=super-secret-token",
        "x-request-id": "trace-1",
      },
    }),
    statusCode: 200,
    level: "info",
  });

  assert.equal(lines.length, 1);
  const raw = JSON.stringify(lines);
  assert.doesNotMatch(
    raw,
    /super-secret-token|access_token|student@example\.com|Bearer|findme_refresh/,
  );
});

test("an invalid threshold falls back to the environment default", async () => {
  const localSuccess = await loggedLines({
    request: createRequest(),
    statusCode: 200,
    level: "verbose",
    appEnvironment: "test",
  });
  assert.equal(localSuccess.length, 0);

  const deployedSuccess = await loggedLines({
    request: createRequest(),
    statusCode: 200,
    level: "verbose",
    appEnvironment: "production",
  });
  assert.equal(deployedSuccess.length, 1);
  assert.equal(deployedSuccess[0].level, "info");
});
