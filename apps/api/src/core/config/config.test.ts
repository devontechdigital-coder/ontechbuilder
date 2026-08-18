import { describe, expect, it } from "vitest";
import { loadConfig, redactConfig } from "./config.js";

const validEnv = {
  NODE_ENV: "test",
  PORT: "4000",
  API_BASE_URL: "http://localhost:4000",
  ADMIN_WEB_URL: "http://localhost:3000",
  SITE_RENDERER_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  OBJECT_STORAGE_DRIVER: "gcs",
  OBJECT_STORAGE_BUCKET: "stackbuilder-dev",
  GCS_PROJECT_ID: "stackbuilder-dev",
  GCS_CLIENT_EMAIL: "storage-signer@example.iam.gserviceaccount.com",
  GCS_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nlocal-dev\\n-----END PRIVATE KEY-----\\n",
  MEDIA_UPLOAD_MAX_IMAGE_BYTES: "10000000",
  MEDIA_UPLOAD_MAX_FILE_BYTES: "20000000",
  MEDIA_UPLOAD_MAX_BYTES: "20000000",
  MEDIA_UPLOAD_ALLOWED_MIME_TYPES: "image/jpeg,image/png",
  SESSION_SECRET: "a-secret-with-at-least-thirty-two-chars",
  SESSION_COOKIE_NAME: "stackbuilder_session",
  SESSION_TTL_DAYS: "7",
};

describe("loadConfig", () => {
  it("validates required environment variables", () => {
    expect(loadConfig(validEnv)).toMatchObject({
      NODE_ENV: "test",
      PORT: 4000,
      OBJECT_STORAGE_DRIVER: "gcs",
    });
  });

  it("fails clearly when required configuration is missing", () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: "" })).toThrow(
      /Invalid environment configuration/,
    );
  });
});

describe("redactConfig", () => {
  it("removes secrets from health-safe config output", () => {
    const safe = redactConfig(loadConfig(validEnv));

    expect(safe).not.toHaveProperty("DATABASE_URL");
    expect(safe).not.toHaveProperty("GCS_PRIVATE_KEY");
    expect(safe).not.toHaveProperty("SESSION_SECRET");
  });
});
