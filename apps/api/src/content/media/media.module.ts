import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { MediaMetadataController } from "./media-metadata.controller.js";
import { MediaMetadataService } from "./media-metadata.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [MediaMetadataController],
  providers: [MediaMetadataService],
  exports: [MediaMetadataService],
})
export class MediaModule {}
