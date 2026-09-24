import { Module } from "@nestjs/common";

import { ObservabilityModule } from "../../common/observability/observability.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { OpsController } from "./ops.controller.js";
import { OpsTokenGuard } from "./ops-token.guard.js";

@Module({
  imports: [ObservabilityModule],
  controllers: [HealthController, OpsController],
  providers: [HealthService, OpsTokenGuard],
})
export class HealthModule {}
