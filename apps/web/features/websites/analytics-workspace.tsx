"use client";

import { ArrowDownRight, ArrowUpRight, Eye, ExternalLink, Globe2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Alert, Card, LoadingState, SectionHeader, Skeleton } from "../../components/ui/display";
import { Field, Input } from "../../components/ui/form";
import { Tabs } from "../../components/ui/navigation";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import { buildRangeParams, daysAgoIso, RANGE_TABS, todayIso } from "./analytics-range";
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

/**
 * Chart colors are this app's own success/info/destructive tokens, chosen and verified with the
 * dataviz skill's validator (info+success passes cleanly for the 2-line time series; info+success+
 * destructive passes the categorical checks for the 3-slice device donut, with the required direct
 * labels covering its one WARN-band adjacent pair) — not an arbitrary palette.
 */
const COLOR_PAGE_VIEWS = "hsl(var(--info))";
const COLOR_SESSIONS = "hsl(var(--success))";
const DEVICE_COLORS: Record<string, string> = {
  desktop: "hsl(var(--info))",
  mobile: "hsl(var(--success))",
  tablet: "hsl(var(--destructive))",
};

function formatBucketLabel(timestamp: string, spanDays: number) {
  const date = new Date(timestamp);
  if (spanDays <= 2) return date.toLocaleTimeString(undefined, { hour: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AnalyticsWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [rangeMode, setRangeMode] = useState("7");
  const [customFrom, setCustomFrom] = useState(() => daysAgoIso(30));
  const [customTo, setCustomTo] = useState(() => todayIso());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customRangeReady = rangeMode !== "custom" || Boolean(customFrom && customTo && customFrom <= customTo);

  async function loadAnalytics(activeTenant: ActiveTenant) {
    if (!customRangeReady) return;
    setIsLoading(true);
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);
      const response = await apiRequest<AnalyticsData>(`/websites/${id}/analytics?${buildRangeParams(rangeMode, customFrom, customTo).toString()}`);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analytics failed to load");
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
        if (meResponse.activeTenant) await loadAnalytics(meResponse.activeTenant);
      } catch {
        setError("Failed to load analytics");
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!me?.activeTenant) return;
    void loadAnalytics(me.activeTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeMode, customFrom, customTo, me?.activeTenant]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadAnalytics(response.activeTenant);
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

  const rangeParams = buildRangeParams(rangeMode, customFrom, customTo).toString();

  const deviceData = (data?.sessionsByDevice ?? []).map((row) => ({
    name: row.deviceType.charAt(0).toUpperCase() + row.deviceType.slice(1),
    value: row.count,
    color: DEVICE_COLORS[row.deviceType] ?? "hsl(var(--muted-foreground))",
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
      title="Analytics"
      eyebrow={website.name}
      description="Traffic, sessions, and where visitors come from — driven by page views recorded across this website."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Analytics" },
      ]}
      onTenantChange={switchTenant}
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

      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile icon={Eye} label="Page views" value={data.totalPageViews} />
            <StatTile icon={Globe2} label="Sessions" value={data.totalSessions} changePct={data.sessionsChangePct} />
            <StatTile icon={TrendingUp} label="Top page" value={data.topPages[0]?.path ?? "—"} isText />
          </div>

          <Card>
            <SectionHeader
              title="Traffic over time"
              description="Page views and sessions for the selected range."
              actions={
                <Link
                  href={`/websites/${website.id}/analytics/traffic?${rangeParams}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-info hover:underline"
                >
                  View all
                  <ExternalLink className="size-3" />
                </Link>
              }
            />
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillPageViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLOR_PAGE_VIEWS} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={COLOR_PAGE_VIEWS} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="pageViews" name="Page views" stroke={COLOR_PAGE_VIEWS} strokeWidth={2} fill="url(#fillPageViews)" />
                  <Area type="monotone" dataKey="sessions" name="Sessions" stroke={COLOR_SESSIONS} strokeWidth={2} fill="url(#fillSessions)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No traffic recorded for this range yet." />
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card>
              <SectionHeader title="Sessions by device" />
              {deviceData.length ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={deviceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {deviceData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="hsl(var(--surface))" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--surface))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid gap-1.5">
                    {deviceData.map((entry) => (
                      <div key={entry.name} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.name}
                        </span>
                        <span className="text-muted-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyChart label="No device data yet." />
              )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <BarListCard
                title="Top pages"
                rows={data.topPages.map((row) => ({ label: row.path, count: row.count }))}
                viewAllHref={`/websites/${website.id}/analytics/pages?${rangeParams}`}
              />
              <BarListCard
                title="Traffic sources"
                rows={data.trafficSources.map((row) => ({ label: row.label, count: row.count }))}
                viewAllHref={`/websites/${website.id}/analytics/sources?${rangeParams}`}
              />
              <BarListCard title="Sessions by location" rows={data.sessionsByLocation.map((row) => ({ label: row.label, count: row.count }))} className="sm:col-span-2" />
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  changePct,
  isText,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
  changePct?: number;
  isText?: boolean;
}) {
  const hasChange = typeof changePct === "number";
  const positive = (changePct ?? 0) >= 0;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <Icon className="size-4.5" />
        </span>
        {hasChange ? (
          <span className={`flex items-center gap-0.5 text-[11.5px] font-semibold ${positive ? "text-success" : "text-destructive"}`}>
            {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(changePct)}%
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <p className={isText ? "truncate text-[15px] font-semibold leading-tight text-foreground" : "text-[22px] font-semibold leading-tight text-foreground"}>
          {isText ? value : Number(value).toLocaleString()}
        </p>
      </div>
    </Card>
  );
}

function BarListCard({
  title,
  rows,
  className,
  viewAllHref,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  className?: string;
  viewAllHref?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card {...(className ? { className } : {})}>
      <SectionHeader
        title={title}
        actions={
          viewAllHref ? (
            <Link
              href={viewAllHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11.5px] font-semibold text-info hover:underline"
            >
              View all
              <ExternalLink className="size-3" />
            </Link>
          ) : undefined
        }
      />
      {rows.length ? (
        <div className="grid gap-2.5">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate font-medium text-foreground">{row.label}</span>
                <span className="shrink-0 text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                <div className="h-full rounded-full bg-info" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyChart label="No data yet." />
      )}
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <p className="py-8 text-center text-[12.5px] text-muted-foreground">{label}</p>;
}
