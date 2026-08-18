import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MembershipRole } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { MediaMetadataService } from "./media-metadata.service.js";

@Controller("media")
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class MediaMetadataController {
  constructor(@Inject(MediaMetadataService) private readonly media: MediaMetadataService) {}

  @Post("uploads/init")
  @RequireRole(MembershipRole.EDITOR)
  initUpload(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.media.initUpload({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      access: input.access,
    });
  }

  @Post("uploads/:mediaId/complete")
  @RequireRole(MembershipRole.EDITOR)
  completeUpload(
    @Req() request: AuthenticatedRequest,
    @Param("mediaId") mediaId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.media.completeUpload({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      mediaId,
      uploadToken: input.uploadToken,
    });
  }

  @Get()
  @RequireRole(MembershipRole.VIEWER)
  listMedia(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);

    return this.media.listMedia({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      query: query.query,
      mimeType: query.mimeType,
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get(":mediaId")
  @RequireRole(MembershipRole.VIEWER)
  getMedia(@Req() request: AuthenticatedRequest, @Param("mediaId") mediaId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.media.getMedia(user.id, activeTenant.id, mediaId);
  }

  @Get(":mediaId/access")
  @RequireRole(MembershipRole.VIEWER)
  getMediaAccess(@Req() request: AuthenticatedRequest, @Param("mediaId") mediaId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.media.getMediaAccess(user.id, activeTenant.id, mediaId);
  }

  @Delete(":mediaId")
  @RequireRole(MembershipRole.EDITOR)
  deleteMedia(@Req() request: AuthenticatedRequest, @Param("mediaId") mediaId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.media.deleteMedia(user.id, activeTenant.id, mediaId);
  }
}
