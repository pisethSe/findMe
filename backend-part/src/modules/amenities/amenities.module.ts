import { Module } from "@nestjs/common";

import { AmenitiesController } from "./amenities.controller.js";
import { AmenitiesRepository } from "./amenities.repository.js";
import { AmenitiesService } from "./amenities.service.js";

@Module({
  controllers: [AmenitiesController],
  providers: [AmenitiesRepository, AmenitiesService],
  exports: [AmenitiesService],
})
export class AmenitiesModule {}
