import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import {
  DomainStatus,
  DomainVerificationStatus,
  PageStatus,
  Prisma,
  ThemeStatus,
  WebsiteStatus,
} from "../../core/database/database.js";
import { requiredHostname, requiredSlug, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";
import { defaultThemeTokens, parseThemeTokens } from "./theme-tokens.js";

interface CreateWebsiteInput {
  actorUserId: string;
  tenantId: string;
  name: unknown;
  slug: unknown;
}

interface ListInput {
  actorUserId: string;
  tenantId: string;
  limit?: unknown;
  cursor?: unknown;
}

interface SlugAvailabilityInput {
  actorUserId: string;
  tenantId: string;
  slug: unknown;
  excludeWebsiteId?: unknown;
}

interface UpdateWebsiteInput {
  actorUserId: string;
  tenantId: string;
  websiteId: string;
  name?: unknown;
  slug?: unknown;
  status?: unknown;
  faviconUrl?: unknown;
  headCode?: unknown;
  bodyCode?: unknown;
  footerCode?: unknown;
  searchEngineVisible?: unknown;
  robotsTxtEnabled?: unknown;
  robotsTxtContent?: unknown;
  sitemapEnabled?: unknown;
}

interface CreateDomainInput {
  actorUserId: string;
  tenantId: string;
  websiteId: string;
  hostname: unknown;
  isPrimary: unknown;
}

interface UpdateDomainInput {
  actorUserId: string;
  tenantId: string;
  domainId: string;
  hostname?: unknown;
}

interface UpdateThemeInput {
  actorUserId: string;
  tenantId: string;
  websiteId: string;
  name?: unknown;
  tokens: unknown;
}

interface DomainDnsResolver {
  resolve4(hostname: string): Promise<string[]>;
  resolveCname(hostname: string): Promise<string[]>;
  resolveTxt(hostname: string): Promise<string[][]>;
}

interface DomainDnsSettings {
  cnameTargetHostname?: string;
  aRecordIp?: string;
}

const nodeDnsResolver: DomainDnsResolver = {
  resolve4,
  resolveCname,
  resolveTxt,
};

@Injectable()
export class WebsitesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
    @Optional()
    private readonly dnsResolver: DomainDnsResolver = nodeDnsResolver,
    @Optional()
    private readonly dnsSettings: DomainDnsSettings = {},
  ) {}

  async createWebsite(input: CreateWebsiteInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);

    try {
      return await this.prisma.website.create({
        data: {
          tenantId: input.tenantId,
          name: requiredString(input.name, "name"),
          slug: requiredSlug(input.slug),
          status: WebsiteStatus.DRAFT,
          themes: {
            create: {
              name: "Default theme",
              tokens: defaultThemeTokens,
              isActive: true,
            },
          },
        },
        select: websiteSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Website slug already exists for this tenant");
    }
  }

  async listWebsites(input: ListInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const pagination = parsePagination(input.limit, input.cursor);

    const items = await this.prisma.website.findMany({
      where: {
        tenantId: input.tenantId,
        status: {
          not: WebsiteStatus.ARCHIVED,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: pagination.take,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
      select: websiteSelect,
    });

    return pageResult(items, pagination.limit);
  }

  async checkSlugAvailability(input: SlugAvailabilityInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);
    const slug = requiredSlug(input.slug);
    const excludeWebsiteId =
      input.excludeWebsiteId === undefined ? undefined : requiredString(input.excludeWebsiteId, "excludeWebsiteId");

    const existing = await this.prisma.website.findFirst({
      where: {
        tenantId: input.tenantId,
        slug,
        ...(excludeWebsiteId ? { id: { not: excludeWebsiteId } } : {}),
      },
      select: {
        id: true,
      },
    });

    return {
      slug,
      available: !existing,
    };
  }

  async getWebsite(actorUserId: string, tenantId: string, websiteId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    return this.prisma.website.findFirstOrThrow({
      where: {
        id: websiteId,
        tenantId,
      },
      select: websiteSelect,
    });
  }

  async getTheme(actorUserId: string, tenantId: string, websiteId: string) {
    await this.access.assertWebsiteAccess(actorUserId, tenantId, websiteId);
    return this.ensureActiveTheme(websiteId);
  }

  async resolvePublicSite(host: unknown, path: unknown) {
    const normalizedHostname = normalizeHostname(host);
    const requestedPath = normalizePublicPath(path);

    const domain = await this.prisma.domain.findFirst({
      where: {
        normalizedHostname,
        status: {
          not: DomainStatus.DISABLED,
        },
        website: {
          status: {
            not: WebsiteStatus.ARCHIVED,
          },
        },
      },
      select: {
        hostname: true,
        website: {
          select: publicWebsiteSelect(requestedPath),
        },
      },
    });

    if (!domain) {
      throw new NotFoundException("Public site was not found for this domain");
    }

    return buildPublicSiteResponse(domain.hostname, domain.website, requestedPath);
  }

  async resolvePublicSitePreview(websiteId: string, path: unknown) {
    const requestedPath = normalizePublicPath(path);
    const website = await this.prisma.website.findFirst({
      where: {
        id: websiteId,
        status: {
          not: WebsiteStatus.ARCHIVED,
        },
      },
      select: publicWebsiteSelect(requestedPath),
    });

    if (!website) {
      throw new NotFoundException("Preview site was not found");
    }

    return buildPublicSiteResponse("portal preview", website, requestedPath);
  }

  /**
   * Public, unauthenticated on purpose — a domain-to-website mapping is already visible to anyone
   * who visits the domain itself, so resolving it isn't a security boundary. This only tells the
   * "{customDomain}/admin" login page WHICH website to offer signing into; the actual access
   * control happens afterward, when the login flow tries to switch the authenticated session into
   * that domain's tenant (SessionService.setActiveTenant already rejects a non-member).
   */
  async resolveDomainOwner(host: unknown) {
    const normalizedHostname = normalizeHostname(host);

    const domain = await this.prisma.domain.findFirst({
      where: {
        normalizedHostname,
        status: { not: DomainStatus.DISABLED },
        website: { status: { not: WebsiteStatus.ARCHIVED } },
      },
      select: {
        website: { select: { id: true, name: true, tenantId: true } },
      },
    });

    if (!domain) {
      throw new NotFoundException("No website is linked to this domain");
    }

    return {
      tenantId: domain.website.tenantId,
      websiteId: domain.website.id,
      websiteName: domain.website.name,
    };
  }

  async updateTheme(input: UpdateThemeInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const tokens = parseThemeTokens(input.tokens);
    const name = input.name === undefined ? undefined : requiredString(input.name, "name");
    const current = await this.ensureActiveTheme(input.websiteId);

    return this.prisma.websiteTheme.update({
      where: {
        id: current.id,
      },
      data: {
        ...(name ? { name } : {}),
        tokens,
      },
      select: themeSelect,
    });
  }

  async resetTheme(actorUserId: string, tenantId: string, websiteId: string) {
    await this.access.assertWebsiteAccess(actorUserId, tenantId, websiteId);
    const current = await this.ensureActiveTheme(websiteId);

    return this.prisma.websiteTheme.update({
      where: {
        id: current.id,
      },
      data: {
        name: "Default theme",
        tokens: defaultThemeTokens,
      },
      select: themeSelect,
    });
  }

  async updateWebsite(input: UpdateWebsiteInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const data: Prisma.WebsiteUpdateInput = {};

    if (input.name !== undefined) {
      data.name = requiredString(input.name, "name");
    }

    if (input.slug !== undefined) {
      data.slug = requiredSlug(input.slug);
    }

    if (input.status !== undefined) {
      data.status = parseWebsiteStatus(input.status);
    }

    if (input.faviconUrl !== undefined) {
      data.faviconUrl = parsePlainText(input.faviconUrl, "faviconUrl", 2000);
    }

    if (input.headCode !== undefined) {
      data.headCode = parsePlainText(input.headCode, "headCode", MAX_CUSTOM_CODE_LENGTH);
    }

    if (input.bodyCode !== undefined) {
      data.bodyCode = parsePlainText(input.bodyCode, "bodyCode", MAX_CUSTOM_CODE_LENGTH);
    }

    if (input.footerCode !== undefined) {
      data.footerCode = parsePlainText(input.footerCode, "footerCode", MAX_CUSTOM_CODE_LENGTH);
    }

    if (input.searchEngineVisible !== undefined) {
      data.searchEngineVisible = parseBooleanField(input.searchEngineVisible, "searchEngineVisible");
    }

    if (input.robotsTxtEnabled !== undefined) {
      data.robotsTxtEnabled = parseBooleanField(input.robotsTxtEnabled, "robotsTxtEnabled");
    }

    if (input.robotsTxtContent !== undefined) {
      data.robotsTxtContent = parsePlainText(input.robotsTxtContent, "robotsTxtContent", MAX_CUSTOM_CODE_LENGTH);
    }

    if (input.sitemapEnabled !== undefined) {
      data.sitemapEnabled = parseBooleanField(input.sitemapEnabled, "sitemapEnabled");
    }

    if (!Object.keys(data).length) {
      throw new BadRequestException("At least one website field is required");
    }

    try {
      return await this.prisma.website.update({
        where: {
          id: input.websiteId,
          tenantId: input.tenantId,
        },
        data,
        select: websiteSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Website slug already exists for this tenant");
    }
  }

  async archiveWebsite(actorUserId: string, tenantId: string, websiteId: string) {
    await this.access.assertWebsiteAccess(actorUserId, tenantId, websiteId);

    return this.prisma.website.update({
      where: {
        id: websiteId,
        tenantId,
      },
      data: {
        status: WebsiteStatus.ARCHIVED,
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async createDomain(input: CreateDomainInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const normalizedHostname = normalizeHostname(input.hostname);
    const isPrimary = parseBoolean(input.isPrimary);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingActiveDomain = await tx.domain.findFirst({
          where: {
            tenantId: input.tenantId,
            websiteId: input.websiteId,
            status: {
              not: DomainStatus.DISABLED,
            },
          },
          select: {
            id: true,
          },
        });

        if (existingActiveDomain) {
          throw new ConflictException("Website already has a custom domain");
        }

        if (isPrimary) {
          await tx.domain.updateMany({
            where: {
              tenantId: input.tenantId,
              websiteId: input.websiteId,
              isPrimary: true,
            },
            data: {
              isPrimary: false,
            },
          });
        }

        return tx.domain.create({
          data: {
            tenantId: input.tenantId,
            websiteId: input.websiteId,
            hostname: normalizedHostname,
            normalizedHostname,
            status: DomainStatus.PENDING,
            isPrimary,
            verificationStatus: DomainVerificationStatus.PENDING,
            verificationToken: createVerificationToken(),
          },
          select: domainSelect,
        });
      });
    } catch (error) {
      throw mapUniqueError(error, "Domain hostname is already attached to another website");
    }
  }

  async listDomains(input: ListInput & { websiteId: string }) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);
    const pagination = parsePagination(input.limit, input.cursor);

    const items = await this.prisma.domain.findMany({
      where: {
        tenantId: input.tenantId,
        websiteId: input.websiteId,
        status: {
          not: DomainStatus.DISABLED,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: pagination.take,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
      select: domainSelect,
    });

    return pageResult(items, pagination.limit);
  }

  async getDomain(actorUserId: string, tenantId: string, domainId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    return this.prisma.domain.findFirstOrThrow({
      where: {
        id: domainId,
        tenantId,
      },
      select: domainSelect,
    });
  }

  async updateDomain(input: UpdateDomainInput) {
    await this.access.assertDomainAccess(input.actorUserId, input.tenantId, input.domainId);

    if (input.hostname === undefined) {
      throw new BadRequestException("At least one domain field is required");
    }

    const normalizedHostname = normalizeHostname(input.hostname);

    try {
      return await this.prisma.domain.update({
        where: {
          id: input.domainId,
          tenantId: input.tenantId,
        },
        data: {
          hostname: normalizedHostname,
          normalizedHostname,
          status: DomainStatus.PENDING,
          verificationStatus: DomainVerificationStatus.PENDING,
          verificationToken: createVerificationToken(),
          verifiedAt: null,
        },
        select: domainSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Domain hostname is already attached to another website");
    }
  }

  async setPrimaryDomain(actorUserId: string, tenantId: string, domainId: string) {
    await this.access.assertDomainAccess(actorUserId, tenantId, domainId);

    return this.prisma.$transaction(async (tx) => {
      const domain = await tx.domain.findFirst({
        where: {
          id: domainId,
          tenantId,
          status: {
            not: DomainStatus.DISABLED,
          },
        },
        select: {
          id: true,
          websiteId: true,
        },
      });

      if (!domain) {
        throw new NotFoundException("Domain was not found in this tenant");
      }

      await tx.domain.updateMany({
        where: {
          tenantId,
          websiteId: domain.websiteId,
          isPrimary: true,
          id: {
            not: domain.id,
          },
        },
        data: {
          isPrimary: false,
        },
      });

      return tx.domain.update({
        where: {
          id: domain.id,
          tenantId,
        },
        data: {
          isPrimary: true,
        },
        select: domainSelect,
      });
    });
  }

  async markDomainVerified(actorUserId: string, tenantId: string, domainId: string) {
    await this.access.assertDomainAccess(actorUserId, tenantId, domainId);

    const domain = await this.prisma.domain.findFirstOrThrow({
      where: {
        id: domainId,
        tenantId,
        status: {
          not: DomainStatus.DISABLED,
        },
      },
      select: {
        id: true,
        tenantId: true,
        hostname: true,
        verificationToken: true,
        website: {
          select: {
            slug: true,
          },
        },
      },
    });
    const dnsCheck = await this.checkDomainDns(domain);

    return this.prisma.domain.update({
      where: {
        id: domainId,
        tenantId,
      },
      data: {
        status: dnsCheck.connected ? DomainStatus.VERIFIED : DomainStatus.PENDING,
        verificationStatus: dnsCheck.connected ? DomainVerificationStatus.VERIFIED : DomainVerificationStatus.FAILED,
        verifiedAt: dnsCheck.connected ? new Date() : null,
      },
      select: domainSelect,
    });
  }

  async disableDomain(actorUserId: string, tenantId: string, domainId: string) {
    await this.access.assertDomainAccess(actorUserId, tenantId, domainId);

    return this.prisma.domain.update({
      where: {
        id: domainId,
        tenantId,
      },
      data: {
        status: DomainStatus.DISABLED,
        isPrimary: false,
      },
      select: domainSelect,
    });
  }

  private async ensureActiveTheme(websiteId: string) {
    const existing = await this.prisma.websiteTheme.findFirst({
      where: {
        websiteId,
        isActive: true,
      },
      select: themeSelect,
    });

    if (existing) {
      return existing;
    }

    return this.prisma.websiteTheme.create({
      data: {
        websiteId,
        name: "Default theme",
        tokens: defaultThemeTokens,
        isActive: true,
      },
      select: themeSelect,
    });
  }

  private async checkDomainDns(domain: {
    hostname: string;
    verificationToken: string;
    website: { slug: string };
  }) {
    const verificationName = `_stackbuilder.${domain.hostname}`;
    const expectedCname = normalizeDnsHostname(
      this.dnsSettings.cnameTargetHostname ?? process.env.CUSTOM_DOMAIN_CNAME_TARGET ?? `${domain.website.slug}.stackbuilder.site`,
    );
    const expectedARecordIp = this.dnsSettings.aRecordIp ?? process.env.CUSTOM_DOMAIN_A_RECORD_IP;

    const [, cnameRecords, aRecords] = await Promise.all([
      resolveDns(() => this.dnsResolver.resolveTxt(verificationName)),
      resolveDns(() => this.dnsResolver.resolveCname(domain.hostname)),
      expectedARecordIp ? resolveDns(() => this.dnsResolver.resolve4(domain.hostname)) : Promise.resolve([]),
    ]);
    const hasCnameTarget = cnameRecords.map(normalizeDnsHostname).includes(expectedCname);
    const hasARecordTarget = expectedARecordIp ? aRecords.includes(expectedARecordIp) : false;

    return {
      connected: hasCnameTarget || hasARecordTarget,
    };
  }
}

export const websiteSelect = {
  id: true,
  tenantId: true,
  homePageId: true,
  name: true,
  slug: true,
  status: true,
  faviconUrl: true,
  headCode: true,
  bodyCode: true,
  footerCode: true,
  searchEngineVisible: true,
  robotsTxtEnabled: true,
  robotsTxtContent: true,
  sitemapEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WebsiteSelect;

/** 20,000 chars — plenty for a tracking snippet or two, not enough to become a real storage concern. Same cap as Form.customCss. */
const MAX_CUSTOM_CODE_LENGTH = 20_000;

function parsePlainText(value: unknown, field: string, maxLength: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new BadRequestException(`${field} must be a string`);
  if (value.length > maxLength) throw new BadRequestException(`${field} is too long`);
  return value;
}

function parseBooleanField(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new BadRequestException(`${field} must be a boolean`);
  return value;
}

export const domainSelect = {
  id: true,
  tenantId: true,
  websiteId: true,
  hostname: true,
  normalizedHostname: true,
  status: true,
  isPrimary: true,
  verificationStatus: true,
  verificationToken: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DomainSelect;

export const themeSelect = {
  id: true,
  websiteId: true,
  name: true,
  tokens: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WebsiteThemeSelect;

const publicPageSelect = {
  id: true,
  title: true,
  slug: true,
  seo: true,
  templateId: true,
  publishedVersion: {
    select: {
      content: true,
    },
  },
} satisfies Prisma.PageSelect;

function publicWebsiteSelect(requestedPath: string) {
  return {
    id: true,
    name: true,
    slug: true,
    status: true,
    homePage: {
      select: publicPageSelect,
    },
    pages: {
      where: {
        status: PageStatus.PUBLISHED,
        slug: requestedPath,
      },
      take: 1,
      select: publicPageSelect,
    },
    themes: {
      where: {
        isActive: true,
      },
      take: 1,
      select: {
        name: true,
        tokens: true,
      },
    },
    // The theme-engine payload a public renderer needs to actually draw a
    // page: the published installation's active version carries the full
    // uploaded source, the merchant's customizer settings, and the parsed
    // manifest together in one immutable row (see ThemeInstallationsService.publish).
    themeInstallations: {
      where: {
        status: ThemeStatus.PUBLISHED,
      },
      take: 1,
      select: {
        activeVersion: {
          select: {
            files: true,
            settings: true,
            manifest: true,
          },
        },
      },
    },
  } satisfies Prisma.WebsiteSelect;
}

function buildPublicSiteResponse(
  hostname: string,
  website: Prisma.WebsiteGetPayload<{ select: ReturnType<typeof publicWebsiteSelect> }>,
  requestedPath: string,
) {
  const requestedPage = website.pages[0] ?? null;
  const page = requestedPage ?? (requestedPath === "home" ? website.homePage : null);
  const publishedVersion = page?.publishedVersion ?? null;
  const activeVersion = website.themeInstallations[0]?.activeVersion ?? null;

  return {
    hostname,
    website: {
      id: website.id,
      name: website.name,
      slug: website.slug,
      status: website.status,
    },
    page: page
      ? {
          id: page.id,
          title: page.title,
          slug: page.slug,
          seo: page.seo,
          templateId: page.templateId,
          content: publishedVersion?.content ?? null,
        }
      : null,
    theme: website.themes[0] ?? null,
    themeEngine: activeVersion
      ? {
          files: activeVersion.files,
          settings: activeVersion.settings,
          manifest: activeVersion.manifest,
        }
      : null,
  };
}

export function normalizeHostname(value: unknown): string {
  const rawHostname = requiredString(value, "hostname").toLowerCase();
  const withoutProtocol = rawHostname.replace(/^https?:\/\//, "");
  const hostname = withoutProtocol.split(/[/?#]/)[0]?.trim().replace(/\.$/, "") ?? "";

  return requiredHostname(hostname);
}

function parseWebsiteStatus(value: unknown): WebsiteStatus {
  const status = requiredString(value, "status").toUpperCase();

  if (!Object.values(WebsiteStatus).includes(status as WebsiteStatus)) {
    throw new BadRequestException("status must be draft, published, or archived");
  }

  return status as WebsiteStatus;
}

function parseBoolean(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new BadRequestException("isPrimary must be a boolean");
  }

  return value;
}

function normalizePublicPath(value: unknown): string {
  const rawPath = typeof value === "string" ? value : "/";
  const cleanPath = rawPath.split(/[?#]/)[0]?.trim().replace(/^\/+|\/+$/g, "") ?? "";

  return cleanPath || "home";
}

function parsePagination(
  limit: unknown,
  cursor: unknown,
): { limit: number; take: number; cursor?: string } {
  const parsedLimit =
    limit === undefined
      ? 20
      : Number.parseInt(typeof limit === "string" ? limit : String(limit), 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
    throw new BadRequestException("limit must be between 1 and 50");
  }

  const parsedCursor = cursor === undefined ? undefined : requiredString(cursor, "cursor");

  const result: { limit: number; take: number; cursor?: string } = {
    limit: parsedLimit,
    take: parsedLimit + 1,
  };

  if (parsedCursor !== undefined) {
    result.cursor = parsedCursor;
  }

  return result;
}

function pageResult<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  return {
    data,
    nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
  };
}

function createVerificationToken(): string {
  return randomBytes(24).toString("hex");
}

async function resolveDns<T>(lookup: () => Promise<T[]>): Promise<T[]> {
  try {
    return await lookup();
  } catch {
    return [];
  }
}

function normalizeDnsHostname(value: string): string {
  return value.toLowerCase().replace(/\.$/, "");
}

function mapUniqueError(error: unknown, message: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(message);
  }

  return error instanceof Error ? error : new Error("Unexpected database error");
}
