const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const page = await prisma.page.findUnique({ where: { id: '6391b097-7623-43f4-8954-345515e253fc' } });
  console.log('page:', page ? { id: page.id, title: page.title, websiteId: page.websiteId, slug: page.slug } : 'NOT FOUND');

  const website = await prisma.website.findUnique({ where: { id: 'bf32ed83-8ca5-445b-aa2f-eaad73d1b6cb' } });
  console.log('website:', website ? { id: website.id, name: website.name } : 'NOT FOUND');

  const theme = await prisma.themeInstallation.findUnique({ where: { id: 'dd53de44-a643-44d9-bbae-c999a2455ac1' }, include: { themePackage: true } });
  console.log('theme:', theme ? { id: theme.id, status: theme.status, name: theme.name, websiteId: theme.websiteId, package: theme.themePackage.name } : 'NOT FOUND');

  console.log('page.websiteId matches given website?', page && website && page.websiteId === website.id);
  console.log('theme.websiteId matches given website?', theme && website && theme.websiteId === website.id);

  const draft = await prisma.themeDraft.findFirst({ where: { installationId: 'dd53de44-a643-44d9-bbae-c999a2455ac1' }, orderBy: { updatedAt: 'desc' } });
  console.log('draft exists:', !!draft, draft ? 'files=' + Object.keys(draft.files).length : '');
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
