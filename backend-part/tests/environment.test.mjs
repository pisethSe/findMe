import assert from "node:assert/strict";
import test from "node:test";

import {
  getAppEnvironment,
  getAuthSecret,
  getDatabaseUrl,
  getGoogleMapsServerKey,
  getLogLevel,
  getObjectStorageConfig,
  getOpsMetricsToken,
  getRedisUrl,
  getTelegramNotificationsConfig,
  getTelegramSupportConfig,
  getWebOrigin,
  parseAccessTokenTtl,
  parseApiPort,
  parsePasswordResetTtlMinutes,
  parseRefreshTokenTtlDays,
  resolveLogLevel,
  resolveOpsMetricsToken,
  validateApplicationEnvironment,
  validateAuthEnvironment,
} from "../dist/config/environment.js";

test("uses safe local API configuration defaults", () => {
  assert.equal(parseApiPort(undefined), 3001);
  assert.equal(getWebOrigin(undefined), "http://localhost:3000");
});

test("accepts only explicit PostgreSQL database URLs", () => {
  assert.equal(
    getDatabaseUrl("postgresql://findme:secret@localhost:5432/findme"),
    "postgresql://findme:secret@localhost:5432/findme",
  );
  assert.throws(() => getDatabaseUrl(undefined), /DATABASE_URL/);
  assert.throws(() => getDatabaseUrl("redis://localhost:6379"), /postgres/i);
  assert.throws(() => getDatabaseUrl("not a url"), /DATABASE_URL/);
});

test("validates optional local and required deployed Redis URLs", () => {
  assert.equal(getRedisUrl(undefined, "local"), null);
  assert.equal(
    getRedisUrl("rediss://cache.example.test:6380", "production"),
    "rediss://cache.example.test:6380",
  );
  assert.throws(() => getRedisUrl(undefined, "production"), /REDIS_URL/);
  assert.throws(
    () => getRedisUrl("https://cache.example.test", "local"),
    /redis or rediss/,
  );
});

test("rejects malformed ports and browser origins", () => {
  assert.throws(() => parseApiPort("70000"), /PORT/);
  assert.throws(() => parseApiPort("not-a-number"), /PORT/);
  assert.throws(() => getWebOrigin("javascript:alert(1)"), /WEB_ORIGIN/);
  assert.throws(() => getWebOrigin("https://example.com/path"), /WEB_ORIGIN/);
});

test("validates authentication secrets and bounded token lifetimes", () => {
  assert.equal(getAppEnvironment(undefined), "local");
  assert.equal(parseAccessTokenTtl(undefined).seconds, 900);
  assert.equal(parseAccessTokenTtl("1h").seconds, 3600);
  assert.equal(parseRefreshTokenTtlDays(undefined), 30);
  assert.equal(parsePasswordResetTtlMinutes(undefined), 30);

  assert.throws(
    () => getAuthSecret("JWT_ACCESS_SECRET", "too-short"),
    /32 characters/,
  );
  assert.throws(() => parseAccessTokenTtl("2h"), /between 60 seconds/);
  assert.throws(() => getAppEnvironment("preview"), /APP_ENV/);
  assert.throws(
    () =>
      validateAuthEnvironment({
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "a".repeat(32),
      }),
    /must be different/,
  );
  assert.throws(
    () =>
      validateAuthEnvironment({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
        REDIS_URL: "rediss://cache.example.test:6380",
      }),
    /APP_ENV must be staging or production/,
  );
  assert.throws(
    () =>
      validateAuthEnvironment({
        NODE_ENV: "production",
        APP_ENV: "local",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
      }),
    /APP_ENV must be staging or production/,
  );
  assert.throws(
    () =>
      validateAuthEnvironment({
        NODE_ENV: "production",
        APP_ENV: "test",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
      }),
    /APP_ENV must be staging or production/,
  );
  assert.doesNotThrow(() =>
    validateAuthEnvironment({
      NODE_ENV: "production",
      APP_ENV: "staging",
      JWT_ACCESS_SECRET: "a".repeat(32),
      REFRESH_TOKEN_SECRET: "b".repeat(32),
    }),
  );
  assert.throws(
    () =>
      validateAuthEnvironment({
        NODE_ENV: "production",
        APP_ENV: "production",
        JWT_ACCESS_SECRET: "replace-with-a-long-production-secret-value",
        REFRESH_TOKEN_SECRET: "b".repeat(32),
      }),
    /Placeholder authentication secrets/,
  );
});

