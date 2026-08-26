"use client";

import createGlobe from "cobe";
import type { Globe } from "cobe";
import { Radio, Users } from "lucide-react";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Alert, Card, LoadingState, SectionHeader } from "../../components/ui/display";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import type { LiveViewData, WebsiteSummary } from "./types";

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

const POLL_INTERVAL_MS = 8000;
const GLOBE_BASE_COLOR: [number, number, number] = [1, 1, 1];
const GLOBE_GLOW_COLOR: [number, number, number] = [1, 1, 1];
const MARKER_COLOR: [number, number, number] = [251 / 255, 100 / 255, 21 / 255];

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

export function LiveViewWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [data, setData] = useState<LiveViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globeFrame, setGlobeFrame] = useState<HTMLDivElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const markersRef = useRef<Array<{ location: [number, number]; size: number }>>([]);

  async function loadLiveView(activeTenant: ActiveTenant) {
    try {
      if (!website) {
        const websiteResponse = await apiRequest<WebsiteSummary>(`/tenants/${activeTenant.id}/websites/${id}`);
        setWebsite(websiteResponse);
      }
      const response = await apiRequest<LiveViewData>(`/websites/${id}/analytics/live`);
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Live view failed to load");
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
        if (meResponse.activeTenant) await loadLiveView(meResponse.activeTenant);
      } catch {
        setError("Failed to load live view");
      }
    }
    void load();
  }, [id]);

  useEffect(() => {
    if (!me?.activeTenant) return;
    const interval = setInterval(() => void loadLiveView(me.activeTenant!), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [me?.activeTenant]);

  useEffect(() => {
    markersRef.current = (data?.points ?? []).map((point) => ({
      location: [point.lat, point.lng] as [number, number],
      size: 0.06,
    }));
  }, [data?.points]);

  useEffect(() => {
    if (!canvasEl || !globeFrame) return;
    const canvasElement = canvasEl;
    const frameElement = globeFrame;

    let globe: Globe | null = null;
    let size = 0;
    let phi = 0;
    let animationFrame = 0;
    let dragStartX: number | null = null;
    let dragStartPhi = 0;

    function getFrameSize() {
      return Math.floor(Math.min(frameElement.clientWidth, frameElement.clientHeight));
    }

    function applySize(nextSize: number) {
      if (!nextSize) return;
      size = nextSize;
      const renderSize = size * 2;
      canvasElement.width = renderSize;
      canvasElement.height = renderSize;
      globe?.update({ width: renderSize, height: renderSize });
    }

    function ensureGlobe() {
      if (globe || !size) return;
      globe = createGlobe(canvasElement, {
        devicePixelRatio: 1,
        width: size * 2,
        height: size * 2,
        phi: 0,
        theta: 0.3,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: GLOBE_BASE_COLOR,
        markerColor: MARKER_COLOR,
        glowColor: GLOBE_GLOW_COLOR,
        markers: markersRef.current,
      });
    }

    function render() {
      const nextSize = getFrameSize();
      if (nextSize && nextSize !== size) {
        applySize(nextSize);
      }
      ensureGlobe();
      if (globe) {
        // Auto-rotation pauses while the user is actively dragging (dragStartX set) —
        // otherwise every drag delta would fight the constant auto-increment.
        if (dragStartX === null) phi += 0.004;
        globe.update({ phi, markers: markersRef.current });
      }
      animationFrame = requestAnimationFrame(render);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextSize = Math.floor(Math.min(entry.contentRect.width, entry.contentRect.height));
      applySize(nextSize);
      ensureGlobe();
    });

    function onPointerDown(event: PointerEvent) {
      dragStartX = event.clientX;
      dragStartPhi = phi;
      canvasElement.style.cursor = "grabbing";
    }

    function onPointerMove(event: PointerEvent) {
      if (dragStartX === null) return;
      phi = dragStartPhi + (event.clientX - dragStartX) / 200;
    }

    function stopDragging() {
      dragStartX = null;
      canvasElement.style.cursor = "grab";
    }

    canvasElement.style.cursor = "grab";
    canvasElement.style.touchAction = "none";
    canvasElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    observer.observe(frameElement);
    applySize(getFrameSize());
    ensureGlobe();
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      canvasElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      globe?.destroy();
    };
  }, [canvasEl, globeFrame]);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadLiveView(response.activeTenant);
  }

  const maxLocationCount = useMemo(
    () => Math.max(1, ...(data?.sessionsByLocation.map((row) => row.count) ?? [1])),
    [data?.sessionsByLocation],
  );

  if (!me || !website) {
    if (hasLoadedDashboardShell && me) {
      return (
        <DashboardShell
          title="Loading live view"
          eyebrow="Website"
          description="Loading the latest live view data."
          me={me}
          tenants={tenants}
          breadcrumbs={[{ label: "Workspace", href: "/" }, { label: "Websites", href: "/websites" }]}
          onTenantChange={switchTenant}
        >
          <LoadingState label="Loading live view" contentOnly />
        </DashboardShell>
      );
    }
    return <LoadingState label="Loading live view" contentOnly={hasLoadedDashboardShell} />;
  }

  return (
    <DashboardShell
      title="Live View"
      eyebrow={website.name}
      description="Visitors on this website right now, plotted live on the globe."
      me={me}
      tenants={tenants}
      breadcrumbs={[
        { label: "Workspace", href: "/" },
        { label: "Websites", href: "/websites" },
        { label: website.name, href: `/websites/${website.id}` },
        { label: "Live View" },
      ]}
      onTenantChange={switchTenant}
    >
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          {/* Hero panel: live status + the two headline numbers, unified */}
          <Card className="relative overflow-hidden !p-0">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Live
              </p>
            </div>

            <div className="grid gap-4 px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 text-accent ring-1 ring-accent/10">
                  <Users className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-muted-foreground">Visitors right now</p>
                  <p className="text-[32px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                    {data?.visitorsRightNow ?? 0}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border/60" />

              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                  <Radio className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-muted-foreground">Sessions today</p>
                  <p className="text-[20px] font-semibold leading-tight text-foreground tabular-nums">
                    {data?.sessionsToday ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="transition-shadow hover:shadow-sm">
            <SectionHeader title="Sessions by location" />
            {data?.sessionsByLocation.length ? (
              <div className="grid gap-1.5">
                {data.sessionsByLocation.map((row, index) => (
                  <div
                    key={row.label}
                    className="group relative overflow-hidden rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-md bg-accent/10 transition-all group-hover:bg-accent/15"
                      style={{ width: `${Math.max(6, (row.count / maxLocationCount) * 100)}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2 text-[12px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground/70">
                          {index + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium text-foreground">{row.label}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-foreground">{row.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-[12px] text-muted-foreground">No sessions recorded today yet.</p>
            )}
          </Card>
        </div>

        <Card className="relative grid min-h-[520px] place-items-center overflow-hidden !p-0">
          {/* Ambient glow behind the globe for depth, using the existing accent color */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 65%)",
            }}
          />

          <div className="relative aspect-square w-[480px] max-w-full">
         <div ref={setGlobeFrame} className="relative aspect-square w-[480px] max-w-full">
    <canvas ref={setCanvasEl} className="absolute inset-0 size-full" />
  </div>

            <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {data?.visitorsRightNow ?? 0} live
              </span>
            </div>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}