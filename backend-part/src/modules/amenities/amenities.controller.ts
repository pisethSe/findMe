import { Controller, Get } from "@nestjs/common";

import { AmenitiesService } from "./amenities.service.js";

@Controller("amenities")
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Get()
  async list() {
    return { data: await this.amenities.listActive() };
  }
}
