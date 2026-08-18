/**
 * Copies theme source files from a local theme package folder into the
 * ThemeDraft.files JSON that the customizer actually renders from.
 *
 * The draft holds its own snapshot of the uploaded theme, so editing the
 * repo's theme-zip alone changes nothing in a running install — this pushes
 * those edits into a specific installation's draft.
 *
 * Usage:
 *   node scripts/sync-theme-files.cjs <themePackageDir> <installationId> <file...>
 *   node scripts/sync-theme-files.cjs <themePackageDir> <installationId> --all
 *
 * Files must be listed explicitly. `--all` exists but is deliberately opt-in:
 * a local package can legitimately drift from what a given install actually
 * has (extra sections, a different section registry), so blanket-copying can
 * push a file whose imports the draft cannot resolve and break the render.
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const [packageDir, installationId, ...rest] = process.argv.slice(2);
const syncAll = rest.includes("--all");
const explicitFiles = rest.filter((arg) => arg !== "--all");

if (!packageDir || !installationId || (!explicitFiles.length && !syncAll)) {
  console.error("usage: node scripts/sync-theme-files.cjs <themePackageDir> <installationId> <file...|--all>");
  process.exit(1);
}

const prisma = new PrismaClient();

(async () => {
  const draft = await prisma.themeDraft.findFirst({
    where: { installationId },
    orderBy: { updatedAt: "desc" },
  });

  if (!draft) {
    throw new Error(`No draft found for installation ${installationId}`);
  }

  const files = { ...(draft.files ?? {}) };
  const targets = syncAll ? Object.keys(files) : explicitFiles;
  const updated = [];
  const missing = [];

  for (const relativePath of targets) {
    const diskPath = path.join(packageDir, relativePath);
    if (!fs.existsSync(diskPath)) {
      missing.push(relativePath);
      continue;
    }
    const contents = fs.readFileSync(diskPath, "utf8");
    if (files[relativePath] === contents) continue;
    files[relativePath] = contents;
    updated.push(relativePath);
  }

  if (!updated.length) {
    console.log("No changes — draft already matches disk.");
  } else {
    await prisma.themeDraft.update({ where: { id: draft.id }, data: { files } });
    console.log(`Updated ${updated.length} file(s) in draft ${draft.id}:`);
    for (const file of updated) console.log("  " + file);
  }

  if (missing.length) {
    console.log(`Skipped ${missing.length} draft file(s) with no local counterpart (e.g. ${missing[0]}).`);
  }

  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error.message);
  await prisma.$disconnect();
  process.exit(1);
});
