import { Body, Controller, Delete, Get, Inject, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { LeadsService } from "./leads.service.js";

@Controller()
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService) {}

  @Get("websites/:websiteId/leads")
  @RequireRole(MembershipRole.VIEWER)
  listLeads(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("formId") formId?: string,
    @Query("status") status?: string,
    @Query("q") query?: string,
    @Query("page") page?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.leads.listLeads({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, formId, status, query, page });
  }

  @Get("leads/:leadId")
  @RequireRole(MembershipRole.VIEWER)
  getLead(@Req() request: AuthenticatedRequest, @Param("leadId") leadId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.leads.getLead(user.id, activeTenant.id, leadId);
  }

  @Patch("leads/:leadId")
  @RequireRole(MembershipRole.EDITOR)
  updateLead(@Req() request: AuthenticatedRequest, @Param("leadId") leadId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.leads.updateLeadStatus(user.id, activeTenant.id, leadId, input.status);
  }

  @Delete("leads/:leadId")
  @RequireRole(MembershipRole.EDITOR)
  deleteLead(@Req() request: AuthenticatedRequest, @Param("leadId") leadId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.leads.deleteLead(user.id, activeTenant.id, leadId);
  }
}
