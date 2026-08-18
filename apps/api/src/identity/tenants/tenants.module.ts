import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantAccessService } from "./tenant-access.service.js";
import { TenantsController } from "./tenants.controller.js";
import { TenantsService } from "./tenants.service.js";

@Module({
  imports: [CoreModule, AuthModule],
  controllers: [TenantsController],
  providers: [TenantAccessService, TenantsService],
  exports: [TenantAccessService, TenantsService],
})
export class TenantsModule {}
