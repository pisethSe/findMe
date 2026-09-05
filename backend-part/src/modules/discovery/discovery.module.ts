import { Module } from "@nestjs/common";

import { DiscoveryController } from "./discovery.controller.js";
import { DiscoveryRepository } from "./discovery.repository.js";
import { DiscoveryService } from "./discovery.service.js";

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryRepository, DiscoveryService],
})
export class DiscoveryModule {}
