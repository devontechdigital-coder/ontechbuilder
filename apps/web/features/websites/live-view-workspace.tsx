"use client";

import createGlobe from "cobe";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!me?.activeTenant) return;
    const interval = setInterval(() => void loadLiveView(me.activeTenant!), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.activeTenant]);

  useEffect(() => {
    markersRef.current = (data?.points ?? []).map((point) => ({
      location: [point.lat, point.lng] as [number, number],
      size: 0.06,
    }));
  }, [data?.points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = canvas.offsetWidth;
    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.3,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [1, 1, 1],
      markerColor: MARKER_COLOR,
      glowColor: [1, 1, 1],
      markers: markersRef.current,
    });

    const onResize = () => {
      width = canvas.offsetWidth;
      globe.update({ width: width * 2, height: width * 2 });
    };
    window.addEventListener("resize", onResize);

    let phi = 0;
    let animationFrame: number;
    function render() {
      phi += 0.004;
      globe.update({ phi, markers: markersRef.current });
      animationFrame = requestAnimationFrame(render);
    }
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadLiveView(response.activeTenant);
  }

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

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <p className="text-[12px] font-semibold text-muted-foreground">Live</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                <Users className="size-4.5" />
              </span>
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">Visitors right now</p>
                <p className="text-[22px] font-semibold leading-tight text-foreground">{data?.visitorsRightNow ?? 0}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                <Radio className="size-4.5" />
              </span>
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">Sessions today</p>
                <p className="text-[22px] font-semibold leading-tight text-foreground">{data?.sessionsToday ?? 0}</p>
              </div>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Sessions by location" />
            {data?.sessionsByLocation.length ? (
              <div className="grid gap-2">
                {data.sessionsByLocation.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate font-medium text-foreground">{row.label}</span>
                    <span className="shrink-0 text-muted-foreground">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-[12px] text-muted-foreground">No sessions recorded today yet.</p>
            )}
          </Card>
        </div>

        <Card className="grid min-h-[520px] place-items-center overflow-hidden !p-0">
          <div className="relative aspect-square w-[480px] max-w-full">
            <canvas ref={canvasRef} className="absolute inset-0 size-full" />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
