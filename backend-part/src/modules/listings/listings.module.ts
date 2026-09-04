import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EntitlementsModule } from "../entitlements/entitlements.module.js";
import { ListingsController } from "./listings.controller.js";
import { ListingsRepository } from "./listings.repository.js";
import { ListingsService } from "./listings.service.js";

@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [ListingsController],
  providers: [ListingsRepository, ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
