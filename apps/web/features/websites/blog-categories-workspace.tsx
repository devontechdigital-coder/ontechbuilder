"use client";

import { Archive, CheckCircle2, Copy, Edit3, ImageIcon, Plus, Rocket, SearchCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { use, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, IconButton } from "../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader, Skeleton } from "../../components/ui/display";
import { Field, Input, Select } from "../../components/ui/form";
import { Pagination, Table, Tabs } from "../../components/ui/navigation";
import { ConfirmDialog, Sheet } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import { PageSeoSettingsModal } from "./page-seo-settings";
import type { BlogCategoryListSummary, BlogCategorySummary, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

const pageSize = 20;

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * A dedicated management page for blog categories — same feature set as the Pages/Blogs table
 * (edit, SEO, clone, archive, filter) minus "edit in builder" (categories have no builder page of
 * their own), plus a featured image + alt text pair specific to categories.
 */
export function BlogCategoriesWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [categories, setCategories] = useState<BlogCategorySummary[]>([]);
  const [counts, setCounts] = useState<BlogCategoryListSummary["counts"]>({ all: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const [seoCategory, setSeoCategory] = useState<BlogCategorySummary | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [createImage, setCreateImage] = useState("");
  const [createImageAlt, setCreateImageAlt] = useState("");

  const [editingCategory, setEditingCategory] = useState<BlogCategorySummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editStatus, setEditStatus] = useState<BlogCategorySummary["status"]>("PUBLISHED");
  const [editImage, setEditImage] = useState("");
  const [editImageAlt, setEditImageAlt] = useState("");

  async function loadCategories(activeTenant: ActiveTenant) {
    setIsLoading(true);
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);

      const searchParams = new URLSearchParams({ includeCounts: "true" });
      if (statusFilter !== "all") searchParams.set("status", statusFilter);
      if (query.trim()) searchParams.set("q", query.trim());

      const response = await apiRequest<BlogCategoryListSummary>(`/websites/${id}/blog-categories?${searchParams.toString()}`);
      setCategories(response.data);
      setCounts(response.counts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Blog categories failed to load");
    } finally {
      setIsLoading(false);
    }
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
          await loadCategories(meResponse.activeTenant);
        }
      } catch {
        router.push("/login");
      }
    }

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  useEffect(() => {
    if (!me?.activeTenant) return;
    void loadCategories(me.activeTenant);
    setPageIndex(0);
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, query, me?.activeTenant]);

  useEffect(() => {
    if (!createSlugTouched) setCreateSlug(slugify(createName));
  }, [createName, createSlugTouched]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadCategories(response.activeTenant);
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await apiRequest<BlogCategorySummary>(`/websites/${id}/blog-categories`, {
        method: "POST",
        body: JSON.stringify({ name: createName, slug: createSlug }),
      });
      setCreateName("");
      setCreateSlug("");
      setCreateSlugTouched(false);
      setCreateImage("");
      setCreateImageAlt("");
      setCreateOpen(false);
      if (me?.activeTenant) await loadCategories(me.activeTenant);
      toast.success("Blog category created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Blog category creation failed");
    }
  }

  function openEdit(category: BlogCategorySummary) {
    setEditingCategory(category);
    setEditName(category.name);
    setEditSlug(category.slug);
    setEditStatus(category.status);
    setEditImage(category.image ?? "");
    setEditImageAlt(category.imageAlt ?? "");
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCategory) return;
    setError(null);
    try {
      await apiRequest<BlogCategorySummary>(`/blog-categories/${editingCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          slug: editSlug,
          status: editStatus === "ARCHIVED" ? undefined : editStatus,
          image: editImage || null,
          imageAlt: editImageAlt || null,
        }),
      });
      setEditingCategory(null);
      if (me?.activeTenant) await loadCategories(me.activeTenant);
      toast.success("Blog category saved");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Blog category save failed");
    }
  }

  async function cloneCategory(category: BlogCategorySummary) {
    try {
      await apiRequest(`/blog-categories/${category.id}/clone`, { method: "POST" });
      if (me?.activeTenant) await loadCategories(me.activeTenant);
      toast.success("Blog category cloned");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Clone failed");
    }
  }

  async function archiveCategory(category: BlogCategorySummary) {
    try {
      await apiRequest(`/blog-categories/${category.id}/archive`, { method: "POST" });
      if (me?.activeTenant) await loadCategories(me.activeTenant);
      toast.success("Blog category archived");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Archive failed");
    }
  }

  async function bulkAction(action: "PUBLISH" | "DRAFT" | "ARCHIVE" | "DELETE") {
    if (!selectedIds.size) return;
    setIsBulkUpdating(true);
    try {
      await apiRequest("/blog-categories/bulk", {
        method: "POST",
        body: JSON.stringify({ categoryIds: [...selectedIds], action }),
      });
      setSelectedIds(new Set());
      if (me?.activeTenant) await loadCategories(me.activeTenant);
      toast.success("Blog categories updated");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Bulk update failed");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  function toggleSelection(categoryId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(categoryId);
      else next.delete(categoryId);
      return next;
    });
  }

  const visibleCategories = categories.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(categories.length / pageSize));
  const allVisibleSelected = visibleCategories.length > 0 && visibleCategories.every((category) => selectedIds.has(category.id));

  const statusTabs = [
    { value: "all", label: `All (${counts.all})` },
    { value: "PUBLISHED", label: `Published (${counts.PUBLISHED})` },
    { value: "DRAFT", label: `Draft (${counts.DRAFT})` },
    { value: "ARCHIVED", label: `Archived (${counts.ARCHIVED})` },
  ];

  if (!hasLoadedDashboardShell && (!me || !website)) {
    return <LoadingState label="Loading blog categories" />;
  }

  if (!me || !website) {
    return <LoadingState label="Loading blog categories" contentOnly={hasLoadedDashboardShell} />;
  }

  return (
    <DashboardShell
      title={website.name}
      eyebrow="Website"
      description="Manage blog categories: content grouping, SEO, and the image shown on category cards across the theme."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Blog Categories" },
      ]}
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <SectionHeader
          title="Blog Categories"
          description="Group blog posts and control each category's SEO and card image."
          actions={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New category
            </Button>
          }
        />

        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput);
          }}
        >
          <Field label="Search">
            <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search by name or slug" />
          </Field>
          <Button type="submit">Apply</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQueryInput("");
              setQuery("");
              setStatusFilter("all");
            }}
          >
            Clear
          </Button>
        </form>

        <Tabs tabs={statusTabs} value={statusFilter} onChange={setStatusFilter} />

        {isLoading ? (
          <CategoriesTableSkeleton />
        ) : visibleCategories.length ? (
          <>
            {selectedIds.size ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface-secondary/45 p-3">
                <p className="text-[12.5px] font-semibold text-foreground">{selectedIds.size} selected</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={isBulkUpdating} onClick={() => void bulkAction("PUBLISH")}>
                    <Rocket className="size-4" />
                    Publish
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={isBulkUpdating} onClick={() => void bulkAction("DRAFT")}>
                    <Edit3 className="size-4" />
                    Draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isBulkUpdating}
                    onClick={() => setConfirm({ title: "Archive categories", description: `Archive ${selectedIds.size} selected categories?`, action: () => void bulkAction("ARCHIVE") })}
                  >
                    <Archive className="size-4" />
                    Archive
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={isBulkUpdating}
                    onClick={() => setConfirm({ title: "Permanently delete categories", description: `Permanently delete ${selectedIds.size} selected categories? This cannot be undone.`, action: () => void bulkAction("DELETE") })}
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
                  aria-label="Select visible categories"
                  className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      for (const category of visibleCategories) {
                        if (checked) next.add(category.id);
                        else next.delete(category.id);
                      }
                      return next;
                    });
                  }}
                />,
                "Image",
                "Name",
                "Slug",
                "Status",
                "Updated",
                "",
              ]}
            >
              {visibleCategories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      aria-label={`Select ${category.name}`}
                      className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      type="checkbox"
                      checked={selectedIds.has(category.id)}
                      onChange={(event) => toggleSelection(category.id, event.target.checked)}
                    />
                  </td>
                  <td>
                    {category.image ? (
                      <img src={category.image} alt={category.imageAlt ?? ""} className="size-10 rounded-md border object-cover" />
                    ) : (
                      <div className="grid size-10 place-items-center rounded-md border bg-surface-secondary/40 text-muted-foreground">
                        <ImageIcon className="size-4" />
                      </div>
                    )}
                  </td>
                  <td className="font-semibold text-foreground">{category.name}</td>
                  <td className="text-muted-foreground">/{category.slug}</td>
                  <td><StatusBadge status={category.status} /></td>
                  <td className="text-muted-foreground">{new Date(category.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(category)}>
                        <Edit3 className="size-4" />
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setSeoCategory(category)}>
                        <SearchCheck className="size-4" />
                        SEO
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void cloneCategory(category)}>
                        <Copy className="size-4" />
                        Clone
                      </Button>
                      <IconButton
                        label={`Archive ${category.name}`}
                        disabled={category.status === "ARCHIVED"}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setConfirm({ title: "Archive category", description: `Archive ${category.name}?`, action: () => void archiveCategory(category) })}
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
          <EmptyState title="No blog categories yet" description="Create a category to group blog posts and give each one its own SEO and card image." />
        )}
      </Card>

      <Sheet open={createOpen} title="New blog category" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-4" onSubmit={createCategory}>
          <Field label="Name">
            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} required />
          </Field>
          <Field label="Slug" hint="Used in category archive URLs.">
            <Input
              value={createSlug}
              onChange={(event) => {
                setCreateSlugTouched(true);
                setCreateSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>
          <ImageField label="Category image" value={createImage} onChange={setCreateImage} />
          <Field label="Category image alt text" hint="Describes the image for screen readers and search engines.">
            <Input value={createImageAlt} onChange={(event) => setCreateImageAlt(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit"><Plus className="size-4" />Create category</Button>
          </div>
        </form>
      </Sheet>

      <Sheet open={Boolean(editingCategory)} title="Edit blog category" onClose={() => setEditingCategory(null)}>
        <form className="grid gap-4" onSubmit={saveCategory}>
          <Field label="Name">
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} required />
          </Field>
          <Field label="Slug" hint="Used in category archive URLs.">
            <Input value={editSlug} onChange={(event) => setEditSlug(slugify(event.target.value))} required />
          </Field>
          <Field label="Status">
            <Select value={editStatus} onChange={(event) => setEditStatus(event.target.value as BlogCategorySummary["status"])}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </Select>
          </Field>
          <ImageField label="Category image" value={editImage} onChange={setEditImage} />
          <Field label="Category image alt text" hint="Describes the image for screen readers and search engines.">
            <Input value={editImageAlt} onChange={(event) => setEditImageAlt(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingCategory(null)}>Cancel</Button>
            <Button type="submit"><CheckCircle2 className="size-4" />Save category</Button>
          </div>
        </form>
      </Sheet>

      <PageSeoSettingsModal
        page={seoCategory ? { id: seoCategory.id, slug: seoCategory.slug, title: seoCategory.name } : null}
        website={website}
        open={Boolean(seoCategory)}
        onClose={() => setSeoCategory(null)}
        endpointBase="blog-categories"
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        danger
        confirmLabel="Confirm"
        onConfirm={() => {
          confirm?.action();
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: BlogCategorySummary["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} hint="Paste an image URL or select/upload from media when connected.">
      <div className="grid gap-2 rounded-lg border bg-surface-secondary/40 p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-surface">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
          <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://..." />
        </div>
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : value);
            reader.readAsDataURL(file);
          }}
        />
      </div>
    </Field>
  );
}

function CategoriesTableSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={`category-skeleton-${index}`} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
