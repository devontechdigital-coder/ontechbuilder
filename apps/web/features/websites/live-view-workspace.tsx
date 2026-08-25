"use client";

import { Radio, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { DashboardShell } from "../../components/layout/dashboard-shell";
import { Alert, Card, LoadingState, SectionHeader } from "../../components/ui/display";
import { apiRequest } from "../../lib/api";
import type { ActiveTenant, SafeUser, TenantSummary } from "../auth/types";
import type { GlobeMethods } from "react-globe.gl";
import type { LiveViewData, WebsiteSummary } from "./types";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface MeResponse {
  user: SafeUser;
  activeTenant: ActiveTenant | null;
}

const POLL_INTERVAL_MS = 8000;
/**
 * Real NASA/Natural-Earth-derived daytime map imagery (self-hosted, copied from three-globe's own
 * MIT-licensed example assets — the standard textures used across virtually every globe.gl demo)
 * — replaces the earlier abstract hex-dot outline, which didn't read as a real map and made
 * visitor positions hard to place against actual geography.
 */
const GLOBE_IMAGE_URL = "/globe/earth-day.jpg";
const GLOBE_BUMP_URL = "/globe/earth-topology.png";

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
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [globeSize, setGlobeSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

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
    function updateSize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setGlobeSize({ width: Math.max(320, rect.width), height: Math.max(320, rect.height) });
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  async function switchTenant(tenantId: string) {
    const response = await apiRequest<{ activeTenant: ActiveTenant }>("/tenants/switch", {
      method: "POST",
      body: JSON.stringify({ tenantId }),
    });
    setMe((current) => (current ? { ...current, activeTenant: response.activeTenant } : current));
    await loadLiveView(response.activeTenant);
  }

  const points = useMemo(() => (data?.points ?? []).map((point) => ({ ...point, size: 0.4 })), [data?.points]);

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

        <Card className="min-h-[520px] overflow-hidden !p-0">
          <div ref={containerRef} className="relative h-[520px] w-full">
            <Globe
              ref={globeRef}
              width={globeSize.width}
              height={globeSize.height}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl={GLOBE_IMAGE_URL}
              bumpImageUrl={GLOBE_BUMP_URL}
              showAtmosphere
              atmosphereColor="hsl(214, 84%, 70%)"
              atmosphereAltitude={0.2}
              pointsData={points}
              pointLat="lat"
              pointLng="lng"
              pointLabel="label"
              pointColor={() => "#22c55e"}
              pointAltitude={0.02}
              pointRadius="size"
              onGlobeReady={() => {
                const controls = globeRef.current?.controls();
                if (controls) {
                  controls.autoRotate = true;
                  controls.autoRotateSpeed = 0.6;
                }
              }}
            />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
