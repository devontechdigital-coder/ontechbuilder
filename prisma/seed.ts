import {
  DomainStatus,
  DomainVerificationStatus,
  MediaStatus,
  MembershipRole,
  MembershipStatus,
  PrismaClient,
  TenantStatus,
  WebsiteStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development seed must not run in production");
  }

  const organization = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Development Organization",
    },
    update: {
      name: "Development Organization",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "dev@example.com" },
    create: {
      email: "dev@example.com",
      displayName: "Development User",
    },
    update: {
      displayName: "Development User",
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "development",
      },
    },
    create: {
      organizationId: organization.id,
      name: "Development Tenant",
      slug: "development",
      status: TenantStatus.ACTIVE,
    },
    update: {
      name: "Development Tenant",
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.tenantMember.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: MembershipRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  const marketingWebsite = await prisma.website.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: "marketing",
      },
    },
    create: {
      tenantId: tenant.id,
      name: "Marketing Site",
      slug: "marketing",
      status: WebsiteStatus.DRAFT,
    },
    update: {
      name: "Marketing Site",
      status: WebsiteStatus.DRAFT,
    },
  });

  await prisma.website.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: "docs",
      },
    },
    create: {
      tenantId: tenant.id,
      name: "Docs Site",
      slug: "docs",
      status: WebsiteStatus.DRAFT,
    },
    update: {
      name: "Docs Site",
      status: WebsiteStatus.DRAFT,
    },
  });

  await prisma.domain.upsert({
    where: { normalizedHostname: "dev.stackbuilder.test" },
    create: {
      tenantId: tenant.id,
      websiteId: marketingWebsite.id,
      hostname: "dev.stackbuilder.test",
      normalizedHostname: "dev.stackbuilder.test",
      status: DomainStatus.PENDING,
      isPrimary: true,
      verificationStatus: DomainVerificationStatus.PENDING,
      verificationToken: "dev-domain-verification-token",
    },
    update: {
      tenantId: tenant.id,
      websiteId: marketingWebsite.id,
      hostname: "dev.stackbuilder.test",
      normalizedHostname: "dev.stackbuilder.test",
      status: DomainStatus.PENDING,
      isPrimary: true,
      verificationStatus: DomainVerificationStatus.PENDING,
      verificationToken: "dev-domain-verification-token",
    },
  });

  await prisma.media.upsert({
    where: {
      tenantId_storageKey: {
        tenantId: tenant.id,
        storageKey: `tenants/${tenant.id}/media/00000000-0000-0000-0000-000000000001/original`,
      },
    },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      tenantId: tenant.id,
      websiteId: marketingWebsite.id,
      originalFilename: "sample-hero.png",
      mimeType: "image/png",
      sizeBytes: 12345,
      storageKey: `tenants/${tenant.id}/media/00000000-0000-0000-0000-000000000001/original`,
      width: 1200,
      height: 630,
      status: MediaStatus.READY,
    },
    update: {
      websiteId: marketingWebsite.id,
      originalFilename: "sample-hero.png",
      mimeType: "image/png",
      sizeBytes: 12345,
      width: 1200,
      height: 630,
      status: MediaStatus.READY,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
