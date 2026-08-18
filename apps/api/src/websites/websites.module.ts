import { Module } from "@nestjs/common";
import { SitesModule } from "./sites/sites.module.js";

@Module({
  imports: [SitesModule],
})
export class WebsitesModule {}
