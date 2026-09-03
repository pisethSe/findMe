import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SelectRoleDto } from "./dto/select-role.dto.js";
import { OnboardingService } from "./onboarding.service.js";

@Controller("me/onboarding")
@UseGuards(AccessTokenGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  async getState(@CurrentUser() user: AccessPrincipal) {
    return { data: await this.onboarding.getState(user.id) };
  }

  @Post("role")
  @HttpCode(200)
  async selectRole(
    @CurrentUser() user: AccessPrincipal,
    @Body() input: SelectRoleDto,
  ) {
    return { data: await this.onboarding.selectRole(user.id, input) };
  }
}
