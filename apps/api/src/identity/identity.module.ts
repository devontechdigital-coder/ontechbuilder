import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { TenantsModule } from "./tenants/tenants.module.js";

@Module({
  imports: [AuthModule, TenantsModule],
})
export class IdentityModule {}
