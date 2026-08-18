import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { ThemeInstallationsService } from "./theme-installations.service.js";

@Controller("tenants/:tenantId/websites/:websiteId/themes")
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class ThemeInstallationsController {
  constructor(@Inject(ThemeInstallationsService) private readonly themes: ThemeInstallationsService) {}

  @Get("catalog")
  @RequireRole(MembershipRole.VIEWER)
  catalog(@Req() request: AuthenticatedRequest) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.catalog({ actorUserId: user.id, tenantId: activeTenant.id });
  }

  @Get()
  @RequireRole(MembershipRole.VIEWER)
  list(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.list({ actorUserId: user.id, tenantId: activeTenant.id, websiteId });
  }

  @Post()
  @RequireRole(MembershipRole.EDITOR)
  create(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.themes.create({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      themeId: input.themeId,
      name: input.name,
      sourceInstallationId: input.sourceInstallationId,
    });
  }

  @Post("upload")
  @RequireRole(MembershipRole.EDITOR)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5_000_000, files: 1 } }))
  upload(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @UploadedFile() file: { buffer?: Buffer; originalname?: string } | undefined,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.themes.upload({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      name: input.name,
      ...(file ? { file } : {}),
    });
  }

  @Get(":installationId/draft")
  @RequireRole(MembershipRole.VIEWER)
  getDraft(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.getDraft({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId });
  }

  @Patch(":installationId/settings")
  @RequireRole(MembershipRole.EDITOR)
  saveSettings(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.themes.saveSettings({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      installationId,
      settings: input.settings,
      expectedRevision: input.expectedRevision,
    });
  }

  @Get(":installationId/files")
  @RequireRole(MembershipRole.VIEWER)
  getFile(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
    @Query("path") path?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.getFile({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId, path });
  }

  @Patch(":installationId/files")
  @RequireRole(MembershipRole.EDITOR)
  saveFile(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.themes.saveFile({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      installationId,
      path: input.path,
      content: input.content,
      expectedRevision: input.expectedRevision,
    });
  }

  @Delete(":installationId/files")
  @RequireRole(MembershipRole.EDITOR)
  deleteFile(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
    @Query("path") path?: string,
    @Query("expectedRevision") expectedRevision?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.deleteFile({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      installationId,
      path,
      expectedRevision,
    });
  }

  @Post(":installationId/publish")
  @RequireRole(MembershipRole.EDITOR)
  publish(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.publish({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId });
  }

  @Get(":installationId/versions")
  @RequireRole(MembershipRole.VIEWER)
  versions(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.listVersions({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId });
  }

  @Get(":installationId/history")
  @RequireRole(MembershipRole.VIEWER)
  history(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.listHistory({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId });
  }

  @Post(":installationId/versions/:versionId/restore")
  @RequireRole(MembershipRole.EDITOR)
  restore(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
    @Param("versionId") versionId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.restore({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId, versionId });
  }

  @Delete(":installationId")
  @RequireRole(MembershipRole.EDITOR)
  delete(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Param("installationId") installationId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.themes.delete({ actorUserId: user.id, tenantId: activeTenant.id, websiteId, installationId });
  }
}
