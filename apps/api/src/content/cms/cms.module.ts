import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { CmsController } from "./cms.controller.js";
import { CmsService } from "./cms.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [CmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
