import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import {
  AccountRateLimitInterceptor,
  RateLimitGuard,
} from "./rate-limit.http.js";
import { RateLimitService } from "./rate-limit.service.js";
import { RedisRateLimitStore } from "./rate-limit.store.js";

@Module({
  providers: [
    RedisRateLimitStore,
    RateLimitService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AccountRateLimitInterceptor },
  ],
})
export class RateLimitsModule {}
