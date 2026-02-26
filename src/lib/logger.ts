import { IS_PROD } from "../config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const output = IS_PROD ? JSON.stringify(entry) : formatDev(entry);

  if (level === "error" || level === "warn") {
    console.error(output);
  } else {
    process.stdout.write(`${output}\n`);
  }
}

function formatDev(entry: LogEntry): string {
  const { level, message, timestamp, ...rest } = entry;
  const prefix = {
    debug: "🔍",
    info: "ℹ️ ",
    warn: "⚠️ ",
    error: "❌",
  }[level];
  const suffix = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  return `${prefix} [${timestamp}] ${message}${suffix}`;
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
