import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipStatus } from "../../core/database/database.js";
import { PrismaService } from "../../core/database/prisma.service.js";

@Injectable()
export class TenantAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertTenantMember(userId: string, tenantId: string): Promise<void> {
    const membership = await this.prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      select: {
        status: true,
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException("User does not have access to this tenant");
    }
  }

  async assertWebsiteAccess(userId: string, tenantId: string, websiteId: string): Promise<void> {
    await this.assertTenantMember(userId, tenantId);

    const website = await this.prisma.website.findFirst({
      where: {
        id: websiteId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!website) {
      throw new NotFoundException("Website was not found in this tenant");
    }
  }

  async assertDomainAccess(userId: string, tenantId: string, domainId: string): Promise<void> {
    await this.assertTenantMember(userId, tenantId);

    const domain = await this.prisma.domain.findFirst({
      where: {
        id: domainId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!domain) {
      throw new NotFoundException("Domain was not found in this tenant");
    }
  }

  async assertMediaAccess(userId: string, tenantId: string, mediaId: string): Promise<void> {
    await this.assertTenantMember(userId, tenantId);

    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!media) {
      throw new NotFoundException("Media item was not found in this tenant");
    }
  }
}
