// A CI run must not silently skip the database or Redis integration suites.
// Do not load .env: the caller must explicitly select disposable test services.
const required = {
  TEST_DATABASE_URL: ["postgres:", "postgresql:"],
  TEST_REDIS_URL: ["redis:", "rediss:"],
};

for (const [name, protocols] of Object.entries(required)) {
  let valid = false;
  try {
    const url = new URL(process.env[name] ?? "");
    valid = protocols.includes(url.protocol) && Boolean(url.hostname);
  } catch {
    // Report the variable name only; URLs may contain credentials.
  }
  if (!valid) {
    console.error(
      `${name} must explicitly identify a disposable test service. See docs/TESTING.md.`,
    );
    process.exitCode = 1;
  }
}
