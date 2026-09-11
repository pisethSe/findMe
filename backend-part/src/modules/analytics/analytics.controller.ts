import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";
import { AnalyticsSummaryQueryDto } from "./analytics.dto.js";
import { AnalyticsService } from "./analytics.service.js";

@Controller("admin/analytics")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles("ADMIN")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("summary")
  @RateLimit("analyticsRead")
  @Header("Cache-Control", "private, no-store")
  summary(@Query() query: AnalyticsSummaryQueryDto) {
    return this.analytics.summary(query);
  }
}
