import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EntitlementsModule } from "../entitlements/entitlements.module.js";
import { ModerationController } from "./moderation.controller.js";
import { ModerationRepository } from "./moderation.repository.js";
import { ModerationService } from "./moderation.service.js";

@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [ModerationController],
  providers: [ModerationRepository, ModerationService],
})
export class ModerationModule {}
