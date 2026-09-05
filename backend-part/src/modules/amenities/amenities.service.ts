import { Injectable } from "@nestjs/common";

import { AmenitiesRepository } from "./amenities.repository.js";

@Injectable()
export class AmenitiesService {
  constructor(private readonly repository: AmenitiesRepository) {}

  listActive() {
    return this.repository.listActive();
  }
}
