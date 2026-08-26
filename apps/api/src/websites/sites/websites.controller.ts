import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { WebsitesService } from "./websites.service.js";

@Controller("tenants/:tenantId")
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class WebsitesController {
  constructor(@Inject(WebsitesService) private readonly websites: WebsitesService) {}

  @Post("websites")
  @RequireRole(MembershipRole.ADMIN)
  createWebsite(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.websites.createWebsite({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      name: input.name,
      slug: input.slug,
    });
  }

  @Get("websites")
  @RequireRole(MembershipRole.VIEWER)
  listWebsites(
    @Req() request: AuthenticatedRequest,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.listWebsites({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      limit,
      cursor,
    });
  }

  @Get("websites/slug-availability")
  @RequireRole(MembershipRole.VIEWER)
  checkSlugAvailability(
    @Req() request: AuthenticatedRequest,
    @Query("slug") slug?: string,
    @Query("excludeWebsiteId") excludeWebsiteId?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.checkSlugAvailability({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      slug,
      excludeWebsiteId,
    });
  }

  @Get("websites/:websiteId")
  @RequireRole(MembershipRole.VIEWER)
  getWebsite(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.getWebsite(user.id, activeTenant.id, websiteId);
  }

  @Get("websites/:websiteId/theme")
  @RequireRole(MembershipRole.VIEWER)
  getTheme(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.getTheme(user.id, activeTenant.id, websiteId);
  }

  @Patch("websites/:websiteId/theme")
  @RequireRole(MembershipRole.EDITOR)
  updateTheme(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.websites.updateTheme({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      name: input.name,
      tokens: input.tokens,
    });
  }

  @Post("websites/:websiteId/theme/reset")
  @RequireRole(MembershipRole.EDITOR)
  resetTheme(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.resetTheme(user.id, activeTenant.id, websiteId);
  }

  @Patch("websites/:websiteId")
  @RequireRole(MembershipRole.ADMIN)
  updateWebsite(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.websites.updateWebsite({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      name: input.name,
      slug: input.slug,
      status: input.status,
      faviconUrl: input.faviconUrl,
      headCode: input.headCode,
      bodyCode: input.bodyCode,
      footerCode: input.footerCode,
      searchEngineVisible: input.searchEngineVisible,
      robotsTxtEnabled: input.robotsTxtEnabled,
      robotsTxtContent: input.robotsTxtContent,
      sitemapEnabled: input.sitemapEnabled,
    });
  }

  @Post("websites/:websiteId/archive")
  @RequireRole(MembershipRole.ADMIN)
  archiveWebsite(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.archiveWebsite(user.id, activeTenant.id, websiteId);
  }

  @Post("websites/:websiteId/domains")
  @RequireRole(MembershipRole.ADMIN)
  createDomain(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.websites.createDomain({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      hostname: input.hostname,
      isPrimary: input.isPrimary,
    });
  }

  @Get("websites/:websiteId/domains")
  @RequireRole(MembershipRole.VIEWER)
  listDomains(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.listDomains({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      limit,
      cursor,
    });
  }

  @Get("domains/:domainId")
  @RequireRole(MembershipRole.VIEWER)
  getDomain(@Req() request: AuthenticatedRequest, @Param("domainId") domainId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.getDomain(user.id, activeTenant.id, domainId);
  }

  @Patch("domains/:domainId")
  @RequireRole(MembershipRole.ADMIN)
  updateDomain(
    @Req() request: AuthenticatedRequest,
    @Param("domainId") domainId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.websites.updateDomain({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      domainId,
      hostname: input.hostname,
    });
  }

  @Post("domains/:domainId/set-primary")
  @RequireRole(MembershipRole.ADMIN)
  setPrimaryDomain(@Req() request: AuthenticatedRequest, @Param("domainId") domainId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.setPrimaryDomain(user.id, activeTenant.id, domainId);
  }

  @Post("domains/:domainId/verify")
  @RequireRole(MembershipRole.ADMIN)
  verifyDomain(@Req() request: AuthenticatedRequest, @Param("domainId") domainId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.markDomainVerified(user.id, activeTenant.id, domainId);
  }

  @Post("domains/:domainId/disable")
  @RequireRole(MembershipRole.ADMIN)
  disableDomain(@Req() request: AuthenticatedRequest, @Param("domainId") domainId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.websites.disableDomain(user.id, activeTenant.id, domainId);
  }
}
