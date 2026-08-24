import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../core/database/database.js";
import { optionalString, requiredString } from "../core/common/input.js";
import { PrismaService } from "../core/database/prisma.service.js";
import { TenantAccessService } from "../identity/tenants/tenant-access.service.js";

interface TrackInput {
  websiteId: unknown;
  pageId?: unknown;
  path: unknown;
  referrer?: unknown;
  sessionId: unknown;
  userAgent: string | undefined;
  ip: string | undefined;
}

const LIVE_WINDOW_MINUTES = 5;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  /**
   * Public entry point — no auth, fired once per page view by a tiny client-side beacon the
   * public renderer's ThemeClientMount kicks off (see apps/renderer). The row is written
   * immediately with whatever's known synchronously (path, device, session); geo fields are
   * filled in afterward by a fire-and-forget lookup so a slow/unreachable geo API never adds
   * latency to a real visitor's page load.
   */
  async track(input: TrackInput) {
    const websiteId = requiredString(input.websiteId, "websiteId");
    const path = requiredString(input.path, "path");
    const sessionId = requiredString(input.sessionId, "sessionId");
    if (!uuidPattern.test(sessionId)) {
      throw new BadRequestException("sessionId must be a UUID");
    }

    const website = await this.prisma.website.findFirst({ where: { id: websiteId }, select: { id: true, tenantId: true } });
    if (!website) return { tracked: false };

    const pageId = optionalString(input.pageId, "pageId");
    const referrer = optionalString(input.referrer, "referrer");
    const deviceType = parseDeviceType(input.userAgent ?? "");

    const created = await this.prisma.pageView.create({
      data: {
        tenantId: website.tenantId,
        websiteId: website.id,
        ...(pageId ? { pageId } : {}),
        sessionId,
        path,
        ...(referrer ? { referrer } : {}),
        ...(deviceType ? { deviceType } : {}),
      },
      select: { id: true },
    });

    void this.resolveGeo(created.id, input.ip);
    return { tracked: true };
  }

  private async resolveGeo(pageViewId: string, ip: string | undefined) {
    const geo = await lookupIpGeo(ip);
    if (!geo) return;
    try {
      await this.prisma.pageView.update({ where: { id: pageViewId }, data: geo });
    } catch {
      // The view may have aged out of relevance by the time this resolves — never worth surfacing.
    }
  }

  async getLiveView(actorUserId: string, tenantId: string, websiteId: string) {
    await this.access.assertWebsiteAccess(actorUserId, tenantId, websiteId);

    const now = new Date();
    const liveSince = new Date(now.getTime() - LIVE_WINDOW_MINUTES * 60 * 1000);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const scope: Prisma.PageViewWhereInput = { tenantId, websiteId };

    const [liveSessions, todaySessions, recent, locationRows] = await Promise.all([
      this.prisma.pageView.findMany({ where: { ...scope, createdAt: { gte: liveSince } }, select: { sessionId: true }, distinct: ["sessionId"] }),
      this.prisma.pageView.findMany({ where: { ...scope, createdAt: { gte: startOfToday } }, select: { sessionId: true }, distinct: ["sessionId"] }),
      this.prisma.pageView.findMany({
        where: { ...scope, createdAt: { gte: liveSince }, latitude: { not: null }, longitude: { not: null } },
        select: { sessionId: true, latitude: true, longitude: true, city: true, region: true, country: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.prisma.pageView.groupBy({
        by: ["country", "region", "city"],
        where: { ...scope, createdAt: { gte: startOfToday } },
        _count: { _all: true },
      }),
    ]);

    const dedupedRecent = new Map<string, (typeof recent)[number]>();
    for (const row of recent) {
      if (!dedupedRecent.has(row.sessionId)) dedupedRecent.set(row.sessionId, row);
    }

    const sessionsByLocation = locationRows
      .filter((row) => row.country)
      .map((row) => ({
        label: [row.city, row.region, row.country].filter(Boolean).join(", "),
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      visitorsRightNow: liveSessions.length,
      sessionsToday: todaySessions.length,
      points: [...dedupedRecent.values()].map((row) => ({
        lat: row.latitude,
        lng: row.longitude,
        label: [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unknown location",
      })),
      sessionsByLocation,
    };
  }

  async getAnalytics(actorUserId: string, tenantId: string, websiteId: string, rangeDays: number) {
    await this.access.assertWebsiteAccess(actorUserId, tenantId, websiteId);

    const days = Math.min(Math.max(rangeDays, 1), 90);
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    const scope: Prisma.PageViewWhereInput = { tenantId, websiteId };

    const [currentRows, previousSessionRows, deviceRows, pageRows] = await Promise.all([
      this.prisma.pageView.findMany({
        where: { ...scope, createdAt: { gte: start } },
        select: { sessionId: true, path: true, deviceType: true, referrer: true, country: true, region: true, city: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.pageView.findMany({
        where: { ...scope, createdAt: { gte: previousStart, lt: start } },
        select: { sessionId: true },
        distinct: ["sessionId"],
      }),
      this.prisma.pageView.groupBy({ by: ["deviceType"], where: { ...scope, createdAt: { gte: start } }, _count: { _all: true } }),
      this.prisma.pageView.groupBy({ by: ["path"], where: { ...scope, createdAt: { gte: start } }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 10 }),
    ]);

    const totalPageViews = currentRows.length;
    const currentSessions = new Set(currentRows.map((row) => row.sessionId));
    const totalSessions = currentSessions.size;
    const previousSessions = previousSessionRows.length;
    const sessionsChangePct = percentChange(previousSessions, totalSessions);

    const bucketMs = days <= 2 ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const seriesMap = new Map<number, { pageViews: number; sessions: Set<string> }>();
    for (const row of currentRows) {
      const bucket = Math.floor(row.createdAt.getTime() / bucketMs) * bucketMs;
      const entry = seriesMap.get(bucket) ?? { pageViews: 0, sessions: new Set<string>() };
      entry.pageViews += 1;
      entry.sessions.add(row.sessionId);
      seriesMap.set(bucket, entry);
    }
    const series = [...seriesMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([bucket, entry]) => ({ timestamp: new Date(bucket).toISOString(), pageViews: entry.pageViews, sessions: entry.sessions.size }));

    const sessionsByDevice = deviceRows
      .filter((row) => row.deviceType)
      .map((row) => ({ deviceType: row.deviceType as string, count: row._count._all }));

    const topPages = pageRows.map((row) => ({ path: row.path, count: row._count._all }));

    const locationCounts = new Map<string, number>();
    for (const row of currentRows) {
      if (!row.country) continue;
      const label = [row.region, row.country].filter(Boolean).join(", ");
      locationCounts.set(label, (locationCounts.get(label) ?? 0) + 1);
    }
    const sessionsByLocation = [...locationCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const sourceCounts = new Map<string, number>();
    for (const row of currentRows) {
      const source = referrerToSource(row.referrer);
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    const trafficSources = [...sourceCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalPageViews,
      totalSessions,
      sessionsChangePct,
      series,
      sessionsByDevice,
      topPages,
      sessionsByLocation,
      trafficSources,
    };
  }
}

function parseDeviceType(userAgent: string): string | undefined {
  if (!userAgent) return undefined;
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android/.test(ua)) return "mobile";
  return "desktop";
}

function percentChange(previous: number, current: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function referrerToSource(referrer: string | null): string {
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (/google\./.test(host)) return "Google";
    if (/bing\./.test(host)) return "Bing";
    if (/facebook\.|instagram\./.test(host)) return "Social";
    if (/t\.co|twitter\.|x\.com/.test(host)) return "Social";
    if (/linkedin\./.test(host)) return "Social";
    return host;
  } catch {
    return "Direct";
  }
}

const privateIpPattern = /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::ffff:127\.)/;

/** Free, no-key IP geolocation — best-effort only; a failed/unreachable/private-IP lookup just leaves geo fields null. */
async function lookupIpGeo(ip: string | undefined): Promise<{ country: string; region: string; city: string; latitude: number; longitude: number } | null> {
  if (!ip || privateIpPattern.test(ip)) return null;
  try {
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon`);
    if (!response.ok) return null;
    const data = (await response.json()) as { status: string; country?: string; regionName?: string; city?: string; lat?: number; lon?: number };
    if (data.status !== "success" || typeof data.lat !== "number" || typeof data.lon !== "number") return null;
    return { country: data.country ?? "", region: data.regionName ?? "", city: data.city ?? "", latitude: data.lat, longitude: data.lon };
  } catch {
    return null;
  }
}
