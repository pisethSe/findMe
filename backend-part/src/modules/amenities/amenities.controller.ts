import { Controller, Get } from "@nestjs/common";

import { AmenitiesService } from "./amenities.service.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";

@Controller("amenities")
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Get()
  @RateLimit("catalog")
  async list() {
    return { data: await this.amenities.listActive() };
  }
}
