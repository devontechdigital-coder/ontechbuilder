import { Module } from "@nestjs/common";
import { configProvider } from "./config/config.provider.js";
import { PrismaService } from "./database/prisma.service.js";
import { ObjectStorageHealthService } from "./storage/object-storage-health.service.js";
import { ObjectStorageService } from "./storage/object-storage.service.js";
import { DevStorageController } from "./storage/dev-storage.controller.js";

@Module({
  controllers: [DevStorageController],
  providers: [configProvider, PrismaService, ObjectStorageService, ObjectStorageHealthService],
  exports: [configProvider, PrismaService, ObjectStorageService, ObjectStorageHealthService],
})
export class CoreModule {}
