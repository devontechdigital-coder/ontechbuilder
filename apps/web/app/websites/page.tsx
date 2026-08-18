"use client";

import { CheckCircle2, Filter, Loader2, Plus, Search, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button, ButtonLink } from "../../components/ui/button";
import { Sheet } from "../../components/ui/overlay";
import { Pagination, Table } from "../../components/ui/navigation";
import { Alert, Badge, Card, EmptyState, LoadingState, SectionHeader, StatusIndicator } from "../../components/ui/display";
import { Field, Input, Select } from "../../components/ui/form";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../../features/auth/types";
import type { PageResult, WebsiteSummary } from "../../features/websites/types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

interface SlugAvailabilityResponse {
  slug: string;
  available: boolean;
}

const pageSize = 8;

export default function WebsitesPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [websites, setWebsites] = useState<WebsiteSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const stats = useMemo(
    () => ({
      total: websites.length,
      published: websites.filter((website) => website.status === "PUBLISHED").length,
      drafts: websites.filter((website) => website.status === "DRAFT").length,
    }),
    [websites],
  );

  const filteredWebsites = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return websites.filter((website) => {
      const matchesStatus = statusFilter === "all" || website.status === statusFilter;
      const matchesQuery =
        !normalized || `${website.name} ${website.slug} ${website.status}`.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, statusFilter, websites]);

  const pageCount = Math.max(1, Math.ceil(filteredWebsites.length / pageSize));
  const visibleWebsites = filteredWebsites.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

  useEffect(() => {
    setPageIndex(0);
  }, [query, statusFilter]);

  async function loadWebsites(activeTenant: ActiveTenant, cursor?: string) {
    const response = await apiRequest<PageResult<WebsiteSummary>>(
      `/tenants/${activeTenant.id}/websites?limit=${pageSize}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    setWebsites((current) => (cursor ? [...current, ...response.data] : response.data));
    setNextCursor(response.nextCursor);
  }

  useEffect(() => {
    async function load() {
      try {
        const [meResponse, tenantResponse] = await Promise.all([
          apiRequest<MeResponse>("/auth/me"),
          apiRequest<TenantSummary[]>("/tenants"),
        ]);
        setMe(meResponse);
        setTenants(tenantResponse);

        if (meResponse.activeTenant) {
          await loadWebsites(meResponse.activeTenant);
        }
      } catch {
        router.push("/login");
      }
    }

    void load();
  }, [router]);

  useEffect(() => {
    if (slugTouched || !name.trim()) {
      return;
    }

    setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!me?.activeTenant || !slug) {
      setSlugState("idle");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setSlugState("invalid");
      return;
    }

    setSlugState("checking");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await apiRequest<SlugAvailabilityResponse>(
          `/tenants/${me.activeTenant?.id}/websites/slug-availability?slug=${encodeURIComponent(slug)}`,
        );
        setSlugState(response.available ? "available" : "taken");
      } catch {
        setSlugState("invalid");
      }
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [me?.activeTenant, slug]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    setWebsites([]);
    setPageIndex(0);
    await loadWebsites(response.activeTenant);
  }

  async function createWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!me?.activeTenant) {
      setError("Select an active tenant first.");
      return;
    }

    if (slugState !== "available") {
      setError("Choose an available slug before creating the website.");
      return;
    }

    setIsCreating(true);
    try {
      await apiRequest(`/tenants/${me.activeTenant.id}/websites`, {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setCreateOpen(false);
      setPageIndex(0);
      await loadWebsites(me.activeTenant);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Website creation failed");
    } finally {
      setIsCreating(false);
    }
  }

  async function loadMore() {
    if (!me?.activeTenant || !nextCursor) {
      return;
    }

    setIsLoadingMore(true);
    try {
      await loadWebsites(me.activeTenant, nextCursor);
      setPageIndex((current) => current + 1);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function nextPage() {
    if (pageIndex + 1 < pageCount) {
      setPageIndex((current) => current + 1);
      return;
    }

    void loadMore();
  }

  if (!me) {
    return <LoadingState label="Loading websites" />;
  }

  return (
    <DashboardShell
      title="Websites"
      eyebrow="Workspace"
      description="Browse, filter, and manage tenant-scoped website records."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Websites" }]}
      actions={
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create website
        </Button>
      }
      onTenantChange={switchTenant}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Total websites" value={stats.total} helper="Loaded records in this tenant." />
        <Metric label="Published" value={stats.published} helper="Ready website records." />
        <Metric label="Draft" value={stats.drafts} helper="Still being prepared." />
      </section>

      <Card>
        <SectionHeader
          title="Website inventory"
          description="Search, filter by status, and open a website to manage pages, domains, and settings."
          actions={<StatusIndicator tone={nextCursor ? "info" : "success"} label={nextCursor ? "More available" : "All loaded"} />}
        />

        <div className="grid gap-3 rounded-lg border bg-surface-secondary/40 p-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search websites"
              type="search"
            />
          </div>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Button type="button" variant="secondary" onClick={() => { setQuery(""); setStatusFilter("all"); }}>
            <Filter className="size-4" />
            Clear filters
          </Button>
        </div>

        {visibleWebsites.length ? (
          <>
            <Table headers={["Website", "Slug", "Status", "Updated", "Actions"]}>
              {visibleWebsites.map((website) => (
                <tr key={website.id} className="transition-colors hover:bg-surface-secondary/70">
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 font-black text-primary">
                        {website.name.slice(0, 1).toUpperCase()}
                      </span>
                      <strong className="text-foreground">{website.name}</strong>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{website.slug}</td>
                  <td><WebsiteStatusBadge status={website.status} /></td>
                  <td className="text-muted-foreground">{new Date(website.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <div className="flex justify-end">
                      <ButtonLink href={`/websites/${website.id}`} variant="secondary" size="sm">
                        Open
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination
              hasPrevious={pageIndex > 0}
              hasNext={pageIndex + 1 < pageCount || Boolean(nextCursor)}
              label={`Page ${pageIndex + 1} of ${pageCount}${nextCursor ? "+" : ""}`}
              onPrevious={() => setPageIndex((current) => Math.max(0, current - 1))}
              onNext={nextPage}
            />
            {isLoadingMore ? <p className="text-sm text-muted-foreground">Loading next page...</p> : null}
          </>
        ) : (
          <EmptyState
            title={websites.length ? "No websites match your filters" : "No websites yet"}
            description={websites.length ? "Adjust the search or status filter." : "Create your first website from the popup."}
            action={<Button type="button" onClick={() => setCreateOpen(true)}>Create website</Button>}
          />
        )}
      </Card>

      <Sheet open={createOpen} title="Create website" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-4" onSubmit={createWebsite}>
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Ontech marketing site" />
          </Field>
          <Field label="Slug" hint="Auto-generated from the name. You can edit it before creating.">
            <div className="relative">
              <Input
                className="pr-11"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                required
              />
              <SlugStateIcon state={slugState} />
            </div>
          </Field>
          <SlugMessage state={slugState} slug={slug} />
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isCreating || slugState !== "available"}>
              {isCreating ? "Creating" : "Create website"}
            </Button>
          </div>
        </form>
      </Sheet>
    </DashboardShell>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <Card>
      <div className="grid gap-1">
        <span className="text-[11.5px] font-medium text-muted-foreground">{label}</span>
        <strong className="text-2xl font-semibold leading-none tracking-tight text-foreground tabular">{value}</strong>
        <p className="text-[11.5px] text-muted-foreground">{helper}</p>
      </div>
    </Card>
  );
}

function WebsiteStatusBadge({ status }: { status: WebsiteSummary["status"] }) {
  const tone = status === "PUBLISHED" ? "success" : status === "ARCHIVED" ? "danger" : "warning";
  return <Badge tone={tone}>{status.toLowerCase()}</Badge>;
}

function SlugStateIcon({ state }: { state: "idle" | "checking" | "available" | "taken" | "invalid" }) {
  if (state === "checking") {
    return <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />;
  }

  if (state === "available") {
    return <CheckCircle2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-success" />;
  }

  if (state === "taken" || state === "invalid") {
    return <XCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-destructive" />;
  }

  return null;
}

function SlugMessage({ state, slug }: { state: "idle" | "checking" | "available" | "taken" | "invalid"; slug: string }) {
  if (!slug || state === "idle") {
    return null;
  }

  const messages = {
    checking: "Checking slug availability...",
    available: `${slug} is available.`,
    taken: `${slug} is already used in this workspace.`,
    invalid: "Use lowercase letters, numbers, and hyphens only.",
  };

  return (
    <p className={`text-sm font-medium ${state === "available" ? "text-success" : state === "checking" ? "text-muted-foreground" : "text-destructive"}`}>
      {messages[state]}
    </p>
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
