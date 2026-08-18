import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";
import { z } from "zod";

let localEnvLoaded = false;
const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);
const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().email().optional(),
);

function loadLocalEnvFile(): void {
  if (localEnvLoaded || process.env.NODE_ENV === "test") {
    return;
  }

  localEnvLoaded = true;
  const envPath = findLocalEnvFile(process.cwd());

  if (envPath) {
    loadEnvFile(envPath);
  }
}

function findLocalEnvFile(startDirectory: string): string | null {
  let currentDirectory = startDirectory;

  for (let depth = 0; depth < 5; depth += 1) {
    const envPath = join(currentDirectory, ".env");

    if (existsSync(envPath)) {
      return envPath;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }

  return null;
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    API_BASE_URL: z.string().url().default("http://localhost:4000"),
    ADMIN_WEB_URL: z.string().url().default("http://localhost:3000"),
    SITE_RENDERER_URL: z.string().url().default("http://localhost:3001"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    OBJECT_STORAGE_DRIVER: z.enum(["gcs", "local"]).default("gcs"),
    OBJECT_STORAGE_BUCKET: z.string().min(1),
    OBJECT_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(900)
      .default(300),
    GCS_PROJECT_ID: optionalNonEmptyString,
    GCS_CLIENT_EMAIL: optionalEmail,
    GCS_PRIVATE_KEY: optionalNonEmptyString,
    GCS_CREDENTIALS_FILE: optionalNonEmptyString,
    LOCAL_SIGNED_UPLOAD_BASE_URL: z.string().url().default("http://localhost:4000/dev/storage"),
    MEDIA_UPLOAD_MAX_IMAGE_BYTES: z.coerce.number().int().positive().max(25_000_000).default(10_000_000),
    MEDIA_UPLOAD_MAX_FILE_BYTES: z.coerce.number().int().positive().max(50_000_000).default(20_000_000),
    MEDIA_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().max(50_000_000).default(20_000_000),
    MEDIA_UPLOAD_ALLOWED_MIME_TYPES: z
      .string()
      .min(1)
      .default("image/jpeg,image/png,image/webp,image/gif,application/pdf"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    SESSION_COOKIE_NAME: z.string().min(1).default("stackbuilder_session"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  })
  .superRefine((value, context) => {
    if (
      value.OBJECT_STORAGE_DRIVER === "gcs" &&
      !value.GCS_CREDENTIALS_FILE &&
      (!value.GCS_CLIENT_EMAIL || !value.GCS_PRIVATE_KEY)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "GCS_CREDENTIALS_FILE or both GCS_CLIENT_EMAIL and GCS_PRIVATE_KEY are required when OBJECT_STORAGE_DRIVER=gcs",
        path: ["OBJECT_STORAGE_DRIVER"],
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  loadLocalEnvFile();
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}

export function redactConfig(
  config: AppConfig,
): Omit<AppConfig, "DATABASE_URL" | "GCS_PRIVATE_KEY" | "SESSION_SECRET"> {
  const {
    DATABASE_URL: _databaseUrl,
    GCS_PRIVATE_KEY: _gcsPrivateKey,
    SESSION_SECRET: _sessionSecret,
    ...safeConfig
  } = config;

  return safeConfig;
}
