import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { ObjectStorageHealthService } from "../../storage/object-storage-health.service.js";

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  dependencies: Record<string, "ok" | "error">;
}

type DependencyName = "database" | "objectStorage";

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ObjectStorageHealthService)
    private readonly objectStorage: ObjectStorageHealthService,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const dependencies: Record<DependencyName, "ok" | "error"> = {
      database: await this.check(() => this.prisma.healthCheck()),
      objectStorage: await this.check(() => this.objectStorage.healthCheck()),
    };

    return {
      status: Object.values(dependencies).every((status) => status === "ok") ? "ok" : "degraded",
      service: "api",
      dependencies,
    };
  }

  private async check(fn: () => Promise<boolean>): Promise<"ok" | "error"> {
    try {
      return (await this.withTimeout(fn(), 1_000)) ? "ok" : "error";
    } catch {
      return "error";
    }
  }

  private async withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error("Health check timed out")), milliseconds);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
