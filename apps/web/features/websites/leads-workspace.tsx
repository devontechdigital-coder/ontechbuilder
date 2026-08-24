"use client";

import { ArrowDownRight, ArrowUpRight, Calendar, Download, Loader2, Mail, Phone, Trash2, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
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
import type { LeadListSummary, LeadStats, LeadStatus, LeadSummary, WebsiteSummary } from "./types";

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

const STATUS_META: Record<LeadStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  NEW: { label: "New", tone: "info" },
  OPEN: { label: "Open", tone: "success" },
  QUALIFIED: { label: "Qualified", tone: "neutral" },
  MEETING_BOOKED: { label: "Meeting", tone: "warning" },
  FOLLOW_UP: { label: "Follow Up", tone: "warning" },
  CLOSED: { label: "Closed", tone: "danger" },
};

/** Forms are user-defined with arbitrary field names, so a lead's "name"/"email"/"phone" are found by best-effort key matching rather than assumed fixed columns. */
function extractLeadDisplay(data: Record<string, unknown>) {
  const entries = Object.entries(data).filter(([, value]) => typeof value === "string" && value.trim().length > 0) as Array<[string, string]>;
  const nameEntry = entries.find(([key]) => /name/i.test(key));
  const emailEntry = entries.find(([key]) => /email/i.test(key));
  const phoneEntry = entries.find(([key]) => /phone|tel(?:ephone)?$/i.test(key));
  return {
    name: nameEntry?.[1] ?? entries[0]?.[1] ?? "Untitled submission",
    email: emailEntry?.[1],
    phone: phoneEntry?.[1],
  };
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function toCsvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Leads = FormSubmission rows across every form on this website, filterable by which form they
 * came from and by a lightweight status pipeline (New/Open/Qualified/Meeting/Follow Up/Closed).
 * Name/email/phone shown per row are best-effort — a lead's real shape depends entirely on
 * whichever form it was submitted through, since fields are user-defined per form.
 */
export function LeadsWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [forms, setForms] = useState<Array<{ id: string; name: string }>>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [total, setTotal] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const pageSize = 20;

  const [formFilter, setFormFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void } | null>(null);
  const [detailLead, setDetailLead] = useState<LeadSummary | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  async function loadLeads(activeTenant: ActiveTenant) {
    setIsLoading(true);
    setError(null);
    try {
      const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
      setWebsite(websiteResponse);

      const searchParams = new URLSearchParams({ page: String(pageIndex) });
      if (formFilter !== "all") searchParams.set("formId", formFilter);
      if (statusFilter !== "all") searchParams.set("status", statusFilter);
      if (query.trim()) searchParams.set("q", query.trim());

      const response = await apiRequest<LeadListSummary>(`/websites/${id}/leads?${searchParams.toString()}`);
      setLeads(response.data);
      setTotal(response.total);
      setStats(response.stats);
      setForms(response.forms);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Leads failed to load");
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
          await loadLeads(meResponse.activeTenant);
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
    void loadLeads(me.activeTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formFilter, statusFilter, query, pageIndex, me?.activeTenant]);

  useEffect(() => {
    setPageIndex(1);
  }, [formFilter, statusFilter, query]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadLeads(response.activeTenant);
  }

  async function changeStatus(lead: LeadSummary, status: LeadStatus) {
    setStatusUpdatingId(lead.id);
    try {
      await apiRequest<LeadSummary>(`/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, status } : item)));
      toast.success("Lead status updated");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Status update failed");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function deleteLead(lead: LeadSummary) {
    try {
      await apiRequest(`/leads/${lead.id}`, { method: "DELETE" });
      if (me?.activeTenant) await loadLeads(me.activeTenant);
      toast.success("Lead deleted");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Delete failed");
    }
  }

  function exportCsv() {
    if (!leads.length) return;
    const fieldNames = Array.from(new Set(leads.flatMap((lead) => Object.keys(lead.data))));
    const headers = ["Lead", "Form", "Status", "Submitted", ...fieldNames];
    const rows = leads.map((lead) => {
      const display = extractLeadDisplay(lead.data);
      return [display.name, lead.form.name, STATUS_META[lead.status].label, lead.createdAt, ...fieldNames.map((field) => lead.data[field] ?? "")];
    });
    const csv = [headers, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${website?.slug ?? id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const statusTabs = [
    { value: "all", label: "All" },
    ...(Object.entries(STATUS_META) as Array<[LeadStatus, (typeof STATUS_META)[LeadStatus]]>).map(([value, meta]) => ({ value, label: meta.label })),
  ];

  if (!hasLoadedDashboardShell && (!me || !website)) {
    return <LoadingState label="Loading leads" />;
  }

  if (!me || !website) {
    return <LoadingState label="Loading leads" contentOnly={hasLoadedDashboardShell} />;
  }

  return (
    <DashboardShell
      title="All Leads"
      eyebrow={website.name}
      description="Every submission across this website's forms, in one filterable pipeline."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Leads" },
      ]}
      onTenantChange={switchTenant}
      actions={
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={!leads.length}>
          <Download className="size-4" />
          Export
        </Button>
      }
    >
      {error ? <Alert>{error}</Alert> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={Users} label="Total leads" value={stats.total} changePct={stats.totalChangePct} />
          <StatTile icon={TrendingUp} label="In progress" value={stats.inProgress} changePct={stats.inProgressChangePct} />
          <StatTile icon={Calendar} label="New today" value={stats.newToday} changePct={stats.newTodayChangePct} />
          <StatTile icon={Calendar} label="Meetings booked" value={stats.meetingsBooked} changePct={stats.meetingsBookedChangePct} />
        </div>
      ) : null}

      <Card>
        <SectionHeader title="Lead list" description="Filter by the form a lead came from, or by pipeline status." />

        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(queryInput);
          }}
        >
          <Field label="Search">
            <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search submission data" />
          </Field>
          <Field label="Form">
            <Select value={formFilter} onChange={(event) => setFormFilter(event.target.value)}>
              <option value="all">All forms</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Apply</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQueryInput("");
              setQuery("");
              setFormFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear
          </Button>
        </form>

        <Tabs tabs={statusTabs} value={statusFilter} onChange={setStatusFilter} />

        {isLoading ? (
          <LeadsTableSkeleton />
        ) : leads.length ? (
          <>
            <Table headers={["Lead", "Form", "Status", "Submitted", "Action"]}>
              {leads.map((lead) => {
                const display = extractLeadDisplay(lead.data);
                return (
                  <tr key={lead.id}>
                    <td>
                      <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => setDetailLead(lead)}>
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-[12px] font-semibold uppercase text-accent">
                          {display.name.slice(0, 1)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-semibold text-foreground">{display.name}</span>
                          {display.email ? <span className="block truncate text-[11px] text-muted-foreground">{display.email}</span> : null}
                        </span>
                      </button>
                    </td>
                    <td className="text-muted-foreground">{lead.form.name}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={STATUS_META[lead.status].tone}>{STATUS_META[lead.status].label}</Badge>
                        {statusUpdatingId === lead.id ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
                      </div>
                      <Select
                        aria-label={`Change status for ${display.name}`}
                        className="mt-1.5 h-7 text-[11px]"
                        value={lead.status}
                        disabled={statusUpdatingId === lead.id}
                        onChange={(event) => void changeStatus(lead, event.target.value as LeadStatus)}
                      >
                        {(Object.entries(STATUS_META) as Array<[LeadStatus, (typeof STATUS_META)[LeadStatus]]>).map(([value, meta]) => (
                          <option key={value} value={value}>
                            {meta.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="text-muted-foreground">{relativeTime(lead.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton label={`Call ${display.name}`} disabled={!display.phone} onClick={() => display.phone && window.open(`tel:${display.phone}`)}>
                          <Phone className="size-4" />
                        </IconButton>
                        <IconButton label={`Email ${display.name}`} disabled={!display.email} onClick={() => display.email && window.open(`mailto:${display.email}`)}>
                          <Mail className="size-4" />
                        </IconButton>
                        <IconButton
                          label={`Delete lead ${display.name}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setConfirm({ title: "Delete lead", description: `Permanently delete this lead from ${display.name}? This cannot be undone.`, action: () => void deleteLead(lead) })}
                        >
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
            <Pagination
              hasPrevious={pageIndex > 1}
              hasNext={pageIndex < pageCount}
              label={`Page ${pageIndex} of ${pageCount} · ${total} leads`}
              onPrevious={() => setPageIndex((current) => Math.max(1, current - 1))}
              onNext={() => setPageIndex((current) => current + 1)}
            />
          </>
        ) : (
          <EmptyState title="No leads yet" description="Leads appear here as soon as a visitor submits one of this website's forms." />
        )}
      </Card>

      <Sheet open={Boolean(detailLead)} title="Lead detail" onClose={() => setDetailLead(null)}>
        {detailLead ? (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">From form</p>
              <p className="text-[13px] font-medium text-foreground">{detailLead.form.name}</p>
            </div>
            <div className="grid gap-1">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
              <p className="text-[13px] font-medium text-foreground">{new Date(detailLead.createdAt).toLocaleString()}</p>
            </div>
            <div className="grid gap-2 border-t pt-3">
              {Object.entries(detailLead.data).map(([key, value]) => (
                <div key={key} className="grid gap-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{key}</p>
                  <p className="break-words text-[12.5px] leading-5 text-foreground">
                    {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                  </p>
                </div>
              ))}
            </div>
            {!detailLead.mailSent && detailLead.mailError ? <Alert>Notification email failed: {detailLead.mailError}</Alert> : null}
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        danger
        confirmLabel="Delete"
        onConfirm={() => {
          confirm?.action();
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </DashboardShell>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  changePct,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  changePct: number;
}) {
  const positive = changePct >= 0;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <Icon className="size-4.5" />
        </span>
        <span className={`flex items-center gap-0.5 text-[11.5px] font-semibold ${positive ? "text-success" : "text-destructive"}`}>
          {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(changePct)}%
        </span>
      </div>
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <p className="text-[22px] font-semibold leading-tight text-foreground">{value.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground">vs. last period</p>
      </div>
    </Card>
  );
}

function LeadsTableSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={`lead-skeleton-${index}`} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
