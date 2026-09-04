import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { CreateListingDto } from "./dto/create-listing.dto.js";
import { ListLandlordListingsDto } from "./dto/list-landlord-listings.dto.js";
import { UpdateAvailabilityDto } from "./dto/update-availability.dto.js";
import { UpdateListingDto } from "./dto/update-listing.dto.js";
import { ListingsService } from "./listings.service.js";

const listingIdPipe = new ParseUUIDPipe({ version: "4" });

@Controller("landlord/listings")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  async create(
    @CurrentUser() user: AccessPrincipal,
    @Body() input: CreateListingDto,
  ) {
    return { data: await this.listings.create(user.id, input) };
  }

  @Get()
  async list(
    @CurrentUser() user: AccessPrincipal,
    @Query() query: ListLandlordListingsDto,
  ) {
    return this.listings.listOwned(user.id, query);
  }

  @Get(":id")
  async get(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
  ) {
    return { data: await this.listings.getOwned(user.id, listingId) };
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
    @Body() input: UpdateListingDto,
  ) {
    return { data: await this.listings.update(user.id, listingId, input) };
  }

  @Patch(":id/availability")
  async updateAvailability(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
    @Body() input: UpdateAvailabilityDto,
  ) {
    return {
      data: await this.listings.updateAvailability(user.id, listingId, input),
    };
  }

  @Post(":id/submit")
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
  ) {
    return { data: await this.listings.submit(user.id, listingId) };
  }

  @Post(":id/pause")
  @HttpCode(HttpStatus.OK)
  async pause(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
  ) {
    return { data: await this.listings.pause(user.id, listingId) };
  }

  @Post(":id/mark-rented")
  @HttpCode(HttpStatus.OK)
  async markRented(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
  ) {
    return { data: await this.listings.markRented(user.id, listingId) };
  }

  @Delete(":id")
  async archive(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
  ) {
    return { data: await this.listings.archive(user.id, listingId) };
  }
}
