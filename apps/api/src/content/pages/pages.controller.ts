import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { MembershipRole, PageKind } from "../../core/database/database.js";
import { AuthGuard } from "../../identity/auth/auth.guard.js";
import { getActiveTenant, getAuthenticatedUser } from "../../identity/auth/auth-context.js";
import { RequireRole } from "../../identity/auth/roles.decorator.js";
import { RolesGuard } from "../../identity/auth/roles.guard.js";
import { TenantContextGuard } from "../../identity/auth/tenant-context.guard.js";
import type { AuthenticatedRequest } from "../../identity/auth/auth.types.js";
import { PagesService } from "./pages.service.js";

@Controller()
@UseGuards(AuthGuard, TenantContextGuard, RolesGuard)
export class PagesController {
  constructor(@Inject(PagesService) private readonly pages: PagesService) {}

  @Post("websites/:websiteId/pages")
  @RequireRole(MembershipRole.EDITOR)
  createPage(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.createPage({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      title: input.title,
      slug: input.slug,
      parentId: input.parentId,
      isHomePage: input.isHomePage,
      templateId: input.templateId,
      kind: input.kind,
    });
  }

  @Get("websites/:websiteId/pages")
  @RequireRole(MembershipRole.VIEWER)
  listPages(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("status") status?: string,
    @Query("q") query?: string,
    @Query("includeCounts") includeCounts?: string,
    @Query("kind") queryKind?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.listPages({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      status,
      query,
      includeCounts,
      kind: queryKind,
    });
  }

  @Post("websites/:websiteId/blog-categories")
  @RequireRole(MembershipRole.EDITOR)
  createBlogCategory(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.createBlogCategory({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      name: input.name,
      slug: input.slug,
    });
  }

  @Get("websites/:websiteId/blog-categories")
  @RequireRole(MembershipRole.VIEWER)
  listBlogCategories(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.listBlogCategories({ actorUserId: user.id, tenantId: activeTenant.id, websiteId });
  }

  @Post("websites/:websiteId/blogs")
  @RequireRole(MembershipRole.EDITOR)
  createBlog(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.createPage({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      title: input.title,
      slug: input.slug,
      templateId: input.templateId,
      blogCategoryId: input.blogCategoryId,
      kind: PageKind.BLOG,
    });
  }

  @Get("websites/:websiteId/blogs")
  @RequireRole(MembershipRole.VIEWER)
  listBlogs(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("status") status?: string,
    @Query("q") query?: string,
    @Query("includeCounts") includeCounts?: string,
    @Query("blogCategoryId") blogCategoryId?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.listPages({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      websiteId,
      status,
      query,
      includeCounts,
      blogCategoryId,
      kind: PageKind.BLOG,
    });
  }

  @Get("websites/:websiteId/pages/tree")
  @RequireRole(MembershipRole.VIEWER)
  getPageTree(@Req() request: AuthenticatedRequest, @Param("websiteId") websiteId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getPageTree({ actorUserId: user.id, tenantId: activeTenant.id, websiteId });
  }

  @Get("websites/:websiteId/pages/resolve")
  @RequireRole(MembershipRole.VIEWER)
  resolvePagePath(
    @Req() request: AuthenticatedRequest,
    @Param("websiteId") websiteId: string,
    @Query("path") path?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.resolvePagePath(user.id, activeTenant.id, websiteId, path);
  }

  @Get("pages/:pageId")
  @RequireRole(MembershipRole.VIEWER)
  getPage(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getPage(user.id, activeTenant.id, pageId);
  }

  @Patch("pages/:pageId")
  @RequireRole(MembershipRole.EDITOR)
  updatePage(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.updatePage({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      title: input.title,
      slug: input.slug,
      parentId: input.parentId,
      isHomePage: input.isHomePage,
      status: input.status,
      templateId: input.templateId,
    });
  }

  @Get("blogs/:pageId")
  @RequireRole(MembershipRole.VIEWER)
  getBlog(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getPage(user.id, activeTenant.id, pageId, PageKind.BLOG);
  }

  @Patch("blogs/:pageId")
  @RequireRole(MembershipRole.EDITOR)
  updateBlog(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.updatePage({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      title: input.title,
      slug: input.slug,
      status: input.status,
      templateId: input.templateId,
      blogCategoryId: input.blogCategoryId,
      kind: PageKind.BLOG,
    });
  }

