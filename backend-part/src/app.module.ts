import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { AmenitiesModule } from "./modules/amenities/amenities.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { DiscoveryModule } from "./modules/discovery/discovery.module.js";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { InquiriesModule } from "./modules/inquiries/inquiries.module.js";
import { ListingsModule } from "./modules/listings/listings.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { ModerationModule } from "./modules/moderation/moderation.module.js";
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js";
import { PublicCacheModule } from "./modules/public-cache/public-cache.module.js";

@Module({
  imports: [
    DatabaseModule,
    PublicCacheModule,
    AmenitiesModule,
    DiscoveryModule,
    AuthModule,
    OnboardingModule,
    EntitlementsModule,
    ListingsModule,
    InquiriesModule,
    MediaModule,
    ModerationModule,
    HealthModule,
  ],
})
export class AppModule {}
