import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ReportsController } from "./reports.controller.js";
import { ReportsService } from "./reports.service.js";
import { ReportsRepository } from "./reports.repository.js";
import { ReportRateLimiter } from "./report-rate-limiter.js";
@Module({
  imports: [AuthModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRepository, ReportRateLimiter],
})
export class ReportsModule {}
