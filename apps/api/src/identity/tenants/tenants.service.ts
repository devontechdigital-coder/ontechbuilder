import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { MembershipRole, MembershipStatus, Prisma, TenantStatus } from "../../core/database/database.js";
import { requiredSlug, requiredString } from "../../core/common/input.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { TenantAccessService } from "./tenant-access.service.js";

interface CreateTenantInput {
  actorUserId: string;
  name: unknown;
  slug: unknown;
}

interface CreateMembershipInput {
  actorUserId: string;
  tenantId: string;
  userId: unknown;
  role: unknown;
}

@Injectable()
export class TenantsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantAccessService) private readonly access: TenantAccessService,
  ) {}

  async createTenant(input: CreateTenantInput) {
    const name = requiredString(input.name, "name");
    const slug = requiredSlug(input.slug);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name,
          },
          select: {
            id: true,
          },
        });

        const tenant = await tx.tenant.create({
          data: {
            organizationId: organization.id,
            name,
            slug,
            status: TenantStatus.ACTIVE,
          },
          select: tenantSelect,
        });

        await tx.tenantMember.create({
          data: {
            tenantId: tenant.id,
            userId: input.actorUserId,
            role: MembershipRole.OWNER,
            status: MembershipStatus.ACTIVE,
          },
        });

        return tenant;
      });
    } catch (error) {
      throw mapUniqueError(error, "Tenant slug already exists for this organization");
    }
  }

  async listTenants(actorUserId: string) {
    return this.prisma.tenant.findMany({
      where: {
        members: {
          some: {
            userId: actorUserId,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: tenantSelect,
    });
  }

  async getTenant(actorUserId: string, tenantId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    return this.prisma.tenant.findFirstOrThrow({
      where: {
        id: tenantId,
      },
      select: tenantSelect,
    });
  }

  async createMembership(input: CreateMembershipInput) {
    await this.access.assertTenantMember(input.actorUserId, input.tenantId);

    const userId = requiredString(input.userId, "userId");
    const role = parseMembershipRole(input.role);

    try {
      return await this.prisma.tenantMember.create({
        data: {
          tenantId: input.tenantId,
          userId,
          role,
          status: MembershipStatus.ACTIVE,
        },
        select: membershipSelect,
      });
    } catch (error) {
      throw mapUniqueError(error, "Membership already exists for this user and tenant");
    }
  }

  async listMemberships(actorUserId: string, tenantId: string) {
    await this.access.assertTenantMember(actorUserId, tenantId);

    return this.prisma.tenantMember.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 100,
      select: membershipSelect,
    });
  }
}

const tenantSelect = {
  id: true,
  organizationId: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantSelect;

const membershipSelect = {
  id: true,
  tenantId: true,
  userId: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantMemberSelect;

function parseMembershipRole(value: unknown): MembershipRole {
  if (typeof value !== "string") {
    return MembershipRole.VIEWER;
  }

  const normalized = value.trim().toUpperCase();
  if (isMembershipRole(normalized)) {
    return normalized;
  }

  return MembershipRole.VIEWER;
}

function isMembershipRole(value: string): value is MembershipRole {
  return Object.values(MembershipRole).includes(value as MembershipRole);
}

function mapUniqueError(error: unknown, message: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictException(message);
  }

  return error instanceof Error ? error : new Error("Unexpected database error");
}
