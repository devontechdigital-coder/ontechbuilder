import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { type AppConfig } from "../config/config.js";
import { PrismaClient, checkDatabaseConnection } from "./database.js";
import { APP_CONFIG } from "../config/config.provider.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      datasources: {
        db: {
          url: config.DATABASE_URL,
        },
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async healthCheck(): Promise<boolean> {
    return checkDatabaseConnection(this);
  }
}