test("requires a safe server-only Google Maps key for deployed environments", () => {
  assert.equal(getGoogleMapsServerKey(undefined, "local"), null);
  assert.throws(
    () => getGoogleMapsServerKey(undefined, "production"),
    /GOOGLE_MAPS_SERVER_KEY is required/,
  );
  assert.throws(
    () => getGoogleMapsServerKey("replace-with-your-api-key", "staging"),
    /malformed or still a placeholder/,
  );
  assert.equal(
    getGoogleMapsServerKey(`AIza${"s".repeat(35)}`, "production"),
    `AIza${"s".repeat(35)}`,
  );
});

test("accepts complete object storage configuration and rejects partial deployment setup", () => {
  assert.equal(getObjectStorageConfig({}, "local"), null);
  assert.throws(
    () => getObjectStorageConfig({ S3_BUCKET: "findme-media" }, "local"),
    /incomplete/,
  );
  assert.throws(() => getObjectStorageConfig({}, "production"), /S3_REGION/);
  assert.deepEqual(
    getObjectStorageConfig(
      {
        S3_ENDPOINT: "https://storage.example.test",
        S3_REGION: "auto",
        S3_BUCKET: "findme-media",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        CDN_BASE_URL: "https://cdn.example.test/",
        S3_FORCE_PATH_STYLE: "true",
      },
      "production",
    ),
    {
      endpoint: "https://storage.example.test",
      region: "auto",
      bucket: "findme-media",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      cdnBaseUrl: "https://cdn.example.test",
      forcePathStyle: true,
    },
  );
});

test("validates Maps configuration as part of application startup", () => {
  assert.doesNotThrow(() =>
    validateApplicationEnvironment({
      APP_ENV: "production",
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(32),
      REFRESH_TOKEN_SECRET: "b".repeat(32),
      REDIS_URL: "rediss://cache.example.test:6380",
      GOOGLE_MAPS_SERVER_KEY: `AIza${"s".repeat(35)}`,
      S3_REGION: "auto",
      S3_BUCKET: "findme-media",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      CDN_BASE_URL: "https://cdn.example.test",
    }),
  );
  assert.throws(
    () =>
      validateApplicationEnvironment({
        APP_ENV: "production",
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
        REDIS_URL: "rediss://cache.example.test:6380",
      }),
    /GOOGLE_MAPS_SERVER_KEY is required/,
  );
});

test("validates the JSON request-log threshold", () => {
  assert.equal(getLogLevel(undefined, "local"), "warn");
  assert.equal(getLogLevel(undefined, "production"), "info");
  assert.equal(getLogLevel("DEBUG", "local"), "debug");
  assert.equal(getLogLevel("  error  ", "production"), "error");
  assert.throws(() => getLogLevel("verbose", "local"), /LOG_LEVEL/);

  assert.equal(resolveLogLevel(undefined, "test"), "warn");
  assert.equal(resolveLogLevel(undefined, "staging"), "info");
  assert.equal(resolveLogLevel("warn", "test"), "warn");
  assert.equal(resolveLogLevel("verbose", "test"), "warn");
  assert.equal(resolveLogLevel("verbose", undefined), "warn");
});

