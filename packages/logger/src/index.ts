import pino from "pino";

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    redact: ["DATABASE_URL", "OBJECT_STORAGE_SECRET_ACCESS_KEY", "SESSION_SECRET"],
  });
}