  @Get("blogs/:pageId/seo")
  @RequireRole(MembershipRole.VIEWER)
  getBlogSeo(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getSeo(user.id, activeTenant.id, pageId, PageKind.BLOG);
  }

  @Patch("blogs/:pageId/seo")
  @RequireRole(MembershipRole.EDITOR)
  updateBlogSeo(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.updateSeo({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      seo: input.seo,
      kind: PageKind.BLOG,
    });
  }

  @Post("blogs/:pageId/archive")
  @RequireRole(MembershipRole.EDITOR)
  archiveBlog(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.archivePage(user.id, activeTenant.id, pageId, PageKind.BLOG);
  }

  @Post("blogs/:pageId/clone")
  @RequireRole(MembershipRole.EDITOR)
  cloneBlog(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.clonePage(user.id, activeTenant.id, pageId, PageKind.BLOG);
  }

  @Post("blogs/bulk")
  @RequireRole(MembershipRole.EDITOR)
  bulkBlogAction(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.bulkPageAction({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageIds: input.pageIds,
      action: input.action,
      kind: PageKind.BLOG,
    });
  }

  @Get("pages/:pageId/seo")
  @RequireRole(MembershipRole.VIEWER)
  getSeo(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getSeo(user.id, activeTenant.id, pageId);
  }

  @Patch("pages/:pageId/seo")
  @RequireRole(MembershipRole.EDITOR)
  updateSeo(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.updateSeo({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      seo: input.seo,
    });
  }

  @Post("pages/:pageId/archive")
  @RequireRole(MembershipRole.EDITOR)
  archivePage(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.archivePage(user.id, activeTenant.id, pageId);
  }

  @Post("pages/:pageId/clone")
  @RequireRole(MembershipRole.EDITOR)
  clonePage(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.clonePage(user.id, activeTenant.id, pageId);
  }

  @Post("pages/bulk")
  @RequireRole(MembershipRole.EDITOR)
  bulkPageAction(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;

    return this.pages.bulkPageAction({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageIds: input.pageIds,
      action: input.action,
    });
  }

  @Delete("pages/:pageId")
  @RequireRole(MembershipRole.ADMIN)
  deletePage(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.deletePages(user.id, activeTenant.id, [pageId]);
  }

  @Post("pages/:pageId/versions")
  @RequireRole(MembershipRole.EDITOR)
  createVersion(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.pages.createVersion({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      content: input.content,
    });
  }

  @Get("pages/:pageId/versions")
  @RequireRole(MembershipRole.VIEWER)
  listVersions(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.listVersions({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      limit,
      cursor,
    });
  }

  @Get("pages/:pageId/versions/draft")
  @RequireRole(MembershipRole.VIEWER)
  getDraft(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getCurrentDraft(user.id, activeTenant.id, pageId);
  }

  @Get("pages/:pageId/versions/published")
  @RequireRole(MembershipRole.VIEWER)
  getPublished(@Req() request: AuthenticatedRequest, @Param("pageId") pageId: string) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getCurrentPublished(user.id, activeTenant.id, pageId);
  }

  @Get("pages/:pageId/versions/:versionId")
  @RequireRole(MembershipRole.VIEWER)
  getVersion(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Param("versionId") versionId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.getVersion(user.id, activeTenant.id, pageId, versionId);
  }

  @Patch("pages/:pageId/versions/:versionId")
  @RequireRole(MembershipRole.EDITOR)
  updateVersion(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Param("versionId") versionId: string,
    @Body() body: unknown,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    const input = body as Record<string, unknown>;
    return this.pages.updateDraftVersion({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      versionId,
      content: input.content,
    });
  }

  @Post("pages/:pageId/versions/:versionId/publish")
  @RequireRole(MembershipRole.ADMIN)
  publishVersion(
    @Req() request: AuthenticatedRequest,
    @Param("pageId") pageId: string,
    @Param("versionId") versionId: string,
  ) {
    const user = getAuthenticatedUser(request);
    const activeTenant = getActiveTenant(request);
    return this.pages.publishVersion({
      actorUserId: user.id,
      tenantId: activeTenant.id,
      pageId,
      versionId,
    });
  }
}
