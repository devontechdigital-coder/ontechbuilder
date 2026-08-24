import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { FormsController, PublicFormsController } from "./forms.controller.js";
import { FormsService } from "./forms.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [FormsController, PublicFormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
