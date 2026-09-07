import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import {
  InquiriesController,
  StudentInquiriesController,
} from "./inquiries.controller.js";
import { InquiryRateLimiter } from "./inquiry-rate-limiter.js";
import { InquiriesRepository } from "./inquiries.repository.js";
import { InquiriesService } from "./inquiries.service.js";

@Module({
  imports: [AuthModule],
  controllers: [InquiriesController, StudentInquiriesController],
  providers: [InquiriesRepository, InquiriesService, InquiryRateLimiter],
})
export class InquiriesModule {}
