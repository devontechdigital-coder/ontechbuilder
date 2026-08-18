import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: "4001",
  API_BASE_URL: "http://localhost:4000",
  ADMIN_WEB_URL: "http://localhost:3000",
  SITE_RENDERER_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://postgres:9876543210@localhost:5432/stackbuilder?schema=public",
  OBJECT_STORAGE_DRIVER: "local",
  OBJECT_STORAGE_BUCKET: "stackbuilder-local",
  SESSION_SECRET: "a-secret-with-at-least-thirty-two-chars",
  SESSION_COOKIE_NAME: "stackbuilder_session",
  SESSION_TTL_DAYS: "7",
};

describe("AppModule", () => {
  beforeAll(() => {
    Object.assign(process.env, testEnv);
  });

  it("starts the Nest application context", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    expect(app).toBeDefined();

    await app.close();
  });
});
