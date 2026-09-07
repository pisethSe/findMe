import { Controller, Get, Header, Param, Query } from "@nestjs/common";

import { DiscoveryService } from "./discovery.service.js";
import { SearchInstitutionsDto } from "./dto/search-institutions.dto.js";
import { SearchPublicListingsDto } from "./dto/search-public-listings.dto.js";
import {
  PublicListingDetailQueryDto,
  PublicListingSlugDto,
} from "./dto/public-listing-detail.dto.js";
import { ListingDetailService } from "./listing-detail.service.js";

@Controller()
export class DiscoveryController {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly listingDetail: ListingDetailService,
  ) {}

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

  @Get("listings/:slug")
  @Header("Cache-Control", "no-store")
  detail(
    @Param() params: PublicListingSlugDto,
    @Query() query: PublicListingDetailQueryDto,
  ) {
    return this.listingDetail.detail(params.slug, query.institutionId);
  }
}
