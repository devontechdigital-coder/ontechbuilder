import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module.js";
import { AuthModule } from "../identity/auth/auth.module.js";
import { TenantsModule } from "../identity/tenants/tenants.module.js";
import { AnalyticsController, PublicAnalyticsController } from "./analytics.controller.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
