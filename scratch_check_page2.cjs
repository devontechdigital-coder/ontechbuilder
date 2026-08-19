const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const pages = await prisma.page.findMany({ where: { websiteId: '69adf34d-ac3a-48f5-998a-c9ab17253b93' }, take: 5 });
  console.log('pages for known website:', pages.map(p => ({ id: p.id, title: p.title, slug: p.slug })));
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
