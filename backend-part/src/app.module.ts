import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ListingsModule } from "./modules/listings/listings.module.js";
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OnboardingModule,
    EntitlementsModule,
    ListingsModule,
    HealthModule,
  ],
})
export class AppModule {}
