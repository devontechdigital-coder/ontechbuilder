"use client";

import {
  Archive,
  ArrowUpRight,
  CircleCheck,
  FileEdit,
  Globe,
  LayoutList,
  Palette,
  PanelsTopLeft,
  Plus,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../components/layout/dashboard-shell";
import { ButtonLink } from "../components/ui/button";
import { Alert, Badge, Card, EmptyState, LoadingState } from "../components/ui/display";
import { LandingPage } from "../features/marketing/landing-page";
import { apiRequest } from "../lib/api";
import { cn } from "../lib/utils";
import type { ActiveTenant, SafeUser, TenantSummary } from "../features/auth/types";
import type { PageResult, WebsiteSummary } from "../features/websites/types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

type Tone = "neutral" | "success" | "warning" | "info";

const statusTone: Record<WebsiteSummary["status"], "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

export default function HomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [websites, setWebsites] = useState<WebsiteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const published = websites.filter((website) => website.status === "PUBLISHED").length;
    const drafts = websites.filter((website) => website.status === "DRAFT").length;
    const archived = websites.filter((website) => website.status === "ARCHIVED").length;
    return {
      total: websites.length,
      published,
      drafts,
      archived,
      liveRate: websites.length ? Math.round((published / websites.length) * 100) : 0,
      recent: [...websites].sort(
        (first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
      ),
    };
  }, [websites]);

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
          const websiteResponse = await apiRequest<PageResult<WebsiteSummary>>(
            `/tenants/${meResponse.activeTenant.id}/websites?limit=5`,
          );
          setWebsites(websiteResponse.data);
        }
      } catch {
        // No session — the render below falls back to the public landing page rather than forcing a redirect.
        setMe(null);
      } finally {
        setAuthChecked(true);
      }
    }

    void load();
  }, []);

  async function switchTenant(tenantId: string) {
    setError(null);

    try {
      const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
        method: "POST",
        body: JSON.stringify({ tenantId }),
      });
      setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
      const websiteResponse = await apiRequest<PageResult<WebsiteSummary>>(
        `/tenants/${response.activeTenant.id}/websites?limit=5`,
      );
      setWebsites(websiteResponse.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Tenant switch failed");
    }
  }

  if (!authChecked) {
    return <LoadingState label="Checking your session" />;
  }

  if (!me) {
    return <LandingPage />;
  }

  const firstName = (me.user.displayName ?? me.user.email).split(/[\s@._-]+/)[0];
  const greeting = `${getTimeGreeting()}, ${capitalize(firstName ?? "there")}`;

  return (
    <DashboardShell
      title={greeting}
      eyebrow="Overview"
      description="Everything in this workspace at a glance — what's live, what's mid-flight, and where to pick up."
      me={me}
      tenants={tenants}
      breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Overview" }]}
      actions={
        me.activeTenant ? (
          <>
            <ButtonLink href="/websites" variant="secondary">
              <PanelsTopLeft />
              All websites
            </ButtonLink>
            <ButtonLink href="/websites">
              <Plus />
              New website
            </ButtonLink>
          </>
        ) : null
      }
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total websites"
          value={stats.total}
          icon={Globe}
          tone="neutral"
          hint={stats.total ? `${stats.liveRate}% published` : "None yet"}
        />
        <StatTile
          label="Published"
          value={stats.published}
          icon={CircleCheck}
          tone="success"
          hint={stats.published ? "Live and serving" : "Nothing live yet"}
        />
        <StatTile
          label="Drafts"
          value={stats.drafts}
          icon={FileEdit}
          tone="warning"
          hint={stats.drafts ? "Awaiting publish" : "No drafts open"}
        />
        <StatTile
          label="Archived"
          value={stats.archived}
          icon={Archive}
          tone="neutral"
          hint={stats.archived ? "Kept for reference" : "Nothing archived"}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="Recent websites"
          eyebrow="Activity"
          action={
            websites.length ? (
              <Link
                className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                href="/websites"
              >
                View all
                <ArrowUpRight className="size-3.5" />
              </Link>
            ) : null
          }
        >
          {stats.recent.length ? (
            <ul className="grid gap-1">
              {stats.recent.map((website) => (
                <li key={website.id}>
                  <Link
                    className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface-secondary"
                    href={`/websites/${website.id}`}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-surface-secondary text-[12px] font-semibold uppercase text-muted-foreground"
                      aria-hidden="true"
                    >
                      {website.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{website.name}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">/{website.slug}</span>
                    </span>
                    <span className="hidden shrink-0 text-[11.5px] text-muted-foreground sm:block">
                      {formatRelative(website.updatedAt)}
                    </span>
                    <Badge tone={statusTone[website.status]}>{website.status.toLowerCase()}</Badge>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={me.activeTenant ? "No websites yet" : "No workspace selected"}
              description={
                me.activeTenant
                  ? "Create your first website to start adding pages, themes, and domains."
                  : "Pick a workspace from the header to see its websites here."
              }
              action={me.activeTenant ? <ButtonLink href="/websites">Create website</ButtonLink> : null}
            />
          )}
        </Card>

        <div className="grid content-start gap-3">
          <Card title="Next steps" eyebrow="Setup">
            {me.activeTenant ? (
              <ul className="grid gap-1.5">
                {buildNextSteps(stats).map((step) => (
                  <li
                    key={step.title}
                    className="flex items-start gap-2.5 rounded-lg border bg-surface-secondary/50 px-2.5 py-2"
                  >
                    <span
                      className={cn(
                        "mt-px flex size-5 shrink-0 items-center justify-center rounded-md",
                        step.done ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                      )}
                      aria-hidden="true"
                    >
                      <step.icon className="size-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium leading-4 text-foreground">{step.title}</span>
                      <span className="block text-[11.5px] leading-4 text-muted-foreground">{step.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Select a workspace" description="Choose a workspace to reveal setup actions." />
            )}
          </Card>

          <Card title="Quick actions" eyebrow="Shortcuts">
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href="/websites" icon={PanelsTopLeft} label="Websites" />
              <QuickAction href="/content" icon={LayoutList} label="Content" />
              <QuickAction href="/media" icon={Palette} label="Media" />
              <QuickAction href="/websites" icon={Settings} label="Settings" />
            </div>
            <p className="text-[11.5px] leading-4 text-muted-foreground">
              Need another account?{" "}
              <Link className="font-medium text-accent hover:underline" href="/register">
                Register a new workspace
              </Link>
            </p>
          </Card>
        </div>
      </section>
    </DashboardShell>
  );
}

const toneStyles: Record<Tone, { chip: string; accent: string }> = {
  neutral: { chip: "bg-muted text-muted-foreground", accent: "bg-muted-foreground/25" },
  success: { chip: "bg-success/10 text-success", accent: "bg-success" },
  warning: { chip: "bg-warning/10 text-warning", accent: "bg-warning" },
  info: { chip: "bg-info/10 text-info", accent: "bg-info" },
};

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: Tone;
  hint: string;
}) {
  const styles = toneStyles[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border bg-surface p-3.5 transition-shadow hover:shadow-sm hover:shadow-slate-950/5">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", styles.accent)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", styles.chip)} aria-hidden="true">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold leading-none tracking-tight text-foreground tabular">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      className="flex items-center gap-2 rounded-lg border bg-surface px-2.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-input hover:bg-surface-secondary"
      href={href}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function buildNextSteps(stats: { total: number; published: number; drafts: number; archived: number }) {
  const steps: Array<{ title: string; description: string; done: boolean; icon: LucideIcon }> = [
    {
      title: stats.total ? `${stats.total} website${stats.total === 1 ? "" : "s"} created` : "Create your first website",
      description: stats.total ? "Workspace has website records." : "Start by adding a website record.",
      done: stats.total > 0,
      icon: stats.total ? CircleCheck : Plus,
    },
    {
      title: stats.published ? `${stats.published} published` : "Publish a website",
      description: stats.published ? "Live records are serving traffic." : "Move a draft to published when it's ready.",
      done: stats.published > 0,
      icon: stats.published ? CircleCheck : Globe,
    },
  ];

  if (stats.drafts) {
    steps.push({
      title: `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"} in progress`,
      description: "Finish pages, domains, and themes, then publish.",
      done: false,
      icon: FileEdit,
    });
  }

  if (stats.archived) {
    steps.push({
      title: `${stats.archived} archived`,
      description: "Restore or audit older records when needed.",
      done: true,
      icon: Archive,
    });
  }

  return steps;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMinutes = Math.round((Date.now() - then) / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
