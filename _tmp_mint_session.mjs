import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";

const p = new PrismaClient();
const userId = "3ee203f2-7ad3-42bb-96a5-03144da006fd";
const tenantId = "0fdcee0f-bd35-4d43-99ae-6414ccfe9b90";
const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
const session = await p.session.create({
  data: { userId, tokenHash, activeTenantId: tenantId, expiresAt },
});
console.log(JSON.stringify({ token, sessionId: session.id }));
await p.$disconnect();
