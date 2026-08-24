import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const pageId = "a2e040ce-7bbe-418f-a893-941b87a59216";
const installationId = "19049d79-8e87-4c7c-82c8-21204f4837be";

const installation = await prisma.themeInstallation.findUnique({
  where: { id: installationId },
  select: { id: true, activeVersionId: true, currentDraftId: true, status: true, name: true },
});
console.log("installation:", installation);

const version = await prisma.themeVersion.findUnique({ where: { id: installation.activeVersionId }, select: { versionNumber: true, settings: true, createdAt: true } });
const vSettings = version?.settings ?? {};
console.log("\nPUBLISHED version:", version?.versionNumber, version?.createdAt);
console.log("PUBLISHED customizer.pages keys:", Object.keys(vSettings.customizer?.pages ?? {}));
console.log("PUBLISHED page sections for about:", JSON.stringify(vSettings.customizer?.pages?.[pageId]?.sections)?.slice(0, 800));

const draft = await prisma.themeDraft.findUnique({ where: { id: installation.currentDraftId }, select: { revision: true, settings: true, updatedAt: true } });
const dSettings = draft?.settings ?? {};
console.log("\nDRAFT revision:", draft?.revision, draft?.updatedAt);
console.log("DRAFT customizer.pages keys:", Object.keys(dSettings.customizer?.pages ?? {}));
console.log("DRAFT page sections for about:", JSON.stringify(dSettings.customizer?.pages?.[pageId]?.sections)?.slice(0, 800));

await prisma.$disconnect();
