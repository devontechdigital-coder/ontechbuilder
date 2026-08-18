import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { requiredString } from "../../core/common/input.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { SessionService } from "../../identity/auth/session.service.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { TenantsService } from "./tenants.service.js";

@Controller("tenants")
export class TenantsController {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TenantsService) private readonly tenants: TenantsService,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  createTenant(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const input = body as Record<string, unknown>;

    return this.tenants.createTenant({
      actorUserId: user.id,
      name: input.name,
      slug: input.slug,
    });
  }

  @Get()
  @UseGuards(AuthGuard)
  listTenants(@Req() request: AuthenticatedRequest) {
    const user = getAuthenticatedUser(request);
    return this.tenants.listTenants(user.id);
  }

  @Get("current")
  @UseGuards(AuthGuard)
  getCurrentTenant(@Req() request: AuthenticatedRequest) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.tenants.getTenant(user.id, activeTenant.id);
  }

  @Post("switch")
  @UseGuards(AuthGuard)
  async switchTenant(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const input = body as Record<string, unknown>;
    const activeTenant = await this.sessions.setActiveTenant(
      request.auth?.sessionId ?? "",
      user.id,
      requiredString(input.tenantId, "tenantId"),
    );

    return {
      activeTenant,
    };
  }

  @Get(":tenantId")
  @UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
  @RequireRole(MembershipRole.VIEWER)
  getTenant(@Req() request: AuthenticatedRequest, @Param("tenantId") tenantId: string) {
    const user = getAuthenticatedUser(request);
    return this.tenants.getTenant(user.id, tenantId);
  }

  @Post(":tenantId/memberships")
  @UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
  @RequireRole(MembershipRole.ADMIN)
  createMembership(
    @Req() request: AuthenticatedRequest,
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const input = body as Record<string, unknown>;

    return this.tenants.createMembership({
      actorUserId: user.id,
      tenantId,
      userId: input.userId,
      role: input.role,
    });
  }

  @Get(":tenantId/memberships")
  @UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
  @RequireRole(MembershipRole.ADMIN)
  listMemberships(@Req() request: AuthenticatedRequest, @Param("tenantId") tenantId: string) {
    const user = getAuthenticatedUser(request);
    return this.tenants.listMemberships(user.id, tenantId);
  }
}
