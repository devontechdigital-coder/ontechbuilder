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

  /** Which website (and its tenant) a custom domain is linked to — see WebsitesService.resolveDomainOwner. */
  @Get("domain-owner")
  domainOwner(@Query("host") host?: string) {
    return this.websites.resolveDomainOwner(host);
  }

  /** SEO settings + published page paths for a domain's website — see WebsitesService.resolvePublicSiteSeo. */
  @Get("seo")
  seo(@Query("host") host?: string) {
    return this.websites.resolvePublicSiteSeo(host);
  }

  /** Real published blog posts for a "dynamic" Blog grid section — see WebsitesService.resolvePublicBlogPosts. */
  @Get("blog-posts")
  blogPosts(@Query("websiteId") websiteId?: string, @Query("categoryIds") categoryIds?: string, @Query("limit") limit?: string) {
    return this.websites.resolvePublicBlogPosts(websiteId, categoryIds, limit);
  }
}
