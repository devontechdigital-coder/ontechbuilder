"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Button } from "../../components/ui/button";
import { Alert, Card, EmptyState, LoadingState, SectionHeader, Skeleton } from "../../components/ui/display";
import { Field, Input } from "../../components/ui/form";
import { Table, Tabs } from "../../components/ui/navigation";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import { buildRangeParams, parseRangeFromSearchParams, RANGE_TABS, todayIso } from "./analytics-range";
import type { AnalyticsData, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

function getCachedDashboardShell(): { me: MeResponse; tenants: TenantSummary[] } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.sessionStorage.getItem("stackbuilder-dashboard-shell-state") ?? "null") as {
      me: MeResponse;
      tenants: TenantSummary[];
    } | null;
  } catch {
    return null;
  }
}

function toCsvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const KIND_META = {
  pages: { title: "Top pages", columnLabel: "Page", description: "Every page viewed in the selected range, ranked by views." },
  sources: { title: "Traffic sources", columnLabel: "Source", description: "Every traffic source in the selected range, ranked by sessions." },
} as const;

/** Full, unranked-by-a-card-cap list behind the Analytics dashboard's "View all" links — reads the same date range from the URL so it opens already scoped to what the merchant was looking at. */
export function AnalyticsListWorkspace({ params, kind }: { params: Promise<{ id: string }>; kind: keyof typeof KIND_META }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [rows, setRows] = useState<Array<{ label: string; count: number }>>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRange = parseRangeFromSearchParams(searchParams);
  const [rangeMode, setRangeMode] = useState(initialRange.rangeMode);
  const [customFrom, setCustomFrom] = useState(initialRange.customFrom);
  const [customTo, setCustomTo] = useState(initialRange.customTo);
  const customRangeReady = rangeMode !== "custom" || Boolean(customFrom && customTo && customFrom <= customTo);

  const meta = KIND_META[kind];

  async function loadData(activeTenant: ActiveTenant) {
    if (!customRangeReady) return;
    setIsLoading(true);
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);

      const rangeParams = buildRangeParams(rangeMode, customFrom, customTo);
      rangeParams.set("limit", "500");
      const response = await apiRequest<AnalyticsData>(`/websites/${id}/analytics?${rangeParams.toString()}`);
      setRows(kind === "pages" ? response.topPages.map((row) => ({ label: row.path, count: row.count })) : response.trafficSources);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load");
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
        const meResponse = await apiRequest<MeResponse>("/auth/me");
        const tenantResponse = await apiRequest<TenantSummary[]>("/tenants");
        setMe(meResponse);
        setTenants(tenantResponse);
        if (meResponse.activeTenant) await loadData(meResponse.activeTenant);
      } catch {
        setError("Failed to load");
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  useEffect(() => {
    if (!me?.activeTenant) return;
    void loadData(me.activeTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMode, customFrom, customTo, me?.activeTenant]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadData(response.activeTenant);
  }

  function exportCsv() {
    if (!rows.length) return;
    const csv = [[meta.columnLabel, "Count"], ...rows.map((row) => [row.label, row.count])].map((row) => row.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}-${website?.slug ?? id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filteredRows = query.trim() ? rows.filter((row) => row.label.toLowerCase().includes(query.trim().toLowerCase())) : rows;
  const max = Math.max(1, ...filteredRows.map((row) => row.count));

  if (!me || !website) {
    if (hasLoadedDashboardShell && me) {
      return (
        <DashboardShell
          title="Loading analytics"
          eyebrow="Website"
          description="Loading the latest analytics data."
          me={me}
          tenants={tenants}
          breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Websites", href: "/websites" }]}
          onTenantChange={switchTenant}
        >
          <LoadingState label="Loading analytics" contentOnly />
        </DashboardShell>
      );
    }
    return <LoadingState label="Loading analytics" contentOnly={hasLoadedDashboardShell} />;
  }

  return (
    <DashboardShell
      title={meta.title}
      eyebrow={website.name}
      description={meta.description}
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Analytics", href: `/websites/${website.id}/analytics` },
        { label: meta.title },
      ]}
      onTenantChange={switchTenant}
      actions={
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={!rows.length}>
          <Download className="size-4" />
          Export
        </Button>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-3 sm:flex sm:items-end sm:justify-between">
        <Tabs tabs={RANGE_TABS} value={rangeMode} onChange={setRangeMode} />
        {rangeMode === "custom" ? (
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Start date">
              <Input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} />
            </Field>
            <Field label="End date">
              <Input type="date" value={customTo} min={customFrom || undefined} max={todayIso()} onChange={(event) => setCustomTo(event.target.value)} />
            </Field>
          </div>
        ) : null}
      </div>
      {rangeMode === "custom" && !customRangeReady ? <Alert tone="info">Pick a start and end date to load this range.</Alert> : null}

      <Card>
        <SectionHeader title={meta.title} description={`${rows.length} total.`} />
        <Field label="Search">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${meta.columnLabel.toLowerCase()}`} />
        </Field>

        {isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : filteredRows.length ? (
          <Table headers={[meta.columnLabel, "Count", ""]}>
            {filteredRows.map((row) => (
              <tr key={row.label}>
                <td className="font-medium text-foreground">{row.label}</td>
                <td className="text-muted-foreground">{row.count.toLocaleString()}</td>
                <td>
                  <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-secondary">
                    <div className="h-full rounded-full bg-info" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No data" description="Nothing recorded for this range yet." />
        )}
      </Card>
    </DashboardShell>
  );
}
