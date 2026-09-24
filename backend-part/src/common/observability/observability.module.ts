import { Module } from "@nestjs/common";

import { MetricsService } from "./metrics.service.js";

/**
 * Cross-cutting runtime telemetry. It lives beside its code instead of in
 * `src/modules` because no product domain owns it.
 */
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
