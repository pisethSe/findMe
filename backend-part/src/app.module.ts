import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { AmenitiesModule } from "./modules/amenities/amenities.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { DiscoveryModule } from "./modules/discovery/discovery.module.js";
import { EntitlementsModule } from "./modules/entitlements/entitlements.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { FavoritesModule } from "./modules/favorites/favorites.module.js";
import { InquiriesModule } from "./modules/inquiries/inquiries.module.js";
import { ListingsModule } from "./modules/listings/listings.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { ModerationModule } from "./modules/moderation/moderation.module.js";
import { OnboardingModule } from "./modules/onboarding/onboarding.module.js";
import { PublicCacheModule } from "./modules/public-cache/public-cache.module.js";

import { ReportsModule } from "./modules/reports/reports.module.js";

import { AdminModule } from "./modules/admin/admin.module.js";
import { RateLimitsModule } from "./modules/rate-limits/rate-limits.module.js";

@Module({
  imports: [
    RateLimitsModule,
    DatabaseModule,
    PublicCacheModule,
    AmenitiesModule,
    DiscoveryModule,
    AuthModule,
    OnboardingModule,
    EntitlementsModule,
    ListingsModule,
    InquiriesModule,
    FavoritesModule,
    ReportsModule,
    MediaModule,
    ModerationModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