test("keeps the ops metrics surface disabled unless a strong token is configured", () => {
  assert.equal(getOpsMetricsToken(undefined), null);
  assert.equal(getOpsMetricsToken("   "), null);
  assert.throws(
    () => getOpsMetricsToken("too-short"),
    /OPS_METRICS_TOKEN must contain at least 32 characters/,
  );
  assert.equal(
    getOpsMetricsToken("ops-metrics-token-with-at-least-32-characters"),
    "ops-metrics-token-with-at-least-32-characters",
  );

  assert.equal(resolveOpsMetricsToken("too-short"), null);
  assert.equal(resolveOpsMetricsToken(undefined), null);
  assert.equal(
    resolveOpsMetricsToken("ops-metrics-token-with-at-least-32-characters"),
    "ops-metrics-token-with-at-least-32-characters",
  );

  assert.throws(
    () =>
      validateApplicationEnvironment({
        APP_ENV: "production",
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
        REDIS_URL: "rediss://cache.example.test:6380",
        GOOGLE_MAPS_SERVER_KEY: `AIza${"s".repeat(35)}`,
        S3_REGION: "auto",
        S3_BUCKET: "findme-media",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        CDN_BASE_URL: "https://cdn.example.test",
        OPS_METRICS_TOKEN: "short",
      }),
    /OPS_METRICS_TOKEN/,
  );
});

test("Telegram inquiry notifications stay optional and fail fast when partial", () => {
  assert.equal(getTelegramNotificationsConfig({}), null);
  assert.equal(
    getTelegramNotificationsConfig({ TELEGRAM_BOT_TOKEN: "  " }),
    null,
  );

  assert.throws(
    () =>
      getTelegramNotificationsConfig({ TELEGRAM_BOT_TOKEN: "x".repeat(50) }),
    /set together/,
  );
  assert.throws(
    () =>
      getTelegramNotificationsConfig({ TELEGRAM_INQUIRIES_CHAT_ID: "-100123" }),
    /set together/,
  );

  const token = `123456789:${"A".repeat(35)}`;
  assert.deepEqual(
    getTelegramNotificationsConfig({
      TELEGRAM_BOT_TOKEN: token,
      TELEGRAM_INQUIRIES_CHAT_ID: "-1001234567890",
    }),
    { botToken: token, inquiriesChatId: "-1001234567890" },
  );
  assert.equal(
    getTelegramNotificationsConfig({
      TELEGRAM_BOT_TOKEN: token,
      TELEGRAM_INQUIRIES_CHAT_ID: "@findme_inquiries",
    }).inquiriesChatId,
    "@findme_inquiries",
  );

  assert.throws(
    () =>
      getTelegramNotificationsConfig({
        TELEGRAM_BOT_TOKEN: "not-a-token",
        TELEGRAM_INQUIRIES_CHAT_ID: "-1001234567890",
      }),
    /TELEGRAM_BOT_TOKEN/,
  );
  assert.throws(
    () =>
      getTelegramNotificationsConfig({
        TELEGRAM_BOT_TOKEN: "replace-with-a-real-bot-token",
        TELEGRAM_INQUIRIES_CHAT_ID: "-1001234567890",
      }),
    /TELEGRAM_BOT_TOKEN/,
  );
  assert.throws(
    () =>
      getTelegramNotificationsConfig({
        TELEGRAM_BOT_TOKEN: token,
        TELEGRAM_INQUIRIES_CHAT_ID: "not a chat id",
      }),
    /TELEGRAM_INQUIRIES_CHAT_ID/,
  );

  assert.throws(
    () =>
      validateApplicationEnvironment({
        APP_ENV: "production",
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(32),
        REFRESH_TOKEN_SECRET: "b".repeat(32),
        REDIS_URL: "rediss://cache.example.test:6380",
        GOOGLE_MAPS_SERVER_KEY: `AIza${"s".repeat(35)}`,
        S3_REGION: "auto",
        S3_BUCKET: "findme-media",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
        CDN_BASE_URL: "https://cdn.example.test",
        TELEGRAM_BOT_TOKEN: token,
      }),
    /TELEGRAM_BOT_TOKEN and TELEGRAM_INQUIRIES_CHAT_ID/,
  );
});

