import { checkDatabaseConnection, createPrismaClient } from "../src/core/database/database.js";
import { describe, expect, it } from "vitest";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://stackbuilder:stackbuilder@localhost:5432/stackbuilder?schema=public";

describe("database foundation", () => {
  it("Prisma can connect to PostgreSQL", async () => {
    const prisma = createPrismaClient(databaseUrl);

    try {
      await expect(checkDatabaseConnection(prisma)).resolves.toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  });
});
