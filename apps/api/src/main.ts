import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createServer } from "node:net";
import { AppModule } from "./app.module.js";
import { DevelopmentExceptionFilter } from "./core/common/filters/development-exception.filter.js";
import { APP_CONFIG } from "./core/config/config.provider.js";
import { PrismaService } from "./core/database/prisma.service.js";
import { ObjectStorageHealthService } from "./core/storage/object-storage-health.service.js";

async function bootstrap() {
  console.log("[api] Starting NestJS API...");
  const app = await NestFactory.create(AppModule);
  const config = app.get(APP_CONFIG);
  const logger = new Logger("Startup");

  app.enableCors({
    origin: [config.ADMIN_WEB_URL, config.SITE_RENDERER_URL],
    credentials: true,
  });

  if (config.NODE_ENV === "development") {
    app.useGlobalFilters(new DevelopmentExceptionFilter());
  }

  const port = await findAvailablePort(config.PORT);

  if (port !== config.PORT) {
    console.warn(`[api] Port ${config.PORT} is busy. Using ${port} instead.`);
  }

  await app.listen(port);
  console.log(`[api] API listening on http://localhost:${port}`);
  logger.log(`API listening on http://localhost:${port}`);
  await logDependencyStatus(app, logger);
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port <= startPort + 5; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available API port found from ${startPort} to ${startPort + 5}`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        server.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function logDependencyStatus(app: Awaited<ReturnType<typeof NestFactory.create>>, logger: Logger) {
  const checks: Array<[string, () => Promise<boolean>]> = [
    ["Database", () => app.get(PrismaService).healthCheck()],
    ["Object storage", () => app.get(ObjectStorageHealthService).healthCheck()],
  ];

  for (const [name, check] of checks) {
    try {
      const isConnected = await check();
      console.log(`[api] ${name}: ${isConnected ? "connected" : "not connected"}`);
      logger[isConnected ? "log" : "warn"](`${name}: ${isConnected ? "connected" : "not connected"}`);
    } catch {
      console.log(`[api] ${name}: not connected`);
      logger.warn(`${name}: not connected`);
    }
  }
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`[api] Startup failed: ${message}`);
  process.exitCode = 1;
});
