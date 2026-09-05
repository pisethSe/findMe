import { Controller, Get, Header, Query } from "@nestjs/common";

import { DiscoveryService } from "./discovery.service.js";
import { SearchInstitutionsDto } from "./dto/search-institutions.dto.js";
import { SearchPublicListingsDto } from "./dto/search-public-listings.dto.js";

@Controller()
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get("institutions")
  @Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  async institutions(@Query() query: SearchInstitutionsDto) {
    return this.discovery.listInstitutions(query);
  }

  @Get("listings/search")
  @Header("Cache-Control", "no-store")
  search(@Query() query: SearchPublicListingsDto) {
    return this.discovery.search(query);
  }
}
