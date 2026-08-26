"use client";

import { Archive, CheckCircle2, Code2, Copy, CreditCard, Edit3, ExternalLink, Eye, Filter, Gift, Globe2, History, Library, Palette, Plus, RefreshCw, Rocket, Search, SearchCheck, Settings, ShieldAlert, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { use, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, IconButton } from "../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader, Skeleton } from "../../components/ui/display";
import { Checkbox, Field, Input, Select } from "../../components/ui/form";
import { Pagination, Table, Tabs } from "../../components/ui/navigation";
import { ConfirmDialog, Modal, Sheet } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import { getTemplateDefinitions, isHomeTemplateId, type TemplateDefinition } from "./customizer/state";
import { WebsiteSeoSettings } from "./website-seo-settings";
import type {
  BlogCategorySummary,
  DomainSummary,
  PageListSummary,
  PageResult,
  PageSummary,
  ThemeDefinitionSummary,
  ThemeDraftSummary,
  ThemeInstallationSummary,
  ThemeRevisionSummary,
  ThemeVersionSummary,
  WebsiteSummary,
} from "./types";
import { PageSeoSettingsModal } from "./page-seo-settings";
import { ThemeButton, WebsiteThemeSettingsModal } from "./website-theme-settings";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

type WebsiteSection = "pages" | "blogs" | "themes" | "domains" | "settings";
type SettingsTab = "general" | "seo" | "danger";

const domainPageSize = 8;
const pageSizePresets = ["10", "25", "50", "100"];
const defaultPagesPerPage = 10;

function getCachedDashboardShell(): { me: MeResponse; tenants: TenantSummary[] } | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return JSON.parse(window.sessionStorage.getItem("stackbuilder-dashboard-shell-state") ?? "null") as {
      me: MeResponse;
      tenants: TenantSummary[];
    } | null;
  } catch {
    return null;
  }
}

