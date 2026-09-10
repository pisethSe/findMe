import {
  Body,
  Controller,
  Header,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { CreateReportDto, ReportListingParamsDto } from "./reports.dto.js";
import { ReportsService } from "./reports.service.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";
@Controller("listings/:listingId/reports")
@UseGuards(AccessTokenGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Post()
  @RateLimit("report")
  @Header("Cache-Control", "private, no-store")
  create(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: ReportListingParamsDto,
    @Body() input: CreateReportDto,
  ) {
    return this.reports.create(user.id, params.listingId, input);
  }
}
