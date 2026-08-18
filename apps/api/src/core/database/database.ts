import { PrismaClient } from "@prisma/client";

export {
  ContentEntryStatus,
  ContentEntryVersionStatus,
  ContentFieldStatus,
  ContentFieldType,
  ContentTypeStatus,
  DomainStatus,
  DomainVerificationStatus,
  MediaStatus,
  MediaAccess,
  MembershipRole,
  MembershipStatus,
  PageStatus,
  PageVersionStatus,
  Prisma,
  PrismaClient,
  TenantStatus,
  ThemeChangeType,
  ThemeStatus,
  WebsiteStatus,
} from "@prisma/client";

export type DatabaseClient = PrismaClient;

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  if (!databaseUrl) {
    return new PrismaClient();
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

export async function checkDatabaseConnection(client: PrismaClient): Promise<boolean> {
  await client.$queryRaw`SELECT 1`;
  return true;
}
