import { Controller, Get, Header, UseGuards } from "@nestjs/common";

import { MetricsService } from "../../common/observability/metrics.service.js";
import { OpsTokenGuard } from "./ops-token.guard.js";

/**
 * Private operations surface, gated by `OPS_METRICS_TOKEN`. It stays outside
 * the public discovery and admin APIs and always answers `no-store`.
 */
@Controller("health")
@UseGuards(OpsTokenGuard)
export class OpsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get("metrics")
  @Header("Cache-Control", "no-store")
  getMetrics() {
    return { data: this.metrics.snapshot() };
  }
}
