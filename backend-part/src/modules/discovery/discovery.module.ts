import { Module } from "@nestjs/common";

import { DiscoveryController } from "./discovery.controller.js";
import { DiscoveryRepository } from "./discovery.repository.js";
import { DiscoveryService } from "./discovery.service.js";
import { ListingDetailRepository } from "./listing-detail.repository.js";
import { ListingDetailService } from "./listing-detail.service.js";

@Module({
  controllers: [DiscoveryController],
  providers: [
    DiscoveryRepository,
    DiscoveryService,
    ListingDetailRepository,
    ListingDetailService,
  ],
})
export class DiscoveryModule {}
