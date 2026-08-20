import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const version = await prisma.themeVersion.findUnique({ where: { id: "894df56b-7ca1-4d0a-9b15-4131c816edca" }, select: { files: true } });
console.log(version.files["sections/Header/Header.tsx"]);
await prisma.$disconnect();
