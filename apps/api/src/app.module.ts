import { Module } from "@nestjs/common";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { HealthModule } from "./core/common/health/health.module.js";
import { ContentModule } from "./content/content.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { WebsitesModule } from "./websites/websites.module.js";

@Module({
  imports: [HealthModule, IdentityModule, WebsitesModule, ContentModule, AnalyticsModule],
})
export class AppModule {}
