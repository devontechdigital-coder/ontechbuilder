import { Module } from "@nestjs/common";
import { CoreModule } from "../../core.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { RootController } from "./root.controller.js";

@Module({
  imports: [CoreModule],
  controllers: [RootController, HealthController],
  providers: [HealthService],
})
export class HealthModule {}
