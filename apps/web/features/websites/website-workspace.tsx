"use client";

import { Archive, CheckCircle2, Code2, Copy, CreditCard, Edit3, ExternalLink, Eye, Filter, Gift, Globe2, History, Library, Palette, Plus, RefreshCw, Rocket, Search, SearchCheck, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { use, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader } from "../../components/ui/display";
import { Checkbox, Field, Input, Select } from "../../components/ui/form";
import { Pagination, Table } from "../../components/ui/navigation";
import { ConfirmDialog, Modal, Sheet } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import type {
  DomainSummary,
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

type WebsiteSection = "pages" | "themes" | "domains" | "settings";

const pageSize = 8;

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
  const [themes, setThemes] = useState<ThemeInstallationSummary[]>([]);
  const [themeCatalog, setThemeCatalog] = useState<ThemeDefinitionSummary[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageQuery, setPageQuery] = useState("");
  const [pageStatusFilter, setPageStatusFilter] = useState("all");
  const [pageParentFilter, setPageParentFilter] = useState("all");
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
  const [parentId, setParentId] = useState("");
  const [isHomePage, setIsHomePage] = useState(false);
  const [editingPage, setEditingPage] = useState<PageSummary | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState("");
  const [editingPageSlug, setEditingPageSlug] = useState("");
  const [editingPageParentId, setEditingPageParentId] = useState("");
  const [editingPageIsHomePage, setEditingPageIsHomePage] = useState(false);
  const [editingPageStatus, setEditingPageStatus] = useState<PageSummary["status"]>("DRAFT");
  const [seoPage, setSeoPage] = useState<PageSummary | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [historyTheme, setHistoryTheme] = useState<ThemeInstallationSummary | null>(null);
  const [themeVersions, setThemeVersions] = useState<ThemeVersionSummary[]>([]);
  const [themeHistory, setThemeHistory] = useState<ThemeRevisionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; description: string; action: () => void }>(null);

  const filteredPages = useMemo(() => {
    const normalized = pageQuery.trim().toLowerCase();
    return pages.filter((page) => {
      const matchesQuery = !normalized || `${page.title} ${page.slug} ${page.status}`.toLowerCase().includes(normalized);
      const matchesStatus = pageStatusFilter === "all" || page.status === pageStatusFilter;
      const matchesParent =
        pageParentFilter === "all" ||
        (pageParentFilter === "root" ? !page.parentId : page.parentId === pageParentFilter);
      return matchesQuery && matchesStatus && matchesParent;
    });
  }, [pageParentFilter, pageQuery, pageStatusFilter, pages]);

  const visiblePages = filteredPages.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredPages.length / pageSize));

  async function loadWebsite(activeTenant: ActiveTenant, domainCursor?: string) {
    const [websiteResponse, domainResponse, pagesResponse, themesResponse, catalogResponse] = await Promise.all([
      apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`),
      apiRequest<PageResult<DomainSummary>>(
        `/tenants/${activeTenant.id}/websites/${id}/domains?limit=${pageSize}${domainCursor ? `&cursor=${encodeURIComponent(domainCursor)}` : ""}`,
      ),
      apiRequest<PageSummary[]>(`/websites/${id}/pages`),
      apiRequest<ThemeInstallationSummary[]>(`/tenants/${activeTenant.id}/websites/${id}/themes`),
      apiRequest<ThemeDefinitionSummary[]>(`/tenants/${activeTenant.id}/websites/${id}/themes/catalog`),
    ]);

    setWebsite(websiteResponse);
    setName(websiteResponse.name);
    setSlug(websiteResponse.slug);
    setDomains((current) => (domainCursor ? [...current, ...domainResponse.data] : domainResponse.data));
    setPages(pagesResponse);
    setThemes(themesResponse);
    setThemeCatalog(catalogResponse);
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
  }, [pageParentFilter, pageQuery, pageStatusFilter]);

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

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest<PageSummary>(`/websites/${id}/pages`, {
        method: "POST",
        body: JSON.stringify({ title: pageTitle, slug: pageSlug, parentId: parentId || null, isHomePage }),
      });
      setPageTitle("");
      setPageSlug("");
      setPageSlugTouched(false);
      setParentId("");
      setIsHomePage(false);
      setCreatePageOpen(false);
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Page creation failed");
    }
  }

  function openEditPage(page: PageSummary) {
    setEditingPage(page);
    setEditingPageTitle(page.title);
    setEditingPageSlug(page.slug);
    setEditingPageParentId(page.parentId ?? "");
    setEditingPageIsHomePage(website?.homePageId === page.id);
    setEditingPageStatus(page.status);
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!editingPage) {
      return;
    }

    try {
      await apiRequest<PageSummary>(`/pages/${editingPage.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editingPageTitle,
          slug: editingPageSlug,
          parentId: editingPageParentId || null,
          isHomePage: editingPageIsHomePage,
          status: editingPageStatus,
        }),
      });
      setEditingPage(null);
      toast.success("Page updated");
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Page update failed");
    }
  }

  async function publishPageDraft(page: PageSummary) {
    if (!page.draftVersionId) {
      toast.error("Create or save a draft before publishing.");
      return;
    }

    await apiRequest(`/pages/${page.id}/versions/${page.draftVersionId}/publish`, { method: "POST" });
    toast.success(`${page.title} is live`);
    await refresh();
  }

  async function archivePage(page: PageSummary) {
    await apiRequest(`/pages/${page.id}/archive`, { method: "POST" });
    await refresh();
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

      <WebsiteViewPanel
        customDomainUrl={customDomainUrl}
        portalPreviewUrl={portalPreviewUrl}
        verifiedDomain={verifiedDomain}
      />

      {section === "pages" ? (
        <>
          <Card>
            <SectionHeader
              title="Pages"
              description="Search, filter, and open builder-ready pages for this website."
              actions={
                <div className="flex flex-wrap gap-2">
                  <ThemeButton onClick={() => setThemeOpen(true)} />
                  <Button type="button" onClick={() => setCreatePageOpen(true)}>
                    <Plus className="size-4" />
                    Create page
                  </Button>
                </div>
              }
            />
            <div className="grid gap-3 rounded-lg border bg-surface-secondary/40 p-3 lg:grid-cols-[minmax(260px,1fr)_190px_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={pageQuery}
                  onChange={(event) => setPageQuery(event.target.value)}
                  placeholder="Search title, slug, status"
                  type="search"
                />
              </div>
              <Select value={pageStatusFilter} onChange={(event) => setPageStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
              <Select value={pageParentFilter} onChange={(event) => setPageParentFilter(event.target.value)}>
                <option value="all">All parents</option>
                <option value="root">Root pages</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>{page.title}</option>
                ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPageQuery("");
                  setPageStatusFilter("all");
                  setPageParentFilter("all");
                }}
              >
                <Filter className="size-4" />
                Clear
              </Button>
            </div>
            {visiblePages.length ? (
              <>
                <Table headers={["Page", "Slug", "Parent", "Draft", "Published", "Status", "Updated", "Actions"]}>
                  {visiblePages.map((page) => (
                    <tr key={page.id} className="hover:bg-surface-secondary/70">
                      <td className="font-semibold text-foreground">{page.title}</td>
                      <td className="text-muted-foreground">/{page.slug}</td>
                      <td className="text-muted-foreground">{page.parentId ? pages.find((parent) => parent.id === page.parentId)?.title ?? "Nested" : "Root"}</td>
                      <td>{page.draftVersionId ? <Badge tone="warning">ready</Badge> : <Badge>none</Badge>}</td>
                      <td>{page.publishedVersionId ? <Badge tone="success">live</Badge> : <Badge>none</Badge>}</td>
                      <td><StatusBadge status={page.status} /></td>
                      <td className="text-muted-foreground">{new Date(page.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <ButtonLink href={`/builder/pages/${page.id}`} size="sm" variant="secondary">
                            <Code2 className="size-4" />
                            Builder
                          </ButtonLink>
                          <Button type="button" size="sm" variant="secondary" onClick={() => openEditPage(page)}>
                            <Edit3 className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!page.draftVersionId}
                            onClick={() => void publishPageDraft(page)}
                          >
                            <Rocket className="size-4" />
                            Publish
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setSeoPage(page)}>
                            <SearchCheck className="size-4" />
                            SEO
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => setConfirm({ title: "Archive page", description: `Archive ${page.title}?`, action: () => void archivePage(page) })}
                          >
                            <Archive className="size-4" />
                          </Button>
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
              <EmptyState title="No pages found" description="Create a homepage or adjust the filter." />
            )}
          </Card>
          <Sheet open={createPageOpen} title="Create page" onClose={() => setCreatePageOpen(false)}>
            <form className="grid gap-4" onSubmit={createPage}>
              <Field label="Title">
                <Input
                  value={pageTitle}
                  onChange={(event) => setPageTitle(event.target.value)}
                  required
                />
              </Field>
              <Field label="Slug" hint="Lowercase URL path for this page.">
                <Input
                  value={pageSlug}
                  onChange={(event) => {
                    setPageSlugTouched(true);
                    setPageSlug(slugify(event.target.value));
                  }}
                  required
                />
              </Field>
              <Field label="Parent">
                <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
                  <option value="">No parent</option>
                  {pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                </Select>
              </Field>
              <Checkbox label="Set as homepage" checked={isHomePage} onChange={(event) => setIsHomePage(event.target.checked)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCreatePageOpen(false)}>Cancel</Button>
                <Button type="submit"><Plus className="size-4" />Create page</Button>
              </div>
            </form>
          </Sheet>
          <Sheet open={Boolean(editingPage)} title="Edit page" onClose={() => setEditingPage(null)}>
            <form className="grid gap-4" onSubmit={savePage}>
              <Field label="Title">
                <Input
                  value={editingPageTitle}
                  onChange={(event) => setEditingPageTitle(event.target.value)}
                  required
                />
              </Field>
              <Field label="Slug" hint="Lowercase URL path for this page.">
                <Input
                  value={editingPageSlug}
                  onChange={(event) => setEditingPageSlug(slugify(event.target.value))}
                  required
                />
              </Field>
              <Field label="Parent">
                <Select value={editingPageParentId} onChange={(event) => setEditingPageParentId(event.target.value)}>
                  <option value="">No parent</option>
                  {pages
                    .filter((page) => page.id !== editingPage?.id)
                    .map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
                </Select>
              </Field>
              <Field label="Status" hint="Publish a draft version to make page content live.">
                <Select
                  value={editingPageStatus}
                  onChange={(event) => setEditingPageStatus(event.target.value as PageSummary["status"])}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </Select>
              </Field>
              <Checkbox
                label="Set as homepage"
                checked={editingPageIsHomePage}
                onChange={(event) => setEditingPageIsHomePage(event.target.checked)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditingPage(null)}>Cancel</Button>
                <Button type="submit"><CheckCircle2 className="size-4" />Save page</Button>
              </div>
            </form>
          </Sheet>
          <PageSeoSettingsModal
            page={seoPage}
            website={website}
            open={Boolean(seoPage)}
            onClose={() => setSeoPage(null)}
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
              <SectionHeader
                title="Custom domain"
                description="One custom domain can be attached to this website."
                actions={<DomainBadge status={activeSelectedDomain.verificationStatus} />}
              />
              <div className="grid gap-3 rounded-lg border bg-surface-secondary/45 p-3">
                <div className="min-w-0">
                  <p className="break-all text-base font-semibold text-foreground">{activeSelectedDomain.hostname}</p>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                    {activeSelectedDomain.verificationStatus === "VERIFIED" ? "DNS is connected." : "DNS is not connected yet."}
                  </p>
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
              <SectionHeader title="Add domain" description="Attach one hostname to this website." />
              <form className="grid gap-4" onSubmit={addDomain}>
                <Field label="Hostname"><Input value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="example.com" required /></Field>
                <Button type="submit"><Plus className="size-4" />Add domain</Button>
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
          <section className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.34fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden border-primary/15 bg-surface shadow-sm shadow-slate-950/5">
              <div className="rounded-lg border bg-surface-secondary/60 p-4">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Palette className="size-5" />
                </div>
                <h2 className="mt-5 text-2xl font-black text-foreground">Theme studio</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
                <div className="rounded-lg border bg-surface-secondary/30 p-4 shadow-sm shadow-slate-950/5">
                  <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <ThemePreviewCard theme={currentTheme} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-3xl font-black tracking-normal text-foreground">{currentTheme.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild type="button" size="sm" variant="secondary">
                            <Link href={`/websites/${id}/themes/${theme.id}/customize`}>
                              <Palette className="size-4" />
                              Customize
                            </Link>
                          </Button>
                          <Button asChild type="button" size="sm" variant="secondary">
                            <Link href={`/websites/${id}/themes/${theme.id}/preview`} target="_blank" rel="noreferrer" aria-label={`Preview ${theme.name}`}>
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void duplicateTheme(theme)}>
                            <Copy className="size-4" />
                          </Button>
                          <Button asChild type="button" size="sm" variant="secondary">
                            <Link href={`/websites/${id}/themes/${theme.id}/code`} target="_blank" rel="noreferrer" aria-label={`Edit ${theme.name} code`}>
                              <Code2 className="size-4" />
                            </Link>
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => void openThemeHistory(theme)}>
                            <History className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={theme.status === "PUBLISHED"}
                            onClick={() => void publishTheme(theme)}
                          >
                            <Rocket className="size-4" />
                            Publish
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={theme.status === "PUBLISHED"}
                            onClick={() => setConfirm({ title: "Delete theme", description: `Delete ${theme.name}?`, action: () => void deleteTheme(theme) })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
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
        <section className="grid items-start gap-4 xl:grid-cols-2">
          <Card>
            <SectionHeader title="Website settings" description="Update the website name and internal slug." actions={<StatusBadge status={website.status} />} />
            <form className="grid gap-4" onSubmit={saveWebsite}>
              <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} required /></Field>
              <Field label="Slug"><Input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} required /></Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Save settings</Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setConfirm({ title: "Archive website", description: "Archive this website record?", action: archiveWebsite })}
                >
                  Archive website
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Record details" eyebrow="Metadata">
            <Table headers={["Field", "Value"]}>
              <tr><td className="font-semibold text-foreground">Website ID</td><td className="text-muted-foreground">{website.id}</td></tr>
              <tr><td className="font-semibold text-foreground">Created</td><td className="text-muted-foreground">{new Date(website.createdAt).toLocaleString()}</td></tr>
              <tr><td className="font-semibold text-foreground">Updated</td><td className="text-muted-foreground">{new Date(website.updatedAt).toLocaleString()}</td></tr>
            </Table>
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

function WebsiteViewPanel({
  customDomainUrl,
  portalPreviewUrl,
  verifiedDomain,
}: {
  customDomainUrl: string | null;
  portalPreviewUrl: string;
  verifiedDomain: DomainSummary | null;
}) {
  return (
    <Card className="gap-3">
      <SectionHeader
        title="View website"
        description="Open the live custom domain when it is connected, or use the portal test URL before DNS is ready."
        actions={verifiedDomain ? <Badge tone="success">custom domain connected</Badge> : <Badge tone="warning">custom domain not connected</Badge>}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <ViewUrlRow
          icon={<Globe2 className="size-4" />}
          label="Custom domain"
          value={customDomainUrl ?? "Connect and verify a custom domain first"}
          href={customDomainUrl}
        />
        <ViewUrlRow
          icon={<ExternalLink className="size-4" />}
          label="Portal test URL"
          value={portalPreviewUrl}
          href={portalPreviewUrl}
        />
      </div>
    </Card>
  );
}

function ViewUrlRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string | null;
}) {
  async function copyValue() {
    if (!href || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(href);
    toast.success("Copied");
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-surface-secondary/35 p-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <p className="min-h-5 break-all text-[12px] leading-5 text-muted-foreground">{value}</p>
      <div className="flex flex-wrap gap-2">
        {href ? (
          <Button asChild size="sm" variant="secondary">
            <a href={href} target="_blank" rel="noreferrer">
              <Eye className="size-4" />
              View
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" variant="secondary" disabled>
            <Eye className="size-4" />
            View
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" disabled={!href} onClick={() => void copyValue()}>
          <Copy className="size-4" />
          Copy
        </Button>
      </div>
    </div>
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

      <div className="grid gap-3">
        <DnsRecordStep
          title="Step 1: Verify ownership"
          helper="Required before this domain can be marked connected."
          rows={[
            ["Type", "TXT"],
            ["Name", verificationName],
            ["Value", domain.verificationToken],
          ]}
        />
        <DnsRecordStep
          title="Step 2: Point the root domain"
          helper="Use this for root domains when your DNS provider cannot use CNAME flattening, ALIAS, or ANAME."
          rows={[
            ["Type", "A"],
            ["Name", "@"],
            ["Value", aRecordIp],
          ]}
        />
        <DnsRecordStep
          title={isWwwDomain ? "Step 2: Point the www domain" : "Alternative: Use a CNAME"}
          helper={isWwwDomain ? "Use this for www or another subdomain." : "Use this only if your DNS provider supports CNAME flattening, ALIAS, or ANAME at the root."}
          rows={[
            ["Type", "CNAME"],
            ["Name", rootRecordName],
            ["Value", cnameTarget],
          ]}
        />
      </div>

      <Alert tone="info">DNS changes can take a few minutes to propagate. Refresh DNS checks the TXT ownership record plus the CNAME or configured A record before marking the domain connected.</Alert>
    </Card>
  );
}

function DnsRecordStep({
  title,
  helper,
  rows,
}: {
  title: string;
  helper: string;
  rows: Array<[string, string]>;
}) {
  async function copyValue(value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-surface p-3">
      <div>
        <h3 className="text-[12.5px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{helper}</p>
      </div>
      <div className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="grid gap-2 rounded-md border bg-surface-secondary/40 p-2 sm:grid-cols-[74px_minmax(0,1fr)_auto] sm:items-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
            <code className="min-w-0 break-all rounded bg-surface px-2 py-1 text-[12px] text-foreground">{value}</code>
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyValue(value)}>
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
        ))}
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
