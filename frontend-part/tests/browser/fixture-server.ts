// Test-only HTTP responses also serve the server-rendered rental detail route.
// These fixtures are never imported by application code.
import { createServer } from "node:http";

import { institution, rental, searchPage } from "./fixtures.ts";

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3102");
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (url.pathname === "/api/v1/auth/refresh") {
    response.statusCode = 401;
    response.end(
      JSON.stringify({
        error: { code: "SESSION_REQUIRED", message: "Sign in to continue." },
      }),
    );
    return;
  }
  if (url.pathname === "/health") {
    response.end(JSON.stringify({ status: "ready" }));
    return;
  }
  if (url.pathname === "/api/v1/institutions") {
    response.end(
      JSON.stringify({
        data: [institution],
        meta: {
          count: 1,
          query: url.searchParams.get("query"),
          selectedSlug: url.searchParams.get("slug"),
          limit: Number(url.searchParams.get("limit") ?? 20),
        },
      }),
    );
    return;
  }
  if (url.pathname === "/api/v1/listings/search") {
    if (url.searchParams.get("maxPrice") === "2") {
      response.statusCode = 503;
      response.end(
        JSON.stringify({
          error: {
            code: "PUBLIC_SEARCH_FAILED",
            message:
              "Rental search is temporarily unavailable. Please try again.",
          },
        }),
      );
    } else response.end(JSON.stringify(searchPage(url.searchParams)));
    return;
  }
  if (url.pathname === `/api/v1/listings/${rental.slug}`) {
    response.end(JSON.stringify({ data: rental }));
    return;
  }
  response.statusCode = 404;
  response.end(
    JSON.stringify({
      error: { code: "LISTING_NOT_FOUND", message: "Rental unavailable." },
    }),
  );
});

server.listen(3102, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
