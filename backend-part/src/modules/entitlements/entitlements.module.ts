import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EntitlementsController } from "./entitlements.controller.js";
import { EntitlementsRepository } from "./entitlements.repository.js";
import { EntitlementsService } from "./entitlements.service.js";

@Module({
  imports: [AuthModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsRepository, EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
