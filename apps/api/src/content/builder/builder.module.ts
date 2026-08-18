import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { BuilderController } from "./builder.controller.js";
import { BuilderService } from "./builder.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [BuilderController],
  providers: [BuilderService],
  exports: [BuilderService],
})
export class BuilderModule {}
