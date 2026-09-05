import { config as loadEnvironment } from "dotenv";
import { fileURLToPath } from "node:url";

loadEnvironment({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const DEFAULT_API_PORT = 3001;
const DEFAULT_ACCESS_TOKEN_TTL = "15m";
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 30;
const MINIMUM_SECRET_LENGTH = 32;

export type AppEnvironment = "local" | "test" | "staging" | "production";

export interface ObjectStorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  cdnBaseUrl: string;
  forcePathStyle: boolean;
}

export function getDatabaseUrl(value: string | undefined): string {
  const databaseUrl = value?.trim();
  if (!databaseUrl) {
    throw new TypeError("DATABASE_URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new TypeError(
      "DATABASE_URL must be a valid PostgreSQL connection URL.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new TypeError(
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }

  return databaseUrl;
}

export function parseApiPort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_API_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

export function getWebOrigin(value: string | undefined): string {
  const origin = value?.trim() || "http://localhost:3000";

  try {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      !["http:", "https:"].includes(parsed.protocol)
    ) {
      throw new Error("invalid origin");
    }
  } catch {
    throw new TypeError("WEB_ORIGIN must be an absolute HTTP or HTTPS origin.");
  }

  return origin;
}

export function getRedisUrl(
  value: string | undefined,
  appEnvironment: AppEnvironment,
): string | null {
  const redisUrl = value?.trim() ?? "";
  if (!redisUrl) {
    if (["staging", "production"].includes(appEnvironment)) {
      throw new TypeError("REDIS_URL is required in staging and production.");
    }
    return null;
  }

  try {
    const parsed = new URL(redisUrl);
    if (!["redis:", "rediss:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new TypeError("REDIS_URL must be a valid redis or rediss URL.");
  }

  return redisUrl;
}

export function getAppEnvironment(value: string | undefined): AppEnvironment {
  const environment = value?.trim() || "local";
  if (!["local", "test", "staging", "production"].includes(environment)) {
    throw new TypeError(
      "APP_ENV must be one of local, test, staging, or production.",
    );
  }

  return environment as AppEnvironment;
}

export function getAuthSecret(
  name: "JWT_ACCESS_SECRET" | "REFRESH_TOKEN_SECRET",
  value: string | undefined,
): string {
  const secret = value?.trim();
  if (!secret || secret.length < MINIMUM_SECRET_LENGTH) {
    throw new TypeError(`${name} must contain at least 32 characters.`);
  }

  return secret;
}

export function parseAccessTokenTtl(value: string | undefined): {
  label: string;
  seconds: number;
} {
  const label = value?.trim() || DEFAULT_ACCESS_TOKEN_TTL;
  const match = /^(\d+)(s|m|h)$/.exec(label);
  if (!match) {
    throw new TypeError(
      "JWT_ACCESS_TTL must be a positive duration such as 900s, 15m, or 1h.",
    );
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "h" ? 3600 : unit === "m" ? 60 : 1;
  const seconds = amount * multiplier;

  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 3600) {
    throw new RangeError(
      "JWT_ACCESS_TTL must resolve to between 60 seconds and 1 hour.",
    );
  }

  return { label, seconds };
}

function parsePositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed =
    value === undefined || value.trim() === "" ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new RangeError(
      `${name} must be an integer between 1 and ${maximum}.`,
    );
  }

  return parsed;
}

export function parseRefreshTokenTtlDays(value: string | undefined): number {
  return parsePositiveInteger(
    "REFRESH_TOKEN_TTL_DAYS",
    value,
    DEFAULT_REFRESH_TOKEN_TTL_DAYS,
    90,
  );
}

export function parsePasswordResetTtlMinutes(
  value: string | undefined,
): number {
  return parsePositiveInteger(
    "PASSWORD_RESET_TTL_MINUTES",
    value,
    DEFAULT_PASSWORD_RESET_TTL_MINUTES,
    120,
  );
}

export function validateAuthEnvironment(environment = process.env): void {
  if (
    environment.NODE_ENV === "production" &&
    (!environment.APP_ENV || environment.APP_ENV.trim() === "")
  ) {
    throw new TypeError(
      "APP_ENV must be explicit when NODE_ENV is production.",
    );
  }

  const accessSecret = getAuthSecret(
    "JWT_ACCESS_SECRET",
    environment.JWT_ACCESS_SECRET,
  );
  const refreshSecret = getAuthSecret(
    "REFRESH_TOKEN_SECRET",
    environment.REFRESH_TOKEN_SECRET,
  );

  if (accessSecret === refreshSecret) {
    throw new TypeError(
      "JWT_ACCESS_SECRET and REFRESH_TOKEN_SECRET must be different.",
    );
  }

  const appEnvironment = getAppEnvironment(environment.APP_ENV);
  if (
    ["staging", "production"].includes(appEnvironment) &&
    [accessSecret, refreshSecret].some((secret) =>
      /replace-with|change-before-deploying/i.test(secret),
    )
  ) {
    throw new TypeError(
      "Placeholder authentication secrets are not allowed outside local development.",
    );
  }
  parseAccessTokenTtl(environment.JWT_ACCESS_TTL);
  parseRefreshTokenTtlDays(environment.REFRESH_TOKEN_TTL_DAYS);
  parsePasswordResetTtlMinutes(environment.PASSWORD_RESET_TTL_MINUTES);
}

export function getGoogleMapsServerKey(
  value: string | undefined,
  appEnvironment: AppEnvironment,
): string | null {
  const key = value?.trim() ?? "";
  if (!key) {
    if (["staging", "production"].includes(appEnvironment)) {
      throw new TypeError(
        "GOOGLE_MAPS_SERVER_KEY is required in staging and production.",
      );
    }
    return null;
  }

  if (
    key.length < 20 ||
    !/^[A-Za-z0-9_-]+$/.test(key) ||
    /replace-with|change-before|your[-_ ]?(api[-_ ]?)?key/i.test(key)
  ) {
    throw new TypeError(
      "GOOGLE_MAPS_SERVER_KEY is malformed or still a placeholder.",
    );
  }

  return key;
}

export function getObjectStorageConfig(
  environment: NodeJS.ProcessEnv,
  appEnvironment: AppEnvironment,
): ObjectStorageConfig | null {
  const values = {
    endpoint: environment.S3_ENDPOINT?.trim() ?? "",
    region: environment.S3_REGION?.trim() ?? "",
    bucket: environment.S3_BUCKET?.trim() ?? "",
    accessKeyId: environment.S3_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: environment.S3_SECRET_ACCESS_KEY?.trim() ?? "",
    cdnBaseUrl: environment.CDN_BASE_URL?.trim().replace(/\/$/, "") ?? "",
  };
  const required = [
    values.region,
    values.bucket,
    values.accessKeyId,
    values.secretAccessKey,
    values.cdnBaseUrl,
  ];
  const configuredCount = required.filter(Boolean).length;

  if (configuredCount === 0) {
    if (["staging", "production"].includes(appEnvironment)) {
      throw new TypeError(
        "S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and CDN_BASE_URL are required in staging and production.",
      );
    }
    return null;
  }
  if (configuredCount !== required.length) {
    throw new TypeError(
      "Object storage configuration is incomplete. Set S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and CDN_BASE_URL together.",
    );
  }

  if (values.endpoint) assertHttpUrl("S3_ENDPOINT", values.endpoint);
  assertHttpUrl("CDN_BASE_URL", values.cdnBaseUrl);

  const forcePathStyleValue = environment.S3_FORCE_PATH_STYLE?.trim();
  if (
    forcePathStyleValue &&
    !["true", "false"].includes(forcePathStyleValue.toLowerCase())
  ) {
    throw new TypeError("S3_FORCE_PATH_STYLE must be true or false.");
  }

  return {
    ...(values.endpoint ? { endpoint: values.endpoint } : {}),
    region: values.region,
    bucket: values.bucket,
    accessKeyId: values.accessKeyId,
    secretAccessKey: values.secretAccessKey,
    cdnBaseUrl: values.cdnBaseUrl,
    forcePathStyle: forcePathStyleValue?.toLowerCase() === "true",
  };
}

function assertHttpUrl(name: string, value: string): void {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new TypeError(`${name} must be an absolute HTTP or HTTPS URL.`);
  }
}

export function validateApplicationEnvironment(
  environment = process.env,
): void {
  validateAuthEnvironment(environment);
  const appEnvironment = getAppEnvironment(environment.APP_ENV);
  getRedisUrl(environment.REDIS_URL, appEnvironment);
  getGoogleMapsServerKey(environment.GOOGLE_MAPS_SERVER_KEY, appEnvironment);
  getObjectStorageConfig(environment, appEnvironment);
}
