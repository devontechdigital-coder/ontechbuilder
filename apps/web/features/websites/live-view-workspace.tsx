"use client";

import { Radio, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
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
/** Well-known, stable public dataset (Natural Earth 110m via world-atlas) — the standard source for exactly this kind of country-outline globe. */
const WORLD_ATLAS_URL = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

/** Minimal shape this component actually reads — the full TopoJSON spec isn't worth a dependency. */
interface WorldAtlasTopology {
  objects: { countries: object };
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

export function LiveViewWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [hasLoadedDashboardShell, setHasLoadedDashboardShell] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [website, setWebsite] = useState<WebsiteSummary | null>(null);
  const [data, setData] = useState<LiveViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<object[]>([]);
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

  // World country outlines, fetched once client-side and converted from topojson — a static
  // reference dataset (Natural Earth 110m), not tenant data, so it's fine to fetch directly
  // rather than proxy through the API. If the CDN is unreachable, the globe still renders with
  // visitor points on a plain sphere — outlines are decorative, not load-bearing.
  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_ATLAS_URL)
      .then((response) => response.json())
      .then((topology: WorldAtlasTopology) => {
        if (cancelled) return;
        const geojson = feature(topology as never, topology.objects.countries as never) as { features?: object[] };
        setCountries(geojson.features ?? []);
      })
      .catch(() => {
        // Decorative only — see comment above.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (!hasLoadedDashboardShell && (!me || !website)) {
    return <LoadingState label="Loading live view" />;
  }
  if (!me || !website) {
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
              showAtmosphere
              atmosphereColor="hsl(214, 84%, 70%)"
              atmosphereAltitude={0.18}
              hexPolygonsData={countries}
              hexPolygonResolution={3}
              hexPolygonMargin={0.3}
              hexPolygonUseDots
              hexPolygonColor={() => "rgba(20, 109, 225, 0.55)"}
              pointsData={points}
              pointLat="lat"
              pointLng="lng"
              pointLabel="label"
              pointColor={() => "hsl(151, 64%, 45%)"}
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
