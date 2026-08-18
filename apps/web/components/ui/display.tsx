import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

const dotClasses: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
};

export function Card({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid content-start gap-4 rounded-xl border bg-surface p-4", className)}>
      {title || action ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{eyebrow}</p>
            ) : null}
            {title ? <h2 className="text-[14.5px] font-semibold leading-5 text-foreground">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-full border border-current/15 px-2 text-[11px] font-semibold capitalize leading-none",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatusIndicator({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", dotClasses[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[12.5px] leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold leading-5 text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Alert({ children, tone = "danger" }: { children: ReactNode; tone?: "danger" | "info" | "success" }) {
  const classes = {
    danger: "border-destructive/20 bg-destructive/10 text-destructive",
    info: "border-info/20 bg-info/10 text-info",
    success: "border-success/20 bg-success/10 text-success",
  };
  return (
    <div className={cn("rounded-md border px-2.5 py-2 text-[12.5px] font-medium", classes[tone])} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2.5 rounded-lg border border-dashed bg-surface-secondary/60 px-5 py-8 text-center">
      <div className="flex size-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Plus className="size-4" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
        <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="mt-0.5">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[#f1f1f4]", className)} aria-hidden="true" />;
}

function SidebarSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn(
        "border border-white/70 bg-white/80 shadow-sm shadow-slate-950/5",
        className,
      )}
    />
  );
}

export function LoadingState({ label = "Loading", contentOnly = false }: { label?: string; contentOnly?: boolean }) {
  const normalized = label.toLowerCase();

  if (normalized.includes("builder")) {
    return <BuilderSkeleton label={label} contentOnly={contentOnly} />;
  }

  if (
    normalized.includes("website") ||
    normalized.includes("content") ||
    normalized.includes("media") ||
    normalized.includes("entry")
  ) {
    return <TablePageSkeleton label={label} contentOnly={contentOnly} />;
  }

  return <DashboardPageSkeleton label={label} contentOnly={contentOnly} />;
}

function SkeletonShell({ label, children, contentOnly = false }: { label: string; children: ReactNode; contentOnly?: boolean | undefined }) {
  if (contentOnly) {
    return (
      <div className="min-h-[calc(100svh-5.5rem)] bg-white" role="status" aria-label={label}>
        <section className="bg-white px-4 py-4 md:px-6">
          <div className="mx-auto grid w-full max-w-[1440px] gap-2">
            <Skeleton className="h-6 w-56 max-w-full bg-[#ececf1]" />
            <Skeleton className="h-3.5 w-[420px] max-w-full bg-[#f0f0f4]" />
          </div>
        </section>
        <div className="mx-auto grid w-full max-w-[1440px] gap-4 bg-white px-4 pb-6 md:px-6">
          <p className="sr-only">{label}</p>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-background" role="status" aria-label={label}>
      <div className="flex min-h-svh w-full gap-0 bg-background p-0 md:p-2.5">
        {!contentOnly ? (
          <aside className="hidden min-h-[calc(100svh-1.25rem)] w-[228px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
            <div className="flex flex-col gap-3 p-3">
              <div className="flex h-9 items-center gap-2.5 px-1">
                <SidebarSkeleton className="size-7 rounded-md" />
                <SidebarSkeleton className="h-3.5 w-28" />
              </div>
              <SidebarSkeleton className="h-[46px] rounded-lg" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-3 py-1">
              <div className="grid gap-0.5">
                <SidebarSkeleton className="ml-2 mb-1 h-2.5 w-20" />
                {Array.from({ length: 2 }).map((_, index) => (
                  <SidebarSkeleton key={`nav-top-${index}`} className="h-9 rounded-md" />
                ))}
              </div>
              <div className="grid gap-0.5">
                <SidebarSkeleton className="ml-2 mb-1 h-2.5 w-16" />
                {Array.from({ length: 4 }).map((_, index) => (
                  <SidebarSkeleton key={`nav-content-${index}`} className="h-9 rounded-md" />
                ))}
              </div>
            </div>
            <div className="p-3">
              <SidebarSkeleton className="h-11 rounded-md" />
            </div>
          </aside>
        ) : null}
        <main className="mx-auto flex min-w-0 flex-1 flex-col overflow-hidden border bg-white shadow-sm shadow-slate-950/5 md:rounded-xl">
          <header className="flex h-14 items-center gap-3 border-b bg-surface px-3 md:px-5">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="hidden h-3.5 w-40 md:block" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="hidden h-8 w-[300px] rounded-md lg:block" />
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-7 rounded-full" />
            </div>
          </header>
          <section className="bg-surface px-4 py-4 md:px-6">
            <div className="mx-auto grid w-full max-w-[1440px] gap-2">
              <Skeleton className="h-6 w-56 max-w-full" />
              <Skeleton className="h-3.5 w-[420px] max-w-full" />
            </div>
          </section>
          <div className="mx-auto grid w-full max-w-[1440px] gap-4 px-4 pb-6 md:px-6">
            <p className="sr-only">{label}</p>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardPageSkeleton({ label, contentOnly }: { label: string; contentOnly?: boolean }) {
  return (
    <SkeletonShell label={label} contentOnly={contentOnly}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonCard key={`dashboard-kpi-${index}`} lines={1} compact />
        ))}
      </section>
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonCard key={`dashboard-card-${index}`} lines={index === 0 ? 5 : 4} />
        ))}
      </section>
    </SkeletonShell>
  );
}

