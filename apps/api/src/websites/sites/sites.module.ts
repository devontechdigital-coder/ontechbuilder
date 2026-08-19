import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { ThemeInstallationsController } from "./theme-installations.controller.js";
import { ThemeInstallationsService } from "./theme-installations.service.js";
import { PublicSitesController } from "./public-sites.controller.js";
import { WebsitesController } from "./websites.controller.js";
import { WebsitesService } from "./websites.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [WebsitesController, ThemeInstallationsController, PublicSitesController],
  providers: [WebsitesService, ThemeInstallationsService],
  exports: [WebsitesService, ThemeInstallationsService],
})
export class SitesModule {}