export function WebsiteWorkspace({
  params,
  section,
}: {
  params: Promise<{ id: string }>;
  section: WebsiteSection;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategorySummary[]>([]);
  const [pageCounts, setPageCounts] = useState<PageListSummary["counts"]>({ all: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 });
  const [themes, setThemes] = useState<ThemeInstallationSummary[]>([]);
  const [themeCatalog, setThemeCatalog] = useState<ThemeDefinitionSummary[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageQuery, setPageQuery] = useState("");
  const [pageSearchInput, setPageSearchInput] = useState("");
  const [pageStatusFilter, setPageStatusFilter] = useState("all");
  const [blogCategoryFilter, setBlogCategoryFilter] = useState("all");
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [isBulkUpdatingPages, setIsBulkUpdatingPages] = useState(false);
  const [pageSizeChoice, setPageSizeChoice] = useState<string>(String(defaultPagesPerPage));
  const [pageSizeInputChoice, setPageSizeInputChoice] = useState<string>(String(defaultPagesPerPage));
  const [customPageSize, setCustomPageSize] = useState(defaultPagesPerPage);
  const [customPageSizeInput, setCustomPageSizeInput] = useState(defaultPagesPerPage);
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const [createThemeOpen, setCreateThemeOpen] = useState(false);
  const [themeName, setThemeName] = useState("Portal Modern");
  const [selectedThemeId, setSelectedThemeId] = useState("portal-modern");
  const [themeSource, setThemeSource] = useState<"library" | "upload">("library");
  const [themePriceFilter, setThemePriceFilter] = useState<"all" | "free" | "paid">("all");
  const [themeCategoryFilter, setThemeCategoryFilter] = useState("all");
  const [uploadedThemeFile, setUploadedThemeFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hostname, setHostname] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<DomainSummary | null>(null);
  const [editingDomain, setEditingDomain] = useState<DomainSummary | null>(null);
  const [editingHostname, setEditingHostname] = useState("");
  const [refreshingDomainId, setRefreshingDomainId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [pageSlugTouched, setPageSlugTouched] = useState(false);
  const [isHomePage, setIsHomePage] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<TemplateDefinition[]>([]);
  const [pageTemplateId, setPageTemplateId] = useState("");
  const [pageBlogCategoryId, setPageBlogCategoryId] = useState("");
  const [newBlogCategoryName, setNewBlogCategoryName] = useState("");
  const [isCreatingBlogCategory, setIsCreatingBlogCategory] = useState(false);
  const [editingPage, setEditingPage] = useState<PageSummary | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState("");
  const [editingPageSlug, setEditingPageSlug] = useState("");
  const [editingPageIsHomePage, setEditingPageIsHomePage] = useState(false);
  const [editingPageTemplateId, setEditingPageTemplateId] = useState("");
  const [editingPageStatus, setEditingPageStatus] = useState<PageSummary["status"]>("DRAFT");
  const [editingPageBlogCategoryId, setEditingPageBlogCategoryId] = useState("");
  const [seoPage, setSeoPage] = useState<PageSummary | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [historyTheme, setHistoryTheme] = useState<ThemeInstallationSummary | null>(null);
  const [themeVersions, setThemeVersions] = useState<ThemeVersionSummary[]>([]);
  const [themeHistory, setThemeHistory] = useState<ThemeRevisionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; action: () => void }>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("general");
  const [archiveConfirmationInput, setArchiveConfirmationInput] = useState("");

  const pagesPerPage = pageSizeChoice === "custom" ? Math.max(1, customPageSize || 1) : Number(pageSizeChoice);
  const visiblePages = pages.slice(pageIndex * pagesPerPage, pageIndex * pagesPerPage + pagesPerPage);
  const pageCount = Math.max(1, Math.ceil(pages.length / pagesPerPage));
  const selectedPages = useMemo(() => pages.filter((page) => selectedPageIds.has(page.id)), [pages, selectedPageIds]);
  const blogCategoryById = useMemo(() => new Map(blogCategories.map((category) => [category.id, category])), [blogCategories]);
  const visibleSelectablePageIds = visiblePages.map((page) => page.id);
  const allVisiblePagesSelected = Boolean(visibleSelectablePageIds.length) && visibleSelectablePageIds.every((pageId) => selectedPageIds.has(pageId));
  const pageFilterTabs = [
    { value: "all", label: `All (${pageCounts.all})`, count: pageCounts.all },
    { value: "PUBLISHED", label: `Published (${pageCounts.PUBLISHED})`, count: pageCounts.PUBLISHED },
    { value: "DRAFT", label: `Draft (${pageCounts.DRAFT})`, count: pageCounts.DRAFT },
    { value: "ARCHIVED", label: `Archived (${pageCounts.ARCHIVED})`, count: pageCounts.ARCHIVED },
  ].filter((tab) => tab.value === "all" || tab.count > 0);
  const pendingPagesPerPage = pageSizeInputChoice === "custom" ? Math.max(1, customPageSizeInput || 1) : Number(pageSizeInputChoice);
  const hasPendingPageControls =
    pageSearchInput.trim() !== pageQuery ||
    pageSizeInputChoice !== pageSizeChoice ||
    pendingPagesPerPage !== pagesPerPage;
  const isPageListSection = section === "pages" || section === "blogs";
  const contentKind = section === "blogs" ? "BLOG" : "PAGE";
  const listEndpoint = section === "blogs" ? `/websites/${id}/blogs` : `/websites/${id}/pages`;
  const itemEndpointBase = section === "blogs" ? "blogs" : "pages";
  const contentLabels = section === "blogs"
    ? {
        pluralTitle: "Blogs",
        singularTitle: "blog post",
        singularTitleCase: "Blog post",
        createLabel: "Create blog",
        emptyTitle: "No blog posts found",
        emptyDescription: "Create a blog post or adjust the filter.",
        sectionDescription: "Search, filter, and open builder-ready blog posts for this website.",
        slugHint: "Lowercase URL path for this blog post.",
      }
    : {
        pluralTitle: "Pages",
        singularTitle: "page",
        singularTitleCase: "Page",
        createLabel: "Create page",
        emptyTitle: "No pages found",
        emptyDescription: "Create a homepage or adjust the filter.",
        sectionDescription: "Search, filter, and open builder-ready pages for this website.",
        slugHint: "Lowercase URL path for this page.",
      };

  async function loadPages(status = pageStatusFilter, query = pageQuery) {
    const searchParams = new URLSearchParams({ includeCounts: "true" });
    const normalizedQuery = query.trim();
    if (status !== "all") {
      searchParams.set("status", status);
    }
    if (normalizedQuery) {
      searchParams.set("q", normalizedQuery);
    }
    if (section === "blogs" && blogCategoryFilter !== "all") {
      searchParams.set("blogCategoryId", blogCategoryFilter);
    }

    setIsLoadingPages(true);
    try {
      const pagesResponse = await apiRequest<PageListSummary>(`${listEndpoint}?${searchParams.toString()}`);
      setPages(pagesResponse.data);
      setPageCounts(pagesResponse.counts);
    } finally {
      setIsLoadingPages(false);
    }
  }

  async function loadWebsite(activeTenant: ActiveTenant, domainCursor?: string) {
    const pageSearchParams = new URLSearchParams({ includeCounts: "true" });
    if (pageStatusFilter !== "all") {
      pageSearchParams.set("status", pageStatusFilter);
    }
    if (pageQuery.trim()) {
      pageSearchParams.set("q", pageQuery.trim());
    }
    if (section === "blogs" && blogCategoryFilter !== "all") {
      pageSearchParams.set("blogCategoryId", blogCategoryFilter);
    }

    // The theme draft (needed for the Template field's options) has to be requested with a
    // themeId, which only themesResponse can supply — so it's fetched first, on its own, and
    // everything else (including the draft itself) runs in one batch after. Previously the draft
    // fetch was a further sequential await AFTER the batch that already set `pages` — the page
    // list was interactive well before templateOptions existed, so opening Edit soon after
    // load showed a form with no Template field at all. Folding it into the same batch that
    // produces `pages` means both land in the same render, closing that window.
    const themesResponse = await apiRequest<ThemeInstallationSummary[]>(`/tenants/${activeTenant.id}/websites/${id}/themes`);
    const currentThemeId = isPageListSection
      ? (themesResponse.find((theme) => theme.status === "PUBLISHED")?.id ?? themesResponse[0]?.id ?? null)
      : null;

    const [websiteResponse, domainResponse, pagesResponse, catalogResponse, blogCategoriesResponse, draftResponse] = await Promise.all([
      apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`),
      apiRequest<PageResult<DomainSummary>>(
        `/tenants/${activeTenant.id}/websites/${id}/domains?limit=${domainPageSize}${domainCursor ? `&cursor=${encodeURIComponent(domainCursor)}` : ""}`,
      ),
      apiRequest<PageListSummary>(`${listEndpoint}?${pageSearchParams.toString()}`),
      apiRequest<ThemeDefinitionSummary[]>(`/tenants/${activeTenant.id}/websites/${id}/themes/catalog`),
      section === "blogs" ? apiRequest<BlogCategorySummary[]>(`/websites/${id}/blog-categories`) : Promise.resolve<BlogCategorySummary[]>([]),
      currentThemeId
        ? apiRequest<ThemeDraftSummary>(`/tenants/${activeTenant.id}/websites/${id}/themes/${currentThemeId}/draft`)
        : Promise.resolve(null),
    ]);

    setWebsite(websiteResponse);
    setName(websiteResponse.name);
    setSlug(websiteResponse.slug);
    setDomains((current) => (domainCursor ? [...current, ...domainResponse.data] : domainResponse.data));
    setPages(pagesResponse.data);
    setPageCounts(pagesResponse.counts);
    setThemes(themesResponse);
    setThemeCatalog(catalogResponse);
    setBlogCategories(blogCategoriesResponse);
    setTemplateOptions(getTemplateDefinitions(draftResponse));
  }

  useEffect(() => {
    const cachedShell = getCachedDashboardShell();
    const shellReady = window.sessionStorage.getItem("stackbuilder-dashboard-shell-ready") === "true";
    setHasLoadedDashboardShell(shellReady);
    if (cachedShell) {
      setMe(cachedShell.me);
      setTenants(cachedShell.tenants);
    }

    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);

        if (meResponse.activeTenant) {
          await loadWebsite(meResponse.activeTenant);
        }
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [id, router]);

  useEffect(() => {
    setPageIndex(0);
    setSelectedPageIds(new Set());
  }, [blogCategoryFilter, pageQuery, pageStatusFilter, pageSizeChoice, customPageSize]);

  useEffect(() => {
    if (pageStatusFilter !== "all" && pageCounts[pageStatusFilter as keyof Omit<PageListSummary["counts"], "all">] === 0) {
      setPageStatusFilter("all");
    }
  }, [pageCounts, pageStatusFilter]);

  useEffect(() => {
    if (!me?.activeTenant || !isPageListSection) {
      return;
    }

    void loadPages();
  }, [blogCategoryFilter, me?.activeTenant, pageQuery, pageStatusFilter, section]);

  useEffect(() => {
    if (!pageSlugTouched) {
      setPageSlug(slugify(pageTitle));
    }
  }, [pageSlugTouched, pageTitle]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    setDomains([]);
    await loadWebsite(response.activeTenant);
  }

  async function refresh() {
    if (!me?.activeTenant) {
      return;
    }

    setDomains([]);
    await loadWebsite(me.activeTenant);
  }

  async function createTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!me?.activeTenant) {
      return;
    }

    if (themeSource === "upload") {
      if (!uploadedThemeFile) {
        toast.error("Choose a theme ZIP before uploading.");
        return;
      }
      if (!uploadedThemeFile.name.toLowerCase().endsWith(".zip")) {
        toast.error("Theme package must be a .zip file.");
        return;
      }
    }

    const uploadingZip = themeSource === "upload";
    const uploadedThemeName = uploadedThemeFile?.name.replace(/\.zip$/i, "") || "Uploaded theme";

    try {
      if (uploadingZip) {
        const formData = new FormData();
        formData.append("name", uploadedThemeName);
        formData.append("file", uploadedThemeFile as File);
        await apiRequest<ThemeInstallationSummary>(`/tenants/${me.activeTenant.id}/websites/${id}/themes/upload`, {
          method: "POST",
          body: formData,
        });
      } else {
        await apiRequest<ThemeInstallationSummary>(`/tenants/${me.activeTenant.id}/websites/${id}/themes`, {
          method: "POST",
          body: JSON.stringify({
            name: themeName,
            themeId: selectedThemeId,
          }),
        });
      }
      setThemeName("Portal Modern");
      setSelectedThemeId("portal-modern");
      setThemeSource("library");
      setThemePriceFilter("all");
      setThemeCategoryFilter("all");
      setUploadedThemeFile(null);
      setCreateThemeOpen(false);
      toast.success(uploadingZip ? "Theme ZIP uploaded with all source files" : "Theme created");
      await refresh();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Theme creation failed");
    }
  }

  async function duplicateTheme(theme: ThemeInstallationSummary) {
    if (!me?.activeTenant) {
      return;
    }

    await apiRequest<ThemeInstallationSummary>(`/tenants/${me.activeTenant.id}/websites/${id}/themes`, {
      method: "POST",
      body: JSON.stringify({ name: `${theme.name} copy`, sourceInstallationId: theme.id }),
    });
    toast.success("Theme duplicated");
    await refresh();
  }

  async function publishTheme(theme: ThemeInstallationSummary) {
    if (!me?.activeTenant) {
      return;
    }

    await apiRequest<ThemeInstallationSummary>(`/tenants/${me.activeTenant.id}/websites/${id}/themes/${theme.id}/publish`, {
      method: "POST",
    });
    toast.success("Theme published");
    await refresh();
  }

  async function deleteTheme(theme: ThemeInstallationSummary) {
    if (!me?.activeTenant) {
      return;
    }

    await apiRequest(`/tenants/${me.activeTenant.id}/websites/${id}/themes/${theme.id}`, { method: "DELETE" });
    toast.success("Theme deleted");
    await refresh();
  }

  async function openThemeHistory(theme: ThemeInstallationSummary) {
    if (!me?.activeTenant) {
      return;
    }
    const [versionsResponse, historyResponse] = await Promise.all([
      apiRequest<ThemeVersionSummary[]>(`/tenants/${me.activeTenant.id}/websites/${id}/themes/${theme.id}/versions`),
      apiRequest<ThemeRevisionSummary[]>(`/tenants/${me.activeTenant.id}/websites/${id}/themes/${theme.id}/history`),
    ]);
    setThemeVersions(versionsResponse);
    setThemeHistory(historyResponse);
    setHistoryTheme(theme);
  }

  async function restoreThemeVersion(version: ThemeVersionSummary) {
    if (!me?.activeTenant || !historyTheme) {
      return;
    }
    await apiRequest<ThemeDraftSummary>(
      `/tenants/${me.activeTenant.id}/websites/${id}/themes/${historyTheme.id}/versions/${version.id}/restore`,
      { method: "POST" },
    );
    toast.success(`Restored version ${version.versionNumber} as a new draft`);
    setHistoryTheme(null);
    await refresh();
  }

  /**
   * A theme's template list mixes page templates (about, contact, case-studies, ...) with any
   * blog-specific one(s) it ships (typically "blog", sometimes "article"/"post") — offering the
   * whole list for a blog post let a merchant pick "about" or leave it on the generic "page"
   * template by default, so the theme's real blog layout never actually got used. Falls back to
   * the full list for a theme with no blog-named template at all, rather than showing nothing.
   */
  const blogTemplateOptions = useMemo(
    () => templateOptions.filter((template) => /blog|article|post/i.test(template.id) || /blog|article|post/i.test(template.name)),
    [templateOptions],
  );
  const relevantTemplateOptions = section === "blogs" && blogTemplateOptions.length ? blogTemplateOptions : templateOptions;

  /** Homepages get the theme's home template; every other page defaults to its generic "page" template (or the theme's blog template, for blogs). */
  function defaultTemplateId(forHomePage: boolean): string {
    const candidates = relevantTemplateOptions;
    if (!candidates.length) {
      return "";
    }
    const preferred = forHomePage
      ? candidates.find((template) => isHomeTemplateId(template.id))
      : (candidates.find((template) => template.id === "page") ?? candidates.find((template) => !isHomeTemplateId(template.id)));
    return preferred?.id ?? candidates[0]?.id ?? "";
  }

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest<PageSummary>(listEndpoint, {
        method: "POST",
        body: JSON.stringify({
          title: pageTitle,
          slug: pageSlug,
          isHomePage: section === "pages" ? isHomePage : false,
          templateId: pageTemplateId || null,
          blogCategoryId: section === "blogs" ? pageBlogCategoryId || null : undefined,
          kind: contentKind,
        }),
      });
      setPageTitle("");
      setPageSlug("");
      setPageSlugTouched(false);
      setIsHomePage(false);
      setPageTemplateId(defaultTemplateId(false));
      setPageBlogCategoryId("");
      setCreatePageOpen(false);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `${contentLabels.singularTitleCase} creation failed`);
    }
  }

  function openEditPage(page: PageSummary) {
    const pageIsHomePage = website?.homePageId === page.id;
    setEditingPage(page);
    setEditingPageTitle(page.title);
    setEditingPageSlug(page.slug);
    setEditingPageIsHomePage(pageIsHomePage);
    setEditingPageTemplateId(page.templateId ?? defaultTemplateId(pageIsHomePage));
    setEditingPageStatus(page.status);
    setEditingPageBlogCategoryId(page.blogCategoryId ?? "");
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!editingPage) {
      return;
    }

    try {
      await apiRequest<PageSummary>(`/${itemEndpointBase}/${editingPage.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editingPageTitle,
          slug: editingPageSlug,
          isHomePage: section === "pages" ? editingPageIsHomePage : false,
          templateId: editingPageTemplateId || null,
          blogCategoryId: section === "blogs" ? editingPageBlogCategoryId || null : undefined,
          status: editingPageStatus,
        }),
      });
      setEditingPage(null);
      toast.success(`${contentLabels.singularTitleCase} updated`);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `${contentLabels.singularTitleCase} update failed`);
    }
  }

  async function archivePage(page: PageSummary) {
    await apiRequest(`/${itemEndpointBase}/${page.id}/archive`, { method: "POST" });
    await refresh();
  }

  async function clonePage(page: PageSummary) {
    const toastId = toast.loading(`Cloning ${page.title}...`, { position: "top-right" });
    try {
      await apiRequest<PageSummary>(`/${itemEndpointBase}/${page.id}/clone`, { method: "POST" });
      toast.success(`${page.title} cloned successfully`, { id: toastId, position: "top-right" });
      await refresh();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : `${contentLabels.singularTitleCase} clone failed`, { id: toastId, position: "top-right" });
    }
  }

  function applyPageControls() {
    setPageQuery(pageSearchInput.trim());
    setPageSizeChoice(pageSizeInputChoice);
    setCustomPageSize(pendingPagesPerPage);
  }

  function clearPageControls() {
    setPageSearchInput("");
    setPageQuery("");
    setPageStatusFilter("all");
    setPageSizeInputChoice(String(defaultPagesPerPage));
    setPageSizeChoice(String(defaultPagesPerPage));
    setCustomPageSizeInput(defaultPagesPerPage);
    setCustomPageSize(defaultPagesPerPage);
    setBlogCategoryFilter("all");
    setSelectedPageIds(new Set());
  }

  function togglePageSelection(pageId: string, checked: boolean) {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(pageId);
      } else {
        next.delete(pageId);
      }
      return next;
    });
  }

  function toggleVisiblePageSelection(checked: boolean) {
    setSelectedPageIds((current) => {
      const next = new Set(current);
      for (const pageId of visibleSelectablePageIds) {
        if (checked) {
          next.add(pageId);
        } else {
          next.delete(pageId);
        }
      }
      return next;
    });
  }

  async function bulkPageAction(action: "PUBLISH" | "DRAFT" | "ARCHIVE" | "DELETE") {
    if (!selectedPageIds.size) {
      return;
    }

    setIsBulkUpdatingPages(true);
    try {
      const response = await apiRequest<{ count: number }>(`/${itemEndpointBase}/bulk`, {
        method: "POST",
        body: JSON.stringify({ pageIds: Array.from(selectedPageIds), action }),
      });
      setSelectedPageIds(new Set());
      const actionLabel = action === "PUBLISH" ? "published" : action === "DRAFT" ? "moved to draft" : action === "ARCHIVE" ? "archived" : "deleted";
      toast.success(`${response.count} page${response.count === 1 ? "" : "s"} ${actionLabel}`);
      await refresh();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Bulk page action failed");
    } finally {
      setIsBulkUpdatingPages(false);
    }
  }

  async function createBlogCategory() {
    const name = newBlogCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }

    setIsCreatingBlogCategory(true);
    try {
      const category = await apiRequest<BlogCategorySummary>(`/websites/${id}/blog-categories`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setBlogCategories((current) => [...current, category].sort((first, second) => first.name.localeCompare(second.name)));
      setPageBlogCategoryId(category.id);
      setEditingPageBlogCategoryId(category.id);
      setNewBlogCategoryName("");
      toast.success("Blog category created");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Blog category creation failed");
    } finally {
      setIsCreatingBlogCategory(false);
    }
  }

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!me?.activeTenant) {
      return;
    }

    try {
      const createdDomain = await apiRequest<DomainSummary>(`/tenants/${me.activeTenant.id}/websites/${id}/domains`, {
        method: "POST",
        body: JSON.stringify({ hostname, isPrimary: domains.length === 0 }),
      });
      setHostname("");
      setSelectedDomain(createdDomain);
      toast.success("Domain added");
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Domain creation failed");
    }
  }

  async function saveDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!me?.activeTenant || !editingDomain) {
      return;
    }

    try {
      const updatedDomain = await apiRequest<DomainSummary>(`/tenants/${me.activeTenant.id}/domains/${editingDomain.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hostname: editingHostname }),
      });
      setEditingDomain(null);
      setEditingHostname("");
      setSelectedDomain(updatedDomain);
      toast.success("Domain updated");
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Domain update failed");
    }
  }

  async function domainAction(domainId: string, action: "set-primary" | "verify" | "disable") {
    if (!me?.activeTenant) {
      return;
    }

    const updatedDomain = await apiRequest<DomainSummary>(`/tenants/${me.activeTenant.id}/domains/${domainId}/${action}`, { method: "POST" });
    setSelectedDomain(action === "disable" ? null : updatedDomain);
    await refresh();
  }

  async function refreshDomainStatus(domainId: string) {
    if (!me?.activeTenant) {
      return;
    }

    setRefreshingDomainId(domainId);
    try {
      const updatedDomain = await apiRequest<DomainSummary>(`/tenants/${me.activeTenant.id}/domains/${domainId}/verify`, { method: "POST" });
      setSelectedDomain(updatedDomain);
      toast.success(updatedDomain.verificationStatus === "VERIFIED" ? "Domain connected" : "Domain status refreshed");
      await refresh();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Domain status refresh failed");
    } finally {
      setRefreshingDomainId(null);
    }
  }

  async function saveWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!me?.activeTenant) {
      return;
    }

    try {
      const response = await apiRequest<WebsiteSummary>(`/tenants/${me.activeTenant.id}/websites/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, slug }),
      });
      setWebsite(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Website update failed");
    }
  }

  async function publishWebsite() {
    if (!me?.activeTenant) {
      return;
    }

    const response = await apiRequest<WebsiteSummary>(`/tenants/${me.activeTenant.id}/websites/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    setWebsite(response);
    toast.success("Website is live");
    await refresh();
  }

  async function archiveWebsite() {
    if (!me?.activeTenant) {
      return;
    }

    await apiRequest(`/tenants/${me.activeTenant.id}/websites/${id}/archive`, { method: "POST" });
    router.push("/websites");
  }

  if (!me || !website) {
    if (hasLoadedDashboardShell && me) {
      return (
        <DashboardShell
          title="Loading website"
          eyebrow="Website"
          description="Loading the latest website data."
          me={me}
          tenants={tenants}
          breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Websites", href: "/websites" }]}
          onTenantChange={switchTenant}
        >
          <LoadingState label="Loading website" contentOnly />
        </DashboardShell>
      );
    }
    return <LoadingState label="Loading website" contentOnly={hasLoadedDashboardShell} />;
  }

  const currentTheme = themes.find((theme) => theme.status === "PUBLISHED") ?? themes[0] ?? null;
  const otherThemes = currentTheme ? themes.filter((theme) => theme.id !== currentTheme.id) : themes;
  const themeCategories = ["all", ...Array.from(new Set(themeCatalog.map((theme) => theme.category).filter(Boolean)))];
  const filteredThemeCatalog = themeCatalog.filter((theme) => {
    const matchesPrice =
      themePriceFilter === "all" ||
      (themePriceFilter === "free" ? theme.tags.includes("free") || !theme.tags.includes("paid") : theme.tags.includes("paid"));
    const matchesCategory = themeCategoryFilter === "all" || theme.category === themeCategoryFilter;
    return matchesPrice && matchesCategory;
  });
  const activeSelectedDomain = selectedDomain ? domains.find((domain) => domain.id === selectedDomain.id) ?? selectedDomain : domains[0] ?? null;
  const verifiedDomain = domains.find((domain) => domain.status === "VERIFIED" && domain.verificationStatus === "VERIFIED") ?? null;
  const customDomainUrl = verifiedDomain ? `https://${verifiedDomain.hostname}` : null;
  const portalPreviewUrl = buildPortalPreviewUrl(website.id);

  return (
    <DashboardShell
      title={website.name}
      eyebrow="Website"
      description="Manage this website through dedicated pages for content, domains, and settings."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Websites", href: "/websites" }, { label: website.name }]}
      actions={
        <WebsiteViewActions
          website={website}
          customDomainUrl={customDomainUrl}
          portalPreviewUrl={portalPreviewUrl}
          onPublishWebsite={() => void publishWebsite()}
        />
      }
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      {isPageListSection ? (
        <>
          <Card>
            <SectionHeader
              title={contentLabels.pluralTitle}
              description={contentLabels.sectionDescription}
              actions={
                <div className="flex flex-wrap gap-2">
                   <Button
                    type="button"
                    onClick={() => {
                      setPageTemplateId(defaultTemplateId(false));
                      setCreatePageOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    {contentLabels.createLabel}
                  </Button>
                </div>
              }
            />
            <Tabs tabs={pageFilterTabs} value={pageStatusFilter} onChange={setPageStatusFilter} />
            <form
              className="grid gap-3 rounded-lg border bg-surface-secondary/40 p-3 lg:grid-cols-[minmax(240px,1fr)_minmax(150px,auto)_minmax(150px,auto)_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                applyPageControls();
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={pageSearchInput}
                  onChange={(event) => setPageSearchInput(event.target.value)}
                  placeholder="Search title, slug, status"
                  type="search"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select
                  aria-label={`${contentLabels.pluralTitle} per page`}
                  value={pageSizeInputChoice}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setPageSizeInputChoice(nextValue);
                    if (nextValue === "custom") {
                      setCustomPageSizeInput(pagesPerPage);
                    }
                  }}
                >
                  {pageSizePresets.map((preset) => (
                    <option key={preset} value={preset}>{preset} / page</option>
                  ))}
                  <option value="custom">Custom</option>
                </Select>
                {pageSizeInputChoice === "custom" ? (
                  <Input
                    aria-label={`Custom ${contentLabels.pluralTitle.toLowerCase()} per page`}
                    className="w-20"
                    type="number"
                    min={1}
                    max={500}
                    value={customPageSizeInput}
                    onChange={(event) => setCustomPageSizeInput(Math.max(1, Number(event.target.value) || 1))}
                  />
                ) : null}
              </div>
              {section === "blogs" ? (
                <Select
                  aria-label="Blog category filter"
                  value={blogCategoryFilter}
                  onChange={(event) => setBlogCategoryFilter(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {blogCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
              ) : (
                <span className="hidden lg:block" aria-hidden="true" />
              )}
              <Button type="submit" disabled={!hasPendingPageControls || isLoadingPages}>
                <SearchCheck className="size-4" />
                Apply
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={clearPageControls}
              >
                <Filter className="size-4" />
                Clear
              </Button>
            </form>
            {isLoadingPages ? (
              <PagesTableSkeleton />
            ) : visiblePages.length ? (
              <>
                {selectedPages.length ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface-secondary/45 p-3">
                    <p className="text-[12.5px] font-semibold text-foreground">
                      {selectedPages.length} selected
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="secondary" disabled={isBulkUpdatingPages} onClick={() => void bulkPageAction("PUBLISH")}>
                        <Rocket className="size-4" />
                        Publish
                      </Button>
                      <Button type="button" size="sm" variant="secondary" disabled={isBulkUpdatingPages} onClick={() => void bulkPageAction("DRAFT")}>
                        <Edit3 className="size-4" />
                        Draft
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={isBulkUpdatingPages}
                        onClick={() => setConfirm({ title: `Archive ${contentLabels.pluralTitle.toLowerCase()}`, description: `Archive ${selectedPages.length} selected ${contentLabels.singularTitle}${selectedPages.length === 1 ? "" : "s"}?`, action: () => void bulkPageAction("ARCHIVE") })}
                      >
                        <Archive className="size-4" />
                        Archive
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={isBulkUpdatingPages}
                        onClick={() => setConfirm({ title: `Permanently delete ${contentLabels.pluralTitle.toLowerCase()}`, description: `Permanently delete ${selectedPages.length} selected ${contentLabels.singularTitle}${selectedPages.length === 1 ? "" : "s"}? This cannot be undone.`, action: () => void bulkPageAction("DELETE") })}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : null}
                <Table
                  headers={[
                    <input
                      key="select"
                      aria-label={`Select visible ${contentLabels.pluralTitle.toLowerCase()}`}
                      className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      type="checkbox"
                      checked={allVisiblePagesSelected}
                      onChange={(event) => toggleVisiblePageSelection(event.target.checked)}
                    />,
                    contentLabels.singularTitleCase,
                    "Slug",
                    ...(section === "blogs" ? ["Category"] : []),
                    "Status",
                    "Updated",
                    "Actions",
                  ]}
                >
                  {visiblePages.map((page) => (
                    <tr key={page.id} className="hover:bg-surface-secondary/70">
                      <td>
                        <input
                          aria-label={`Select ${page.title}`}
                          className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          type="checkbox"
                          checked={selectedPageIds.has(page.id)}
                          onChange={(event) => togglePageSelection(page.id, event.target.checked)}
                        />
                      </td>
                      <td className="font-semibold text-foreground">{page.title}</td>
                      <td className="text-muted-foreground">/{page.slug}</td>
                      {section === "blogs" ? (
                        <td className="text-muted-foreground">{page.blogCategoryId ? blogCategoryById.get(page.blogCategoryId)?.name ?? "Unknown" : "Uncategorized"}</td>
                      ) : null}
                      <td><StatusBadge status={page.status} /></td>
                      <td className="text-muted-foreground">{new Date(page.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button asChild type="button" size="sm" variant="secondary">
                            <Link href={section === "blogs" ? `/builder/blog/${page.id}` : `/builder/pages/${page.id}`}>
                              <Code2 className="size-4" />
                              Builder
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => openEditPage(page)}>
                            <Edit3 className="size-4" />
                            Edit
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setSeoPage(page)}>
                            <SearchCheck className="size-4" />
                            SEO
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void clonePage(page)}>
                            <Copy className="size-4" />
                            Clone
                          </Button>
                          <IconButton
                            label={`Archive ${page.title}`}
                            disabled={page.status === "ARCHIVED"}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setConfirm({ title: `Archive ${contentLabels.singularTitle}`, description: `Archive ${page.title}?`, action: () => void archivePage(page) })}
                          >
                            <Archive className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
                <Pagination
                  hasPrevious={pageIndex > 0}
                  hasNext={pageIndex + 1 < pageCount}
                  label={`Page ${pageIndex + 1} of ${pageCount}`}
                  onPrevious={() => setPageIndex((current) => Math.max(0, current - 1))}
                  onNext={() => setPageIndex((current) => current + 1)}
                />
              </>
            ) : (
              <EmptyState title={contentLabels.emptyTitle} description={contentLabels.emptyDescription} />
            )}
          </Card>
          <Sheet open={createPageOpen} title={contentLabels.createLabel} onClose={() => setCreatePageOpen(false)}>
            <form className="grid gap-4" onSubmit={createPage}>
              <Field label="Title">
                <Input
                  value={pageTitle}
                  onChange={(event) => setPageTitle(event.target.value)}
                  required
                />
              </Field>
              <Field label="Slug" hint={contentLabels.slugHint}>
                <Input
                  value={pageSlug}
                  onChange={(event) => {
                    setPageSlugTouched(true);
                    setPageSlug(slugify(event.target.value));
                  }}
                  required
                />
              </Field>
              {relevantTemplateOptions.length ? (
                <Field label="Template" hint={`Controls which theme layout this ${contentLabels.singularTitle} opens with in the builder.`}>
                  <Select value={pageTemplateId} onChange={(event) => setPageTemplateId(event.target.value)}>
                    {relevantTemplateOptions.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {section === "blogs" ? (
                <BlogCategoryFields
                  categories={blogCategories}
                  value={pageBlogCategoryId}
                  newCategoryName={newBlogCategoryName}
                  creating={isCreatingBlogCategory}
                  onChange={setPageBlogCategoryId}
                  onNewCategoryNameChange={setNewBlogCategoryName}
                  onCreateCategory={() => void createBlogCategory()}
                />
              ) : null}
              {section === "pages" ? (
                <Checkbox
                  label="Set as homepage"
                  checked={isHomePage}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIsHomePage(checked);
                    setPageTemplateId(defaultTemplateId(checked));
                  }}
                />
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCreatePageOpen(false)}>Cancel</Button>
                <Button type="submit"><Plus className="size-4" />{contentLabels.createLabel}</Button>
              </div>
            </form>
          </Sheet>
          <Sheet open={Boolean(editingPage)} title={`Edit ${contentLabels.singularTitle}`} onClose={() => setEditingPage(null)}>
            <form className="grid gap-4" onSubmit={savePage}>
              <Field label="Title">
                <Input
                  value={editingPageTitle}
                  onChange={(event) => setEditingPageTitle(event.target.value)}
                  required
                />
              </Field>
              <Field label="Slug" hint={contentLabels.slugHint}>
                <Input
                  value={editingPageSlug}
                  onChange={(event) => setEditingPageSlug(slugify(event.target.value))}
                  required
                />
              </Field>
              <Field label="Status" hint={`Publish a draft version to make ${contentLabels.singularTitle} content live.`}>
                <Select
                  value={editingPageStatus}
                  onChange={(event) => setEditingPageStatus(event.target.value as PageSummary["status"])}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </Select>
              </Field>
              {relevantTemplateOptions.length ? (
                <Field label="Template" hint={`Controls which theme layout this ${contentLabels.singularTitle} opens with in the builder.`}>
                  <Select value={editingPageTemplateId} onChange={(event) => setEditingPageTemplateId(event.target.value)}>
                    {relevantTemplateOptions.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {section === "blogs" ? (
                <BlogCategoryFields
                  categories={blogCategories}
                  value={editingPageBlogCategoryId}
                  newCategoryName={newBlogCategoryName}
                  creating={isCreatingBlogCategory}
                  onChange={setEditingPageBlogCategoryId}
                  onNewCategoryNameChange={setNewBlogCategoryName}
                  onCreateCategory={() => void createBlogCategory()}
                />
              ) : null}
              {section === "pages" ? (
                <Checkbox
                  label="Set as homepage"
                  checked={editingPageIsHomePage}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setEditingPageIsHomePage(checked);
                    setEditingPageTemplateId(defaultTemplateId(checked));
                  }}
                />
              ) : null}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditingPage(null)}>Cancel</Button>
                <Button type="submit"><CheckCircle2 className="size-4" />Save {contentLabels.singularTitle}</Button>
              </div>
            </form>
          </Sheet>
          <PageSeoSettingsModal
            page={seoPage}
            website={website}
            open={Boolean(seoPage)}
            onClose={() => setSeoPage(null)}
            endpointBase={itemEndpointBase}
          />
          {me.activeTenant ? (
            <WebsiteThemeSettingsModal
              tenantId={me.activeTenant.id}
              website={website}
              open={themeOpen}
              onClose={() => setThemeOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      {section === "domains" ? (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
          {activeSelectedDomain ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Globe2 className="size-[18px]" />
                  </div>
                  <div>
                    <h2 className="text-[14.5px] font-semibold leading-5 text-foreground">Custom domain</h2>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">One custom domain can be attached to this website.</p>
                  </div>
                </div>
                <DomainBadge status={activeSelectedDomain.verificationStatus} />
              </div>
              <div className="grid gap-3 rounded-lg border bg-surface-secondary/45 p-3.5">
                <div className="flex items-start gap-2.5">
                  {activeSelectedDomain.verificationStatus === "VERIFIED" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <RefreshCw className="mt-0.5 size-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0">
                    <p className="break-all text-base font-semibold text-foreground">{activeSelectedDomain.hostname}</p>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      {activeSelectedDomain.verificationStatus === "VERIFIED" ? "DNS is connected." : "DNS is not connected yet."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingDomain(activeSelectedDomain);
                      setEditingHostname(activeSelectedDomain.hostname);
                    }}
                  >
                    <Edit3 className="size-4" />
                    Edit domain
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={refreshingDomainId === activeSelectedDomain.id}
                    onClick={() => void refreshDomainStatus(activeSelectedDomain.id)}
                  >
                    <RefreshCw className={refreshingDomainId === activeSelectedDomain.id ? "size-4 animate-spin" : "size-4"} />
                    Refresh DNS
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setConfirm({
                        title: "Disable domain",
                        description: `Disable ${activeSelectedDomain.hostname}? You can add another domain after this one is disabled.`,
                        action: () => void domainAction(activeSelectedDomain.id, "disable"),
                      })
                    }
                  >
                    Disable domain
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Globe2 className="size-[18px]" />
                </div>
                <div>
                  <h2 className="text-[14.5px] font-semibold leading-5 text-foreground">Add domain</h2>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">Attach one hostname to this website.</p>
                </div>
              </div>
              <form className="grid gap-4" onSubmit={addDomain}>
                <Field label="Hostname"><Input value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="example.com" required /></Field>
                <Button type="submit" className="w-fit"><Plus className="size-4" />Add domain</Button>
              </form>
            </Card>
          )}

          <DomainSetupCard
            domain={activeSelectedDomain}
            website={website}
            refreshing={refreshingDomainId === activeSelectedDomain?.id}
            onRefresh={(domainId) => void refreshDomainStatus(domainId)}
          />

          <Sheet open={Boolean(editingDomain)} title="Edit domain" onClose={() => setEditingDomain(null)}>
            <form className="grid gap-4" onSubmit={saveDomain}>
              <Field label="Hostname" hint="Changing the hostname resets verification until the new DNS records are connected.">
                <Input value={editingHostname} onChange={(event) => setEditingHostname(event.target.value)} placeholder="example.com" required />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditingDomain(null)}>Cancel</Button>
                <Button type="submit"><CheckCircle2 className="size-4" />Save domain</Button>
              </div>
            </form>
          </Sheet>
        </section>
      ) : null}

      {section === "themes" ? (
        <>
          <section className="grid items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <Card>
              <div className="rounded-lg border bg-surface-secondary/60 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Palette className="size-[18px]" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-foreground">Theme studio</h2>
                <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
                  Install platform themes, customize drafts, edit source, and publish only when ready.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border bg-surface-secondary/40 p-3">
                  <p className="text-2xl font-bold text-foreground">{themes.length}</p>
                  <p className="text-xs text-muted-foreground">Themes</p>
                </div>
                <div className="rounded-lg border bg-surface-secondary/40 p-3">
                  <p className="text-2xl font-bold text-foreground">
                    {themes.filter((theme) => theme.status === "PUBLISHED").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Live</p>
                </div>
                <div className="rounded-lg border bg-surface-secondary/40 p-3">
                  <p className="text-2xl font-bold text-foreground">
                    {themes.reduce((total, theme) => total + theme._count.versions, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Versions</p>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader
                title="Current theme"
                description="The published theme is what visitors see. Draft edits stay private until publish."
                actions={
                  <Button type="button" onClick={() => setCreateThemeOpen(true)}>
                    <Plus className="size-4" />
                    Add theme
                  </Button>
                }
              />
              {currentTheme ? (
                <div className="rounded-lg border bg-surface-secondary/30 p-4">
                  <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <ThemePreviewCard theme={currentTheme} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-bold tracking-tight text-foreground">{currentTheme.name}</h3>
                          <p className="mt-1 text-[12.5px] text-muted-foreground">
                            Version {currentTheme.activeVersion?.versionNumber ?? "draft"} · {currentTheme.themePackage.name}
                          </p>
                        </div>
                        <ThemeStatusBadge status={currentTheme.status} />
                      </div>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {currentTheme.description ?? "Editable platform theme for this website."}
                      </p>
                      <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                        <Button asChild type="button" size="sm">
                          <Link href={`/websites/${id}/themes/${currentTheme.id}/customize`}>
                            <Palette className="size-4" />
                            Customize
                          </Link>
                        </Button>
                        <Button asChild type="button" size="sm" variant="secondary">
                          <Link href={`/websites/${id}/themes/${currentTheme.id}/preview`} target="_blank" rel="noreferrer">
                            <Eye className="size-4" />
                            Preview
                          </Link>
                        </Button>
                        <Button asChild type="button" size="sm" variant="secondary">
                          <Link href={`/websites/${id}/themes/${currentTheme.id}/code`} target="_blank" rel="noreferrer">
                            <Code2 className="size-4" />
                            Edit code
                          </Link>
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => void duplicateTheme(currentTheme)}>
                          <Copy className="size-4" />
                          Duplicate
                        </Button>
                        <Button type="button" size="sm" variant="secondary" onClick={() => void openThemeHistory(currentTheme)}>
                          <History className="size-4" />
                          History
                        </Button>
                        <Button type="button" size="sm" disabled={currentTheme.status === "PUBLISHED"} onClick={() => void publishTheme(currentTheme)}>
                          <Rocket className="size-4" />
                          Publish
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No current theme"
                  description="Install Portal Modern to create a real editable theme for this website."
                  action={<Button type="button" onClick={() => setCreateThemeOpen(true)}><Plus className="size-4" />Add theme</Button>}
                />
              )}
            </Card>
          </section>

          <Card>
            <SectionHeader title="Other themes" description="Draft and alternate themes stay independent until you publish them." />
            {otherThemes.length ? (
                <Table headers={["Theme", "Source", "Status", "Version", "Activity", "Actions"]}>
                  {otherThemes.map((theme) => (
                    <tr key={theme.id} className="hover:bg-surface-secondary/70">
                      <td>
                        <div className="font-semibold text-foreground">{theme.name}</div>
                        <div className="text-xs text-muted-foreground">{theme.description ?? "Editable website theme"}</div>
                      </td>
                      <td>
                        <div className="text-foreground">{theme.themePackage.name}</div>
                        <div className="text-xs text-muted-foreground">{theme.themePackage.source.toLowerCase()}</div>
                      </td>
                      <td><ThemeStatusBadge status={theme.status} /></td>
                      <td className="text-muted-foreground">
                        {theme.activeVersion ? `v${theme.activeVersion.versionNumber}` : "Draft only"}
                      </td>
                      <td className="text-muted-foreground">
                        {theme._count.revisions} changes · {new Date(theme.updatedAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button asChild type="button" size="icon" variant="secondary" aria-label={`Customize ${theme.name}`}>
                            <Link href={`/websites/${id}/themes/${theme.id}/customize`}>
                              <Palette className="size-4" />
                            </Link>
                          </Button>
                          <Button asChild type="button" size="icon" variant="secondary" aria-label={`Preview ${theme.name}`}>
                            <Link href={`/websites/${id}/themes/${theme.id}/preview`} target="_blank" rel="noreferrer">
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <IconButton label={`Duplicate ${theme.name}`} onClick={() => void duplicateTheme(theme)}>
                            <Copy className="size-4" />
                          </IconButton>
                          <Button asChild type="button" size="icon" variant="secondary" aria-label={`Edit ${theme.name} code`}>
                            <Link href={`/websites/${id}/themes/${theme.id}/code`} target="_blank" rel="noreferrer">
                              <Code2 className="size-4" />
                            </Link>
                          </Button>
                          <IconButton label={`View ${theme.name} history`} onClick={() => void openThemeHistory(theme)}>
                            <History className="size-4" />
                          </IconButton>
                          <IconButton
                            label={`Publish ${theme.name}`}
                            variant="primary"
                            disabled={theme.status === "PUBLISHED"}
                            onClick={() => void publishTheme(theme)}
                          >
                            <Rocket className="size-4" />
                          </IconButton>
                          <IconButton
                            label={`Delete ${theme.name}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={theme.status === "PUBLISHED"}
                            onClick={() => setConfirm({ title: "Delete theme", description: `Delete ${theme.name}?`, action: () => void deleteTheme(theme) })}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <EmptyState title="No other themes" description="Duplicate Portal Modern or add another registered platform theme." />
              )}
          </Card>

          <Modal
            open={createThemeOpen}
            title="Add theme"
            description="Choose a theme from the portal library or upload a custom package."
            className="max-w-7xl"
            onClose={() => setCreateThemeOpen(false)}
          >
            <form className="grid gap-5 p-5" onSubmit={createTheme}>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className={`grid gap-2 rounded-lg border p-4 text-left transition-colors ${themeSource === "library" ? "border-primary bg-primary/5 shadow-sm shadow-slate-950/5" : "bg-surface hover:bg-surface-secondary"}`}
                  onClick={() => setThemeSource("library")}
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Library className="size-4" />
                  </span>
                  <span className="font-semibold text-foreground">Portal library</span>
                  <span className="text-xs leading-5 text-muted-foreground">Choose free or paid themes from the platform catalog.</span>
                </button>
                <button
                  type="button"
                  className={`grid gap-2 rounded-lg border p-4 text-left transition-colors ${themeSource === "upload" ? "border-primary bg-primary/5 shadow-sm shadow-slate-950/5" : "bg-surface hover:bg-surface-secondary"}`}
                  onClick={() => setThemeSource("upload")}
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-surface-secondary text-foreground">
                    <UploadCloud className="size-4" />
                  </span>
                  <span className="font-semibold text-foreground">Upload ZIP</span>
                  <span className="text-xs leading-5 text-muted-foreground">Upload a custom theme package for validation.</span>
                </button>
              </div>

              {themeSource === "library" ? (
                <>
                  <div className="grid gap-3 rounded-lg border bg-surface-secondary/40 p-3 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="flex flex-wrap gap-2">
                      {(["all", "free", "paid"] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold capitalize ${themePriceFilter === filter ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface/70"}`}
                          onClick={() => setThemePriceFilter(filter)}
                        >
                          {filter === "paid" ? <CreditCard className="size-4" /> : filter === "free" ? <Gift className="size-4" /> : <Library className="size-4" />}
                          {filter}
                        </button>
                      ))}
                      {themeCategories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${themeCategoryFilter === category ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface/70"}`}
                          onClick={() => setThemeCategoryFilter(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <Field label="Install name" className="text-sm">
                      <Input value={themeName} onChange={(event) => setThemeName(event.target.value)} required />
                    </Field>
                  </div>
                  {filteredThemeCatalog.length ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredThemeCatalog.map((theme) => {
                        const selected = selectedThemeId === theme.id;
                        const paid = theme.tags.includes("paid");
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            className={`grid gap-4 rounded-lg border bg-surface p-4 text-left shadow-sm shadow-slate-950/5 transition-colors ${selected ? "border-primary ring-2 ring-primary/15" : "hover:bg-surface-secondary/50"}`}
                            onClick={() => {
                              setSelectedThemeId(theme.id);
                              setThemeName(theme.name);
                            }}
                          >
                            <div className="aspect-[16/10] overflow-hidden rounded-lg border bg-surface-secondary">
                              <div className="flex h-9 items-center gap-2 border-b bg-surface px-3">
                                <span className="size-2 rounded-full bg-destructive/60" />
                                <span className="size-2 rounded-full bg-warning/60" />
                                <span className="size-2 rounded-full bg-success/60" />
                              </div>
                              <div className="grid gap-3 p-4">
                                <div className="h-8 rounded-md bg-primary" />
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="h-16 rounded-md bg-surface" />
                                  <div className="h-16 rounded-md bg-surface" />
                                  <div className="h-16 rounded-md bg-surface" />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-bold text-foreground">{theme.name}</h3>
                                <p className="mt-1 text-sm leading-6 text-muted-foreground">{theme.description}</p>
                              </div>
                              <Badge tone={paid ? "warning" : "success"}>{paid ? "paid" : "free"}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge tone="info">{theme.category}</Badge>
                              <Badge>v{theme.version}</Badge>
                              {selected ? <Badge tone="success">selected</Badge> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="No themes found" description="Try another price or category filter." />
                  )}
                </>
              ) : (
                <>
                  <label className="grid cursor-pointer justify-items-center gap-3 rounded-lg border border-dashed bg-surface-secondary/40 px-4 py-8 text-center transition-colors hover:bg-surface-secondary">
                    <UploadCloud className="size-8 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {uploadedThemeFile ? uploadedThemeFile.name : "Choose custom theme ZIP"}
                    </span>
                    <span className="max-w-xs text-sm leading-6 text-muted-foreground">
                      Accepted package: .zip with theme.config.ts, config, layout, templates, sections, components, assets, and locales.
                    </span>
                    <input
                      className="sr-only"
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      onChange={(event) => setUploadedThemeFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <Alert tone="info">ZIP packages upload all theme files into the database, including config, templates, sections, components, assets, CSS, and locale files.</Alert>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCreateThemeOpen(false)}>Cancel</Button>
                <Button type="submit">
                  {themeSource === "upload" ? <UploadCloud className="size-4" /> : <Plus className="size-4" />}
                  {themeSource === "upload" ? "Upload theme" : "Create theme"}
                </Button>
              </div>
            </form>
          </Modal>

          <ThemeHistoryModal
            theme={historyTheme}
            versions={themeVersions}
            history={themeHistory}
            open={Boolean(historyTheme)}
            onClose={() => {
              setHistoryTheme(null);
              setThemeVersions([]);
              setThemeHistory([]);
            }}
            onRestore={(version) => void restoreThemeVersion(version)}
          />
        </>
      ) : null}

      {section === "settings" ? (
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Settings className="size-[18px]" />
                </div>
                <div>
                  <h2 className="text-[14.5px] font-semibold leading-5 text-foreground">Website settings</h2>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
                    General details, search visibility, and account-level actions for this website.
                  </p>
                </div>
              </div>
              <StatusBadge status={website.status} />
            </div>

            <Tabs
              tabs={[
                { value: "general", label: "General" },
                { value: "seo", label: "SEO" },
                { value: "danger", label: "Danger zone" },
              ]}
              value={activeSettingsTab}
              onChange={(value) => {
                setActiveSettingsTab(value as SettingsTab);
                if (value !== "danger") setArchiveConfirmationInput("");
              }}
            />

            {activeSettingsTab === "general" ? (
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveWebsite}>
                <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
                <Field label="Slug" hint="Used for preview and internal URLs.">
                  <Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required />
                </Field>
                <div className="flex justify-end sm:col-span-2">
                  <Button type="submit"><CheckCircle2 className="size-4" />Save settings</Button>
                </div>
              </form>
            ) : null}

            {activeSettingsTab === "seo" ? (
              me?.activeTenant ? (
                <WebsiteSeoSettings activeTenantId={me.activeTenant.id} website={website} onSaved={setWebsite} />
              ) : (
                <p className="text-[12.5px] text-muted-foreground">SEO settings are unavailable right now.</p>
              )
            ) : null}

            {activeSettingsTab === "danger" ? (
              <div className="grid gap-3 rounded-lg border border-destructive/25 bg-destructive/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <ShieldAlert className="size-4" />
                  </div>
                  <div>
                    <p className="text-[12.5px] font-semibold text-foreground">Archive website</p>
                    <p className="mt-0.5 max-w-sm text-[11.5px] leading-5 text-muted-foreground">
                      Hides this website from visitors and removes it from active listings. It can be restored later.
                    </p>
                  </div>
                </div>
                <Field label={`Type "${website.name}" to confirm`}>
                  <Input
                    value={archiveConfirmationInput}
                    onChange={(event) => setArchiveConfirmationInput(event.target.value)}
                    placeholder={website.name}
                    autoComplete="off"
                  />
                </Field>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="danger"
                    disabled={archiveConfirmationInput.trim() !== website.name}
                    onClick={() =>
                      setConfirm({
                        title: "Archive website",
                        description: "Archive this website record? You can restore it later from Anthropic support or the archived-websites list.",
                        action: () => {
                          void archiveWebsite();
                          setArchiveConfirmationInput("");
                        },
                      })
                    }
                  >
                    <Archive className="size-4" />
                    Archive website
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Record details" eyebrow="Metadata">
            <div className="grid gap-2">
              <DetailRow label="Website ID" value={website.id} mono copyable />
              <DetailRow label="Created" value={new Date(website.createdAt).toLocaleString()} />
              <DetailRow label="Updated" value={new Date(website.updatedAt).toLocaleString()} />
            </div>
          </Card>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel="Confirm"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.action;
          setConfirm(null);
          action?.();
        }}
      />
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: WebsiteSummary["status"] | PageSummary["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

function BlogCategoryFields({
  categories,
  value,
  newCategoryName,
  creating,
  onChange,
  onNewCategoryNameChange,
  onCreateCategory,
}: {
  categories: BlogCategorySummary[];
  value: string;
  newCategoryName: string;
  creating: boolean;
  onChange: (value: string) => void;
  onNewCategoryNameChange: (value: string) => void;
  onCreateCategory: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-surface-secondary/35 p-3">
      <Field label="Category">
        <Select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="New category">
          <Input value={newCategoryName} onChange={(event) => onNewCategoryNameChange(event.target.value)} placeholder="News" />
        </Field>
        <div className="flex items-end">
          <Button type="button" variant="secondary" disabled={creating || !newCategoryName.trim()} onClick={onCreateCategory}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function PagesTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border bg-surface" role="status" aria-label="Loading pages">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[36px_minmax(150px,1.2fr)_minmax(120px,1fr)_90px_96px_minmax(220px,auto)] gap-3 border-b bg-surface-secondary px-3 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`pages-head-skeleton-${index}`} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, row) => (
          <div
            key={`pages-row-skeleton-${row}`}
            className="grid grid-cols-[36px_minmax(150px,1.2fr)_minmax(120px,1fr)_90px_96px_minmax(220px,auto)] gap-3 border-b px-3 py-3 last:border-b-0"
          >
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-5 w-44 max-w-full" />
            <Skeleton className="h-5 w-36 max-w-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-20" />
            <div className="flex justify-end gap-1.5">
              {Array.from({ length: 5 }).map((__, actionIndex) => (
                <Skeleton key={`pages-action-skeleton-${row}-${actionIndex}`} className="h-7 w-16 rounded-md" />
              ))}
            </div>
          </div>
        ))}
        <span className="sr-only">Loading pages</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface-secondary/35 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
        <p className={cn("mt-0.5 truncate text-[12.5px] text-foreground", mono && "font-mono")} title={value}>
          {value}
        </p>
      </div>
      {copyable ? (
        <button
          type="button"
          aria-label={`Copy ${label}`}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
          onClick={() => void copyToClipboard(value)}
        >
          <Copy className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function WebsiteViewActions({
  website,
  customDomainUrl,
  portalPreviewUrl,
  onPublishWebsite,
}: {
  website: WebsiteSummary;
  customDomainUrl: string | null;
  portalPreviewUrl: string;
  onPublishWebsite: () => void;
}) {
  return (
    <>
      {website.status !== "PUBLISHED" ? (
        <Button type="button" size="sm" onClick={onPublishWebsite}>
          <Rocket className="size-4" />
          Publish website
        </Button>
      ) : null}
      {customDomainUrl ? (
        <Button asChild variant="secondary" size="sm">
          <a href={customDomainUrl} target="_blank" rel="noreferrer">
            <Globe2 className="size-4" />
            View custom domain
          </a>
        </Button>
      ) : (
        <Button type="button" variant="secondary" size="sm" disabled>
          <Globe2 className="size-4" />
          Custom domain
        </Button>
      )}
      <Button asChild size="sm">
        <a href={portalPreviewUrl} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
          Portal test URL
        </a>
      </Button>
    </>
  );
}

function DomainSetupCard({
  domain,
  website,
  refreshing,
  onRefresh,
}: {
  domain: DomainSummary | null;
  website: WebsiteSummary;
  refreshing: boolean;
  onRefresh: (domainId: string) => void;
}) {
  if (!domain) {
    return (
      <Card>
        <SectionHeader title="Connection setup" description="Add a domain to see DNS connection steps." />
        <EmptyState title="No domain selected" description="Choose Setup on a domain after adding or editing it." />
      </Card>
    );
  }

  const connected = domain.status === "VERIFIED" && domain.verificationStatus === "VERIFIED";
  const cnameTarget = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET ?? `${website.slug}.stackbuilder.site`;
  const aRecordIp = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_A_RECORD_IP ?? "Configured StackBuilder hosting IP";
  const isWwwDomain = domain.hostname.startsWith("www.");
  const rootRecordName = isWwwDomain ? "www" : "@";
  const verificationName = `_stackbuilder.${domain.hostname}`;

  return (
    <Card className="gap-5">
      <SectionHeader
        title="Connection setup"
        description={domain.hostname}
        actions={
          <Button type="button" variant="secondary" size="sm" disabled={refreshing || connected} onClick={() => onRefresh(domain.id)}>
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
            Refresh status
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-3 rounded-lg border bg-surface-secondary/45 p-3">
        <div>
          <p className="text-[12px] font-semibold text-foreground">Connection status</p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {connected ? "This domain is connected and ready to serve." : "Add the DNS records below, then refresh the status."}
          </p>
        </div>
        <Badge tone={connected ? "success" : domain.verificationStatus === "FAILED" ? "danger" : "warning"}>
          {connected ? "connected" : "not connected"}
        </Badge>
      </div>

      <div className="grid gap-4">
        <DnsRecordStep
          index={1}
          title="Verify ownership (optional)"
          helper="Use this when you want portal-side ownership proof. Render verification plus A/CNAME routing can still connect the domain."
          rows={[
            ["Type", "TXT"],
            ["Name", verificationName],
            ["Value", domain.verificationToken],
          ]}
        />
        <DnsRecordStep
          index={2}
          title="Point the root domain"
          helper="Use this for root domains when your DNS provider cannot use CNAME flattening, ALIAS, or ANAME."
          rows={[
            ["Type", "A"],
            ["Name", "@"],
            ["Value", aRecordIp],
          ]}
        />
        <DnsRecordStep
          index={3}
          title={isWwwDomain ? "Point the www subdomain" : "Or use a CNAME (alternative)"}
          helper={isWwwDomain ? "Use this for www or another subdomain." : "Use this only if your DNS provider supports CNAME flattening, ALIAS, or ANAME at the root."}
          rows={[
            ["Type", "CNAME"],
            ["Name", rootRecordName],
            ["Value", cnameTarget],
          ]}
        />
      </div>

      <Alert tone="info">DNS changes can take a few minutes to propagate. Refresh DNS checks the CNAME or configured A record before marking the domain connected.</Alert>
    </Card>
  );
}

function DnsRecordStep({
  index,
  title,
  helper,
  rows,
}: {
  index: number;
  title: string;
  helper: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
        {index}
      </span>
      <div className="grid min-w-0 flex-1 gap-2.5">
        <div>
          <h3 className="text-[12.5px] font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{helper}</p>
        </div>
        <div className="divide-y overflow-hidden rounded-lg border">
          {rows.map(([label, value]) => (
            <div key={`${title}-${label}`} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="w-14 shrink-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
              <code className="min-w-0 flex-1 truncate text-[12px] text-foreground" title={value}>{value}</code>
              <button
                type="button"
                aria-label={`Copy ${label}`}
                className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
                onClick={() => void copyToClipboard(value)}
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DomainBadge({ status }: { status: DomainSummary["status"] | DomainSummary["verificationStatus"] }) {
  const tone = status === "VERIFIED" ? "success" : status === "FAILED" || status === "DISABLED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

function ThemeStatusBadge({ status }: { status: ThemeInstallationSummary["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

function ThemePreviewCard({ theme, compact }: { theme: ThemeInstallationSummary; compact?: boolean }) {
  const accent = typeof theme.metadata?.accent === "string" ? theme.metadata.accent : "#2563EB";
  return (
    <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-surface-secondary">
      <div className="flex h-10 items-center gap-2 border-b bg-surface px-3">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-warning/70" />
        <span className="size-2 rounded-full bg-success/70" />
      </div>
      <div className="grid gap-4 p-4">
        <div className="h-7 rounded-md" style={{ backgroundColor: accent }} />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 rounded-md bg-surface" />
          <div className="h-16 rounded-md bg-surface" />
          <div className="h-16 rounded-md bg-surface" />
        </div>
        {!compact ? <div className="h-20 rounded-md border bg-surface" /> : null}
      </div>
    </div>
  );
}

function ThemeHistoryModal({
  theme,
  versions,
  history,
  open,
  onClose,
  onRestore,
}: {
  theme: ThemeInstallationSummary | null;
  versions: ThemeVersionSummary[];
  history: ThemeRevisionSummary[];
  open: boolean;
  onClose: () => void;
  onRestore: (version: ThemeVersionSummary) => void;
}) {
  return (
    <Modal
      open={open}
      title={`History: ${theme?.name ?? "theme"}`}
      description="Published versions are immutable. Restore creates a new draft."
      onClose={onClose}
    >
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <Card title="Versions" eyebrow="Immutable">
          {versions.length ? (
            <Table headers={["Version", "Status", "Created", "Action"]}>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td className="font-semibold text-foreground">Version {version.versionNumber}</td>
                  <td><ThemeStatusBadge status={version.status} /></td>
                  <td className="text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</td>
                  <td className="text-right">
                    <Button type="button" size="sm" variant="secondary" onClick={() => onRestore(version)}>Restore</Button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title="No versions yet" description="Publish the theme to create version history." />
          )}
        </Card>
        <Card title="Activity" eyebrow="Draft changes">
          {history.length ? (
            <div className="grid gap-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border bg-surface-secondary/35 p-3">
                  <p className="font-semibold text-foreground">{item.message ?? item.changeType}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.changeType} · {item.changedFilesCount} files · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No activity yet" description="Customize, edit code, or publish to create history." />
          )}
        </Card>
      </div>
    </Modal>
  );
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }

  await navigator.clipboard.writeText(value);
  toast.success("Copied");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildPortalPreviewUrl(websiteId: string) {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_SITE_RENDERER_URL || process.env.NEXT_PUBLIC_PUBLIC_SITE_URL;
  const baseUrl = configuredBaseUrl || getDefaultPortalPreviewBaseUrl();

  return `${baseUrl.replace(/\/$/, "")}/preview/${websiteId}`;
}

function getDefaultPortalPreviewBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:3001";
  }

  return `${window.location.origin}/site`;
}