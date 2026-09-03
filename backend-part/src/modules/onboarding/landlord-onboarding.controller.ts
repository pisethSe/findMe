import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { CompleteLandlordOnboardingDto } from "./dto/complete-landlord-onboarding.dto.js";
import { OnboardingService } from "./onboarding.service.js";

@Controller("landlord")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class LandlordOnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post("onboarding")
  @HttpCode(200)
  async complete(
    @CurrentUser() user: AccessPrincipal,
    @Body() input: CompleteLandlordOnboardingDto,
  ) {
    const result = await this.onboarding.completeLandlordOnboarding(
      user,
      input,
    );
    return {
      data: {
        onboarding: result.onboarding,
        profile: result.activation.profile,
        entitlement: result.activation.entitlement,
      },
    };
  }
}
