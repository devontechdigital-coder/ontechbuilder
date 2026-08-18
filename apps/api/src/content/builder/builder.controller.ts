import { Body, Controller, Get, Inject, Param, Put, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import { BuilderService } from "./builder.service.js";

@Controller()
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class BuilderController {
  constructor(@Inject(BuilderService) private readonly builder: BuilderService) {}

  @Get("pages/:pageId/builder/draft")
  @RequireRole(MembershipRole.VIEWER)
  getDraft(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.builder.getDraft({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
    });
  }

  @Put("pages/:pageId/builder/draft")
  @RequireRole(MembershipRole.EDITOR)
  saveDraft(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.builder.saveDraft({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      document: input.document,
      expectedRevision: input.expectedRevision,
    });
  }
}
