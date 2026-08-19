import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { WebsitesService } from "./websites.service.js";

@Controller("public/sites")
export class PublicSitesController {
  constructor(@Inject(WebsitesService) private readonly websites: WebsitesService) {}

  @Get("resolve")
  resolveSite(@Query("host") host?: string, @Query("path") path?: string) {
    return this.websites.resolvePublicSite(host, path);
  }

  @Get("preview/:websiteId")
  previewSite(@Param("websiteId") websiteId: string, @Query("path") path?: string) {
    return this.websites.resolvePublicSitePreview(websiteId, path);
  }
}
