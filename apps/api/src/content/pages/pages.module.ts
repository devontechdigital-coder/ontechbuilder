import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { PagesController } from "./pages.controller.js";
import { PagesService } from "./pages.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