function TablePageSkeleton({ label, contentOnly }: { label: string; contentOnly?: boolean }) {
  return (
    <SkeletonShell label={label} contentOnly={contentOnly}>
      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={`metric-${index}`} lines={3} compact />
        ))}
      </section>
      <section className="grid gap-5 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid gap-3 rounded-lg border bg-[#fbfbfc] p-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px_auto]">
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[760px]">
          <div className="grid grid-cols-5 gap-3 border-b bg-[#fafafa] p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={`head-${index}`} className="h-4" />
            ))}
          </div>
          {Array.from({ length: 7 }).map((_, row) => (
            <div key={`row-${row}`} className="grid grid-cols-5 gap-3 border-b p-3 last:border-b-0">
              {Array.from({ length: 5 }).map((__, column) => (
                <Skeleton key={`cell-${row}-${column}`} className="h-8 rounded-lg" />
              ))}
            </div>
          ))}
          </div>
        </div>
      </section>
    </SkeletonShell>
  );
}

function BuilderSkeleton({ label, contentOnly }: { label: string; contentOnly?: boolean }) {
  return (
    <SkeletonShell label={label} contentOnly={contentOnly}>
      <div className="grid min-h-[calc(100vh-220px)] overflow-hidden rounded-lg border bg-surface xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        <aside className="hidden border-r p-4 xl:grid xl:content-start xl:gap-5">
          <Skeleton className="h-7 w-32" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={`block-${index}`} className="h-10 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-px w-full" />
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={`layer-${index}`} className="h-9 rounded-lg" />
          ))}
        </aside>
        <main className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
          <div className="flex items-center justify-between border-b bg-surface p-4">
            <Skeleton className="h-6 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
          <div className="p-5">
            <Skeleton className="mx-auto h-[640px] w-full max-w-[1024px] rounded-lg" />
          </div>
        </main>
        <aside className="hidden border-l p-4 xl:grid xl:content-start xl:gap-4">
          <Skeleton className="h-7 w-36" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`inspector-${index}`} className="h-20 rounded-lg" />
          ))}
        </aside>
      </div>
    </SkeletonShell>
  );
}

function SkeletonCard({ lines, compact }: { lines: number; compact?: boolean }) {
  return (
    <section className="grid content-start gap-3 rounded-xl border bg-white p-4">
      <div className="grid gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className={compact ? "h-6 w-16" : "h-5 w-36"} />
      </div>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={`line-${index}`}
          className={cn(compact ? "h-3" : "h-9 rounded-lg", index % 2 === 0 ? "w-full" : "w-2/3")}
        />
      ))}
    </section>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
