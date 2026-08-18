import { Controller, Get, Inject } from "@nestjs/common";
import { HealthService } from "./health.service.js";

interface RootResponse {
  service: "api";
  status: "ok" | "degraded";
  dependencies: {
    database: "connected" | "error";
    objectStorage: "connected" | "error";
  };
  endpoints: {
    health: string;
  };
}

@Controller()
export class RootController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  async getRoot(): Promise<RootResponse> {
    const health = await this.healthService.getHealth();

    return {
      service: "api",
      status: health.status,
      dependencies: {
        database: health.dependencies.database === "ok" ? "connected" : "error",
        objectStorage: health.dependencies.objectStorage === "ok" ? "connected" : "error",
      },
      endpoints: {
        health: "/health",
      },
    };
  }
}
