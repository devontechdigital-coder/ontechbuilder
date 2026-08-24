import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthModule } from "../../identity/auth/auth.module.js";
import { TenantsModule } from "../../identity/tenants/tenants.module.js";
import { FormsController, PublicFormsController } from "./forms.controller.js";
import { FormsService } from "./forms.service.js";
import { LeadsController } from "./leads.controller.js";
import { LeadsService } from "./leads.service.js";

@Module({
  imports: [CoreModule, AuthModule, TenantsModule],
  controllers: [FormsController, PublicFormsController, LeadsController],
  providers: [FormsService, LeadsService],
  exports: [FormsService, LeadsService],
})
export class FormsModule {}
