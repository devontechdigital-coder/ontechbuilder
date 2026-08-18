import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import { CmsService } from "./cms.service.js";

@Controller()
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class CmsController {
  constructor(@Inject(CmsService) private readonly cms: CmsService) {}

  @Post("websites/:websiteId/content-types")
  @RequireRole(MembershipRole.ADMIN)
  createContentType(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.createContentType({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      name: input.name,
      slug: input.slug,
      description: input.description,
    });
  }

  @Get("websites/:websiteId/content-types")
  @RequireRole(MembershipRole.VIEWER)
  listContentTypes(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.listContentTypes({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      limit,
      cursor,
    });
  }

  @Get("content-types/:contentTypeId")
  @RequireRole(MembershipRole.VIEWER)
  getContentType(@Req() request: AuthenticatedRequest, @Param("contentTypeId") contentTypeId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.getContentType(user.id, activeTenant.id, contentTypeId);
  }

  @Patch("content-types/:contentTypeId")
  @RequireRole(MembershipRole.ADMIN)
  updateContentType(
    @Req() request: AuthenticatedRequest,
    @Param("contentTypeId") contentTypeId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.updateContentType({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      contentTypeId,
      name: input.name,
      slug: input.slug,
      description: input.description,
    });
  }

  @Delete("content-types/:contentTypeId")
  @RequireRole(MembershipRole.ADMIN)
  archiveContentType(@Req() request: AuthenticatedRequest, @Param("contentTypeId") contentTypeId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.archiveContentType(user.id, activeTenant.id, contentTypeId);
  }

  @Post("content-types/:contentTypeId/fields")
  @RequireRole(MembershipRole.ADMIN)
  addField(
    @Req() request: AuthenticatedRequest,
    @Param("contentTypeId") contentTypeId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.addField({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      contentTypeId,
      name: input.name,
      slug: input.slug,
      type: input.type,
      required: input.required,
      configuration: input.configuration,
    });
  }

  @Patch("content-fields/:fieldId")
  @RequireRole(MembershipRole.ADMIN)
  updateField(@Req() request: AuthenticatedRequest, @Param("fieldId") fieldId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.updateField({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      fieldId,
      name: input.name,
      slug: input.slug,
      type: input.type,
      required: input.required,
      configuration: input.configuration,
    });
  }

  @Post("content-fields/:fieldId/reorder")
  @RequireRole(MembershipRole.ADMIN)
  reorderField(@Req() request: AuthenticatedRequest, @Param("fieldId") fieldId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.reorderField({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      fieldId,
      position: input.position,
    });
  }

  @Delete("content-fields/:fieldId")
  @RequireRole(MembershipRole.ADMIN)
  removeField(@Req() request: AuthenticatedRequest, @Param("fieldId") fieldId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.removeField(user.id, activeTenant.id, fieldId);
  }

  @Post("content-types/:contentTypeId/entries")
  @RequireRole(MembershipRole.EDITOR)
  createEntry(
    @Req() request: AuthenticatedRequest,
    @Param("contentTypeId") contentTypeId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.createEntry({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      contentTypeId,
      data: input.data,
    });
  }

  @Get("content-types/:contentTypeId/entries")
  @RequireRole(MembershipRole.VIEWER)
  listEntries(
    @Req() request: AuthenticatedRequest,
    @Param("contentTypeId") contentTypeId: string,
    @Query("status") status?: string,
    @Query("query") query?: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.listEntries({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      contentTypeId,
      status,
      query,
      limit,
      cursor,
    });
  }

  @Get("content-entries/:entryId")
  @RequireRole(MembershipRole.VIEWER)
  getEntry(@Req() request: AuthenticatedRequest, @Param("entryId") entryId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.getEntry(user.id, activeTenant.id, entryId);
  }

  @Patch("content-entries/:entryId")
  @RequireRole(MembershipRole.EDITOR)
  updateEntry(@Req() request: AuthenticatedRequest, @Param("entryId") entryId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.cms.updateDraftEntry({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      entryId,
      data: input.data,
    });
  }

  @Delete("content-entries/:entryId")
  @RequireRole(MembershipRole.EDITOR)
  archiveEntry(@Req() request: AuthenticatedRequest, @Param("entryId") entryId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.archiveEntry(user.id, activeTenant.id, entryId);
  }

  @Get("content-entries/:entryId/versions")
  @RequireRole(MembershipRole.VIEWER)
  listVersions(
    @Req() request: AuthenticatedRequest,
    @Param("entryId") entryId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.listVersions({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      entryId,
      limit,
      cursor,
    });
  }

  @Post("content-entries/:entryId/versions/:versionId/publish")
  @RequireRole(MembershipRole.ADMIN)
  publishVersion(
    @Req() request: AuthenticatedRequest,
    @Param("entryId") entryId: string,
    @Param("versionId") versionId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.cms.publishVersion({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      entryId,
      versionId,
    });
  }
}
