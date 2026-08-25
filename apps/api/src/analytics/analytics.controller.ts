import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MembershipRole } from "../core/database/database.js";
import { AuthGuard } from "../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../identity/auth/auth-context.js";
import { RequireRole } from "../identity/auth/roles.decorator.js";
import { RolesGuard } from "../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../identity/auth/auth.types.js";
import { AnalyticsService } from "./analytics.service.js";

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
  return forwardedIp || request.socket.remoteAddress || undefined;
}

/** Unauthenticated on purpose — fired by every visitor's browser on every page view (see apps/renderer's page-view beacon). */
@Controller("public/track")
export class PublicAnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Post()
  track(@Body() body: unknown, @Req() request: Request) {
    const input = body as Record<string, unknown>;
    return this.analytics.track({
      websiteId: input.websiteId,
      pageId: input.pageId,
      path: input.path,
      referrer: input.referrer,
      sessionId: input.sessionId,
      userAgent: request.headers["user-agent"],
      ip: clientIp(request),
    });
  }
}

@Controller()
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get("websites/:websiteId/analytics/live")
  @RequireRole(MembershipRole.VIEWER)
  getLiveView(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.analytics.getLiveView(user.id, activeTenant.id, websiteId);
  }

  @Get("websites/:websiteId/analytics")
  @RequireRole(MembershipRole.VIEWER)
  getAnalytics(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("days") days?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const parsedDays = days ? Number(days) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.analytics.getAnalytics(user.id, activeTenant.id, websiteId, {
      ...(parsedDays !== undefined && Number.isFinite(parsedDays) ? { days: parsedDays } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(parsedLimit !== undefined && Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
    });
  }
}
