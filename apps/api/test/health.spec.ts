import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

const testEnv = {
  NODE_ENV: "test",
  PORT: "4001",
  API_BASE_URL: "http://localhost:4000",
  ADMIN_WEB_URL: "http://localhost:3000",
  SITE_RENDERER_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://stackbuilder:stackbuilder@localhost:5432/stackbuilder?schema=public",
  OBJECT_STORAGE_DRIVER: "local",
  OBJECT_STORAGE_BUCKET: "stackbuilder-local",
  SESSION_SECRET: "a-secret-with-at-least-thirty-two-chars",
  SESSION_COOKIE_NAME: "stackbuilder_session",
  SESSION_TTL_DAYS: "7",
};

describe("Health endpoint", () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, testEnv);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns dependency health without exposing secrets", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);

    expect(response.body).toMatchObject({
      service: "api",
      dependencies: {
        database: expect.any(String),
        objectStorage: expect.any(String),
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("stackbuilder:stackbuilder");
    expect(JSON.stringify(response.body)).not.toContain("local-dev-master-key");
  });
});