test("the Telegram support bot stays disabled until an administrator is listed", () => {
  assert.equal(getTelegramSupportConfig({}, "local"), null);
  assert.equal(
    getTelegramSupportConfig({ TELEGRAM_SUPPORT_ADMIN_IDS: " , " }, "local"),
    null,
  );

  const token = `123456789:${"A".repeat(35)}`;
  assert.throws(
    () =>
      getTelegramSupportConfig(
        { TELEGRAM_SUPPORT_ADMIN_IDS: "1013974119" },
        "local",
      ),
    /TELEGRAM_BOT_TOKEN is required/,
  );
  assert.throws(
    () =>
      getTelegramSupportConfig(
        { TELEGRAM_WEBHOOK_SECRET: "s".repeat(20) },
        "local",
      ),
    /TELEGRAM_SUPPORT_ADMIN_IDS is required/,
  );
  assert.throws(
    () =>
      getTelegramSupportConfig({ TELEGRAM_SUPPORT_POLLING: "yes" }, "local"),
    /true or false/,
  );
  assert.throws(
    () =>
      getTelegramSupportConfig(
        { TELEGRAM_BOT_TOKEN: token, TELEGRAM_SUPPORT_ADMIN_IDS: "not-an-id" },
        "local",
      ),
    /numeric Telegram user ids/,
  );
  assert.throws(
    () =>
      getTelegramSupportConfig(
        {
          TELEGRAM_BOT_TOKEN: token,
          TELEGRAM_SUPPORT_ADMIN_IDS: "1013974119,1013974119",
        },
        "local",
      ),
    /must not repeat/,
  );
  assert.throws(
    () =>
      getTelegramSupportConfig(
        {
          TELEGRAM_BOT_TOKEN: token,
          TELEGRAM_SUPPORT_ADMIN_IDS: Array.from(
            { length: 11 },
            (_, index) => `101397411${index}`,
          ).join(","),
        },
        "local",
      ),
    /at most 10/,
  );

  const enabled = {
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_SUPPORT_ADMIN_IDS: " 1013974119 , 555000111 ",
  };
  assert.deepEqual(getTelegramSupportConfig(enabled, "local"), {
    botToken: token,
    adminUserIds: ["1013974119", "555000111"],
    webhookSecret: null,
    polling: false,
  });
  assert.equal(
    getTelegramSupportConfig(
      { ...enabled, TELEGRAM_SUPPORT_POLLING: "TRUE" },
      "local",
    ).polling,
    true,
  );

  // A bot owns one update cursor: deployed environments use the webhook only.
  assert.throws(
    () =>
      getTelegramSupportConfig(
        { ...enabled, TELEGRAM_SUPPORT_POLLING: "true" },
        "production",
      ),
    /must be false in staging and production/,
  );
  assert.throws(
    () => getTelegramSupportConfig(enabled, "production"),
    /TELEGRAM_WEBHOOK_SECRET is required/,
  );
  assert.throws(
    () =>
      getTelegramSupportConfig(
        { ...enabled, TELEGRAM_WEBHOOK_SECRET: "short" },
        "local",
      ),
    /TELEGRAM_WEBHOOK_SECRET must be/,
  );

  const deployed = getTelegramSupportConfig(
    { ...enabled, TELEGRAM_WEBHOOK_SECRET: "s".repeat(24) },
    "production",
  );
  assert.equal(deployed.webhookSecret, "s".repeat(24));
  assert.equal(deployed.polling, false);

  const productionEnvironment = {
    APP_ENV: "production",
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "a".repeat(32),
    REFRESH_TOKEN_SECRET: "b".repeat(32),
    REDIS_URL: "rediss://cache.example.test:6380",
    GOOGLE_MAPS_SERVER_KEY: `AIza${"s".repeat(35)}`,
    S3_REGION: "auto",
    S3_BUCKET: "findme-media",
    S3_ACCESS_KEY_ID: "access-key",
    S3_SECRET_ACCESS_KEY: "secret-key",
    CDN_BASE_URL: "https://cdn.example.test",
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_INQUIRIES_CHAT_ID: "-1001234567890",
    TELEGRAM_SUPPORT_ADMIN_IDS: "1013974119",
    TELEGRAM_WEBHOOK_SECRET: "s".repeat(24),
  };
  assert.doesNotThrow(() =>
    validateApplicationEnvironment(productionEnvironment),
  );
  assert.throws(
    () =>
      validateApplicationEnvironment({
        ...productionEnvironment,
        TELEGRAM_WEBHOOK_SECRET: "",
      }),
    /TELEGRAM_WEBHOOK_SECRET is required/,
  );
});
