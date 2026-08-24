"use client";

import { Archive, ClipboardList, Code2, Copy, Edit3, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { use, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, IconButton } from "../../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader, Skeleton } from "../../components/ui/display";
import { Field, Input } from "../../components/ui/form";
import { Pagination, Table, Tabs } from "../../components/ui/navigation";
import { ConfirmDialog, Modal, Sheet } from "../../components/ui/overlay";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import type { FormListSummary, FormSummary, WebsiteSummary } from "./types";

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
 * The Forms list — same filter/search/bulk-action/clone/archive shell as Blog Categories, but
 * "Edit" navigates into the dedicated drag-and-drop builder (Form/Mail tabs) rather than opening
 * a simple settings sheet, since a form's real content is its field list and mail template.
 */
export function FormsWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [counts, setCounts] = useState<FormListSummary["counts"]>({ all: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const [shortcodeForm, setShortcodeForm] = useState<FormSummary | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function loadForms(activeTenant: ActiveTenant) {
    setIsLoading(true);
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);

      const searchParams = new URLSearchParams({ includeCounts: "true" });
      if (statusFilter !== "all") searchParams.set("status", statusFilter);
      if (query.trim()) searchParams.set("q", query.trim());

      const response = await apiRequest<FormListSummary>(`/websites/${id}/forms?${searchParams.toString()}`);
      setForms(response.data);
      setCounts(response.counts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Forms failed to load");
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
          await loadForms(meResponse.activeTenant);
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
    void loadForms(me.activeTenant);
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
    await loadForms(response.activeTenant);
  }

  async function createForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const created = await apiRequest<FormSummary>(`/websites/${id}/forms`, {
        method: "POST",
        body: JSON.stringify({ name: createName, slug: createSlug }),
      });
      setCreateName("");
      setCreateSlug("");
      setCreateSlugTouched(false);
      setCreateOpen(false);
      toast.success("Form created");
      router.push(`/websites/${id}/forms/${created.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Form creation failed");
    } finally {
      setIsCreating(false);
    }
  }

  async function cloneForm(form: FormSummary) {
    try {
      await apiRequest(`/forms/${form.id}/clone`, { method: "POST" });
      if (me?.activeTenant) await loadForms(me.activeTenant);
      toast.success("Form cloned");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Clone failed");
    }
  }

  async function archiveForm(form: FormSummary) {
    try {
      await apiRequest(`/forms/${form.id}/archive`, { method: "POST" });
      if (me?.activeTenant) await loadForms(me.activeTenant);
      toast.success("Form archived");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Archive failed");
    }
  }

  async function togglePublish(form: FormSummary) {
    const nextStatus = form.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await apiRequest(`/forms/${form.id}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      if (me?.activeTenant) await loadForms(me.activeTenant);
      toast.success(nextStatus === "PUBLISHED" ? "Form published" : "Form moved to draft");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Status update failed");
    }
  }

  async function copyShortcode(form: FormSummary) {
    const shortcode = `[form id="${form.id}"]`;
    try {
      await navigator.clipboard.writeText(shortcode);
      toast.success("Shortcode copied");
    } catch {
      toast.error("Copy failed — select the shortcode and copy it manually");
    }
  }

  async function bulkAction(action: "PUBLISH" | "DRAFT" | "ARCHIVE" | "DELETE") {
    if (!selectedIds.size) return;
    setIsBulkUpdating(true);
    try {
      await apiRequest("/forms/bulk", {
        method: "POST",
        body: JSON.stringify({ formIds: [...selectedIds], action }),
      });
      setSelectedIds(new Set());
      if (me?.activeTenant) await loadForms(me.activeTenant);
      toast.success("Forms updated");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Bulk update failed");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  function toggleSelection(formId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(formId);
      else next.delete(formId);
      return next;
    });
  }

  const visibleForms = forms.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const pageCount = Math.max(1, Math.ceil(forms.length / pageSize));
  const allVisibleSelected = visibleForms.length > 0 && visibleForms.every((form) => selectedIds.has(form.id));

  const statusTabs = [
    { value: "all", label: `All (${counts.all})` },
    { value: "PUBLISHED", label: `Published (${counts.PUBLISHED})` },
    { value: "DRAFT", label: `Draft (${counts.DRAFT})` },
    { value: "ARCHIVED", label: `Archived (${counts.ARCHIVED})` },
  ];

  if (!hasLoadedDashboardShell && (!me || !website)) {
    return <LoadingState label="Loading forms" />;
  }

  if (!me || !website) {
    return <LoadingState label="Loading forms" contentOnly={hasLoadedDashboardShell} />;
  }

  return (
    <DashboardShell
      title={website.name}
      eyebrow="Website"
      description="Build forms with drag-and-drop fields, validation, and a customizable email notification template."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Forms" },
      ]}
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <SectionHeader
          title="Forms"
          description="Each form has its own field builder and a Mail tab for the notification email."
          actions={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New form
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
          <FormsTableSkeleton />
        ) : visibleForms.length ? (
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
                    onClick={() => setConfirm({ title: "Archive forms", description: `Archive ${selectedIds.size} selected forms?`, action: () => void bulkAction("ARCHIVE") })}
                  >
                    <Archive className="size-4" />
                    Archive
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={isBulkUpdating}
                    onClick={() => setConfirm({ title: "Permanently delete forms", description: `Permanently delete ${selectedIds.size} selected forms? This cannot be undone.`, action: () => void bulkAction("DELETE") })}
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
                  aria-label="Select visible forms"
                  className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      for (const form of visibleForms) {
                        if (checked) next.add(form.id);
                        else next.delete(form.id);
                      }
                      return next;
                    });
                  }}
                />,
                "Name",
                "Slug",
                "Fields",
                "Status",
                "Updated",
                "",
              ]}
            >
              {visibleForms.map((form) => (
                <tr key={form.id}>
                  <td>
                    <input
                      aria-label={`Select ${form.name}`}
                      className="size-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      type="checkbox"
                      checked={selectedIds.has(form.id)}
                      onChange={(event) => toggleSelection(form.id, event.target.checked)}
                    />
                  </td>
                  <td className="font-semibold text-foreground">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left hover:underline"
                      onClick={() => router.push(`/websites/${id}/forms/${form.id}`)}
                    >
                      <ClipboardList className="size-4 text-muted-foreground" />
                      {form.name}
                    </button>
                  </td>
                  <td className="text-muted-foreground">/{form.slug}</td>
                  <td className="text-muted-foreground">{form.fields.length}</td>
                  <td><StatusBadge status={form.status} /></td>
                  <td className="text-muted-foreground">{new Date(form.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button type="button" size="sm" variant="secondary" onClick={() => router.push(`/websites/${id}/forms/${form.id}`)}>
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      {form.status !== "ARCHIVED" ? (
                        <Button type="button" size="sm" variant="secondary" onClick={() => void togglePublish(form)}>
                          {form.status === "PUBLISHED" ? <Edit3 className="size-4" /> : <Rocket className="size-4" />}
                          {form.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="secondary" onClick={() => setShortcodeForm(form)}>
                        <Code2 className="size-4" />
                        Shortcode
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void cloneForm(form)}>
                        <Copy className="size-4" />
                        Clone
                      </Button>
                      <IconButton
                        label={`Archive ${form.name}`}
                        disabled={form.status === "ARCHIVED"}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setConfirm({ title: "Archive form", description: `Archive ${form.name}?`, action: () => void archiveForm(form) })}
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
          <EmptyState title="No forms yet" description="Create a form to start collecting submissions with drag-and-drop fields and a custom email notification." />
        )}
      </Card>

      <Sheet open={createOpen} title="New form" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-4" onSubmit={createForm}>
          <Field label="Name">
            <Input value={createName} onChange={(event) => setCreateName(event.target.value)} required />
          </Field>
          <Field label="Slug" hint="Used to identify this form's submission endpoint.">
            <Input
              value={createSlug}
              onChange={(event) => {
                setCreateSlugTouched(true);
                setCreateSlug(slugify(event.target.value));
              }}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isCreating}>
              <Plus className="size-4" />
              {isCreating ? "Creating..." : "Create & open builder"}
            </Button>
          </div>
        </form>
      </Sheet>

      <Modal
        open={Boolean(shortcodeForm)}
        title="Embed shortcode"
        description="Paste this into a page or blog post's content to embed this form."
        onClose={() => setShortcodeForm(null)}
      >
        <div className="grid gap-4 p-5">
          <Field label="Shortcode">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shortcodeForm ? `[form id="${shortcodeForm.id}"]` : ""}
                onFocus={(event) => event.target.select()}
                className="font-mono text-[12.5px]"
              />
              <Button type="button" variant="secondary" onClick={() => shortcodeForm && void copyShortcode(shortcodeForm)}>
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </Field>
        </div>
      </Modal>

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

function StatusBadge({ status }: { status: FormSummary["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

function FormsTableSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={`form-skeleton-${index}`} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
