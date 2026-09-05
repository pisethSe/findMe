import { Global, Module } from "@nestjs/common";

import { PublicCacheService } from "./public-cache.service.js";

@Global()
@Module({
  providers: [PublicCacheService],
  exports: [PublicCacheService],
})
export class PublicCacheModule {}
