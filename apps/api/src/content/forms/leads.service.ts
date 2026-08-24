import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus, Prisma } from "../../core/database/database.js";
import { optionalString, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "../../identity/tenants/tenant-access.service.js";

interface ActorInput {
  actorUserId: string;
  tenantId: string;
}

interface ListLeadsInput extends ActorInput {
  websiteId: string;
  formId?: unknown;
  status?: unknown;
  query?: unknown;
  page?: unknown;
}

const leadPageSize = 20;
const LEAD_STATUSES = Object.values(LeadStatus);

export const leadSelect = {
  id: true,
  tenantId: true,
  formId: true,
  data: true,
  status: true,
  mailSent: true,
  mailError: true,
  createdAt: true,
  updatedAt: true,
  form: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.FormSubmissionSelect;

@Injectable()
export class LeadsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async listLeads(input: ListLeadsInput) {
    await this.access.assertWebsiteAccess(input.actorUserId, input.tenantId, input.websiteId);

    const formId = optionalString(input.formId, "formId");
    const status = parseOptionalLeadStatus(input.status);
    const query = optionalString(input.query, "q")?.trim();
    const page = parsePage(input.page);

    const baseWhere: Prisma.FormSubmissionWhereInput = {
      tenantId: input.tenantId,
      form: { websiteId: input.websiteId },
      ...(formId ? { formId } : {}),
      ...(status ? { status } : {}),
    };

    let matchingIds: string[] | null = null;
    if (query) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "FormSubmission"."id" FROM "FormSubmission"
        INNER JOIN "Form" ON "Form"."id" = "FormSubmission"."formId"
        WHERE "FormSubmission"."tenantId" = ${input.tenantId}::uuid
          AND "Form"."websiteId" = ${input.websiteId}::uuid
          AND "FormSubmission"."data"::text ILIKE ${`%${query}%`}
      `);
      matchingIds = rows.map((row) => row.id);
    }

    const where: Prisma.FormSubmissionWhereInput = matchingIds ? { ...baseWhere, id: { in: matchingIds } } : baseWhere;

    const [data, total, stats, forms] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * leadPageSize,
        take: leadPageSize,
        select: leadSelect,
      }),
      this.prisma.formSubmission.count({ where }),
      this.getStats(input.tenantId, input.websiteId),
      this.listFormOptions(input.tenantId, input.websiteId),
    ]);

    return { data, total, page, pageSize: leadPageSize, stats, forms };
  }

  async getLead(actorUserId: string, tenantId: string, leadId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const lead = await this.prisma.formSubmission.findFirst({
      where: { id: leadId, tenantId },
      select: leadSelect,
    });

    if (!lead) {
      throw new NotFoundException("Lead was not found in this tenant");
    }

    return lead;
  }

  async updateLeadStatus(actorUserId: string, tenantId: string, leadId: string, statusInput: unknown) {
    await this.access.assertTenantMember(actorUserId, tenantId);
    const status = parseRequiredLeadStatus(statusInput);

    const lead = await this.prisma.formSubmission.findFirst({ where: { id: leadId, tenantId }, select: { id: true } });
    if (!lead) {
      throw new NotFoundException("Lead was not found in this tenant");
    }

    return this.prisma.formSubmission.update({
      where: { id: lead.id },
      data: { status },
      select: leadSelect,
    });
  }

  async deleteLead(actorUserId: string, tenantId: string, leadId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    const lead = await this.prisma.formSubmission.findFirst({ where: { id: leadId, tenantId }, select: { id: true } });
    if (!lead) {
      throw new NotFoundException("Lead was not found in this tenant");
    }

    await this.prisma.formSubmission.delete({ where: { id: lead.id } });
    return { id: lead.id, deleted: true };
  }

  private async listFormOptions(tenantId: string, websiteId: string) {
    return this.prisma.form.findMany({
      where: { tenantId, websiteId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  /**
   * Every delta is derived from real timestamps (createdAt for volume, updatedAt as a proxy for
   * status-change activity) over a trailing 7-day window vs the 7 days before that — no invented
   * numbers. A tenant with no history yet will honestly show 0% until real data accumulates.
   */
  private async getStats(tenantId: string, websiteId: string) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const scope: Prisma.FormSubmissionWhereInput = { tenantId, form: { websiteId } };
    const inProgressStatuses = [LeadStatus.OPEN, LeadStatus.QUALIFIED, LeadStatus.FOLLOW_UP];

    const [
      total,
      newToday,
      newYesterday,
      inProgress,
      meetingsBooked,
      totalThisWeek,
      totalLastWeek,
      inProgressThisWeek,
      inProgressLastWeek,
      meetingsThisWeek,
      meetingsLastWeek,
    ] = await Promise.all([
      this.prisma.formSubmission.count({ where: scope }),
      this.prisma.formSubmission.count({ where: { ...scope, createdAt: { gte: startOfToday } } }),
      this.prisma.formSubmission.count({ where: { ...scope, createdAt: { gte: startOfYesterday, lt: startOfToday } } }),
      this.prisma.formSubmission.count({ where: { ...scope, status: { in: inProgressStatuses } } }),
      this.prisma.formSubmission.count({ where: { ...scope, status: LeadStatus.MEETING_BOOKED } }),
      this.prisma.formSubmission.count({ where: { ...scope, createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.formSubmission.count({ where: { ...scope, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      this.prisma.formSubmission.count({ where: { ...scope, status: { in: inProgressStatuses }, updatedAt: { gte: sevenDaysAgo } } }),
      this.prisma.formSubmission.count({ where: { ...scope, status: { in: inProgressStatuses }, updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      this.prisma.formSubmission.count({ where: { ...scope, status: LeadStatus.MEETING_BOOKED, updatedAt: { gte: sevenDaysAgo } } }),
      this.prisma.formSubmission.count({ where: { ...scope, status: LeadStatus.MEETING_BOOKED, updatedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
    ]);

    return {
      total,
      totalChangePct: percentChange(totalLastWeek, totalThisWeek),
      newToday,
      newTodayChangePct: percentChange(newYesterday, newToday),
      inProgress,
      inProgressChangePct: percentChange(inProgressLastWeek, inProgressThisWeek),
      meetingsBooked,
      meetingsBookedChangePct: percentChange(meetingsLastWeek, meetingsThisWeek),
    };
  }
}

function percentChange(previous: number, current: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function parsePage(value: unknown): number {
  if (value === undefined || value === null || value === "") return 1;
  const page = Number(value);
  if (!Number.isInteger(page) || page < 1) {
    throw new BadRequestException("page must be a positive integer");
  }
  return page;
}

function parseOptionalLeadStatus(value: unknown): LeadStatus | undefined {
  if (value === undefined || value === null || value === "" || value === "all") return undefined;
  return parseRequiredLeadStatus(value);
}

function parseRequiredLeadStatus(value: unknown): LeadStatus {
  const status = requiredString(value, "status").toUpperCase();
  if (!(LEAD_STATUSES as string[]).includes(status)) {
    throw new BadRequestException(`status must be one of ${LEAD_STATUSES.join(", ")}`);
  }
  return status as LeadStatus;
}

