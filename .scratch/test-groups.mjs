import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const pageId = "a2e040ce-7bbe-418f-a893-941b87a59216";
const installation = await prisma.themeInstallation.findUnique({
  where: { id: "19049d79-8e87-4c7c-82c8-21204f4837be" },
  select: { activeVersionId: true },
});
const version = await prisma.themeVersion.findUnique({ where: { id: installation.activeVersionId }, select: { settings: true, files: true, manifest: true } });
const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true, slug: true, templateId: true } });
console.log("page:", page);

const { resolvePageTemplateId } = await import("../apps/renderer/lib/theme-engine/resolve-template.ts");
const templateId = resolvePageTemplateId({ slug: page.slug, templateId: page.templateId });
console.log("resolved templateId:", templateId);

const { resolveThemeRenderer } = await import("../apps/renderer/lib/theme-engine/theme-renderer.ts");
const { sectionSchemas, getTemplateScope } = resolveThemeRenderer(null, { manifest: version.manifest, files: version.files });
const templateScope = getTemplateScope(templateId);
console.log("templateScope:", templateScope);
console.log("sectionSchemas count:", sectionSchemas.length);
console.log("has custom-section schema:", sectionSchemas.some((s) => s.id === "custom-section"));
console.log("has hero schema:", sectionSchemas.some((s) => s.id === "hero"));

const { getAllGroupSections } = await import("../apps/renderer/lib/theme-engine/state.ts");
const groups = getAllGroupSections(version.settings, pageId, sectionSchemas, templateScope);
console.log("groups.template count:", groups.template.length);
console.log("groups.template ids:", groups.template.map((s) => s.id));

await prisma.$disconnect();
