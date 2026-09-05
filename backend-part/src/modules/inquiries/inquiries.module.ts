import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { InquiriesController } from "./inquiries.controller.js";
import { InquiriesRepository } from "./inquiries.repository.js";
import { InquiriesService } from "./inquiries.service.js";

@Module({
  imports: [AuthModule],
  controllers: [InquiriesController],
  providers: [InquiriesRepository, InquiriesService],
})
export class InquiriesModule {}
