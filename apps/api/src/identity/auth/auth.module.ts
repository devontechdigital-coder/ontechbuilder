import { Module } from "@nestjs/common";
import { CoreModule } from "../../core/core.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { RolesGuard } from "./roles.guard.js";
import { SessionService } from "./session.service.js";
import { TenantContextGuard } from "./tenant-context.guard.js";

@Module({
  imports: [CoreModule],
  controllers: [AuthController],
  providers: [AuthGuard, AuthService, RolesGuard, SessionService, TenantContextGuard],
  exports: [AuthGuard, RolesGuard, SessionService, TenantContextGuard],
})
export class AuthModule {}
