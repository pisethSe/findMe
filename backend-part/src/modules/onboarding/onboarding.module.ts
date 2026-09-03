import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { LandlordOnboardingController } from "./landlord-onboarding.controller.js";
import { OnboardingController } from "./onboarding.controller.js";
import { OnboardingRepository } from "./onboarding.repository.js";
import { OnboardingService } from "./onboarding.service.js";

@Module({
  imports: [AuthModule],
  controllers: [OnboardingController, LandlordOnboardingController],
  providers: [OnboardingRepository, OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
