import { resolveLogLevel, type LogLevel } from "../../config/environment.js";

export type { LogLevel };

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogRecord {
  time: string;
  level: LogLevel;
  event: string;
  [field: string]: unknown;
}

export function currentLogLevel(): LogLevel {
  return resolveLogLevel(process.env.LOG_LEVEL, process.env.APP_ENV);
}

export function logLevelEnabled(
  level: LogLevel,
  threshold: LogLevel = currentLogLevel(),
): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[threshold];
}

/**
 * Writes one JSON line per record to stdout. Records are flat and assembled
 * from an allow-list of fields, so request content never reaches the log and a
 * deployment can parse a stable schema.
 */
export function writeLogRecord(record: LogRecord): void {
  const line = `${JSON.stringify(record)}\n`;

  try {
    process.stdout.write(line);
  } catch (error) {
    // Logging must never fail a completed request, and a silent catch would
    // hide a broken log pipeline, so report it through the process instead.
    process.emitWarning(
      error instanceof Error
        ? error.message
        : "The log record could not be written.",
      { code: "FINDME_LOG_WRITE_FAILED" },
    );
  }
}
