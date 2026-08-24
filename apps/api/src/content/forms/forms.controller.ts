import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { FormsService } from "./forms.service.js";

@Controller()
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class FormsController {
  constructor(@Inject(FormsService) private readonly forms: FormsService) {}

  @Post("websites/:websiteId/forms")
  @RequireRole(MembershipRole.EDITOR)
  createForm(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.forms.createForm({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      name: input.name,
      slug: input.slug,
    });
  }

  @Get("websites/:websiteId/forms")
  @RequireRole(MembershipRole.VIEWER)
  listForms(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("status") status?: string,
    @Query("q") query?: string,
    @Query("includeCounts") includeCounts?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.forms.listForms({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, status, query, includeCounts });
  }

  @Get("forms/:formId")
  @RequireRole(MembershipRole.VIEWER)
  getForm(@Req() request: AuthenticatedRequest, @Param("formId") formId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.forms.getForm(user.id, activeTenant.id, formId);
  }

  @Patch("forms/:formId")
  @RequireRole(MembershipRole.EDITOR)
  updateForm(@Req() request: AuthenticatedRequest, @Param("formId") formId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.forms.updateForm({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      formId,
      name: input.name,
      slug: input.slug,
      status: input.status,
      fields: input.fields,
      mailSettings: input.mailSettings,
    });
  }

  @Post("forms/:formId/clone")
  @RequireRole(MembershipRole.EDITOR)
  cloneForm(@Req() request: AuthenticatedRequest, @Param("formId") formId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.forms.cloneForm(user.id, activeTenant.id, formId);
  }

  @Post("forms/:formId/archive")
  @RequireRole(MembershipRole.EDITOR)
  archiveForm(@Req() request: AuthenticatedRequest, @Param("formId") formId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.forms.archiveForm(user.id, activeTenant.id, formId);
  }

  @Post("forms/bulk")
  @RequireRole(MembershipRole.EDITOR)
  bulkFormAction(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.forms.bulkFormAction({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      formIds: input.formIds,
      action: input.action,
    });
  }
}

/**
 * Unauthenticated on purpose — this is what a theme's own Forms/ContactForm section (see
 * ontech-theme-zip's ContactForm.tsx: `<form action={actionUrl} method="post">`) POSTs to
 * directly from an anonymous visitor's browser. Mirrors PublicSitesController's pattern of a
 * separate, guard-free controller for the truly public surface.
 */
@Controller("public/forms")
export class PublicFormsController {
  constructor(@Inject(FormsService) private readonly forms: FormsService) {}

  @Post(":formId/submit")
  submitForm(@Param("formId") formId: string, @Body() body: unknown) {
    return this.forms.submitForm(formId, body);
  }
}
