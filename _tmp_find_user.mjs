import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const website = await p.website.findUnique({ where: { id: "bf32ed83-8ca5-445b-aa2f-eaad73d1b6cb" }, select: { tenantId: true, name: true } });
console.log("website:", website);
const members = await p.tenantMember.findMany({ where: { tenantId: website.tenantId }, include: { user: { select: { id: true, email: true } } } });
console.log("members:", JSON.stringify(members.map(m => ({ userId: m.userId, email: m.user.email, role: m.role })), null, 2));
await p.$disconnect();
