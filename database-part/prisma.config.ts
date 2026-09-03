import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnvironment({
  path: new URL("../.env", import.meta.url).pathname,
  quiet: true,
});

const nonRoutableBuildUrl =
  "postgresql://configuration-required:configuration-required@127.0.0.1:1/findme";
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL?.trim();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Client generation and schema validation do not need a live database. The
    // fail-closed placeholder lets those build steps run, while migrate/seed
    // still cannot reach a database unless the direct URL is explicitly set.
    url: process.env.DATABASE_URL_UNPOOLED?.trim() || nonRoutableBuildUrl,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
