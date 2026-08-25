"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

const COLOR_PAGE_VIEWS = "hsl(var(--info))";
const COLOR_SESSIONS = "hsl(var(--success))";

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

function formatBucketLabel(timestamp: string, spanDays: number) {
  const date = new Date(timestamp);
  if (spanDays <= 2) return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full traffic-over-time detail behind the Analytics dashboard's "View all" link — same chart, plus every bucket as a raw data table (the card only shows the plot). */
export function AnalyticsTrafficWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRange = parseRangeFromSearchParams(searchParams);
  const [rangeMode, setRangeMode] = useState(initialRange.rangeMode);
  const [customFrom, setCustomFrom] = useState(initialRange.customFrom);
  const [customTo, setCustomTo] = useState(initialRange.customTo);
  const customRangeReady = rangeMode !== "custom" || Boolean(customFrom && customTo && customFrom <= customTo);

  async function loadData(activeTenant: ActiveTenant) {
    if (!customRangeReady) return;
    setIsLoading(true);
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);
      const response = await apiRequest<AnalyticsData>(`/websites/${id}/analytics?${buildRangeParams(rangeMode, customFrom, customTo).toString()}`);
      setData(response);
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
  }, [id]);

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
    if (!data?.series.length) return;
    const csv = [["Time", "Page views", "Sessions"], ...data.series.map((point) => [point.timestamp, point.pageViews, point.sessions])]
      .map((row) => row.map(toCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `traffic-${website?.slug ?? id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const activeSpanDays =
    rangeMode === "custom" && customFrom && customTo
      ? Math.max(1, (new Date(customTo).getTime() - new Date(customFrom).getTime()) / (24 * 60 * 60 * 1000))
      : Number(rangeMode);

  const chartData = (data?.series ?? []).map((point) => ({
    label: formatBucketLabel(point.timestamp, activeSpanDays),
    pageViews: point.pageViews,
    sessions: point.sessions,
  }));

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
      title="Traffic over time"
      eyebrow={website.name}
      description="Page views and sessions for every recorded interval in the selected range."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Analytics", href: `/websites/${website.id}/analytics` },
        { label: "Traffic over time" },
      ]}
      onTenantChange={switchTenant}
      actions={
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={!data?.series.length}>
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
        <SectionHeader title="Traffic over time" description={`${data?.series.length ?? 0} intervals.`} />
        {isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : chartData.length ? (
          <ResponsiveContainer width="100%" height={420}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="fillPageViewsFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_PAGE_VIEWS} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={COLOR_PAGE_VIEWS} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillSessionsFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_SESSIONS} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={COLOR_SESSIONS} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--surface))" }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="pageViews" name="Page views" stroke={COLOR_PAGE_VIEWS} strokeWidth={2} fill="url(#fillPageViewsFull)" />
              <Area type="monotone" dataKey="sessions" name="Sessions" stroke={COLOR_SESSIONS} strokeWidth={2} fill="url(#fillSessionsFull)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No traffic yet" description="Nothing recorded for this range yet." />
        )}
      </Card>

      <Card>
        <SectionHeader title="Raw data" description="Every interval behind the chart above." />
        {isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-9 rounded-lg" />
            ))}
          </div>
        ) : data?.series.length ? (
          <Table headers={["Time", "Page views", "Sessions"]}>
            {[...data.series].reverse().map((point) => (
              <tr key={point.timestamp}>
                <td className="font-medium text-foreground">{new Date(point.timestamp).toLocaleString()}</td>
                <td className="text-muted-foreground">{point.pageViews.toLocaleString()}</td>
                <td className="text-muted-foreground">{point.sessions.toLocaleString()}</td>
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
