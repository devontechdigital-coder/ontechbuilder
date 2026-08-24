import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const pageId = "a2e040ce-7bbe-418f-a893-941b87a59216";
const installation = await prisma.themeInstallation.findUnique({
  where: { id: "19049d79-8e87-4c7c-82c8-21204f4837be" },
  select: { activeVersionId: true },
});
const version = await prisma.themeVersion.findUnique({ where: { id: installation.activeVersionId }, select: { settings: true } });
const settings = version.settings;

const { expandFormShortcodes } = await import("../apps/renderer/lib/theme-engine/shortcodes.ts");
const expanded = await expandFormShortcodes(settings, "http://localhost:4000", "http://localhost:4000", new Map());

const before = settings.customizer?.pages?.[pageId]?.sections;
const after = expanded.customizer?.pages?.[pageId]?.sections;
console.log("before section count:", before?.length, before?.map((s) => s.id));
console.log("after section count:", after?.length, after?.map((s) => s.id));
console.log("structurally equal:", JSON.stringify(before) === JSON.stringify(after).replace(/\[form id="[^"]*"\]/g, 'PLACEHOLDER'));

await prisma.$disconnect();
