import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { AdminIdDto, AdminPageDto } from "./admin.dto.js";
import { SaveAmenityDto, SaveInstitutionDto } from "./catalog.dto.js";
import { CatalogService } from "./catalog.service.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";
@Controller("admin")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles("ADMIN")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Get("institutions")
  @Header("Cache-Control", "private, no-store")
  institutions(@Query() input: AdminPageDto) {
    return this.catalog.list("institutions", input);
  }
  @Get("amenities") @Header("Cache-Control", "private, no-store") amenities(
    @Query() input: AdminPageDto,
  ) {
    return this.catalog.list("amenities", input);
  }
  @Post("institutions")
  @RateLimit("adminWrite")
  institution(
    @CurrentUser() user: AccessPrincipal,
    @Body() input: SaveInstitutionDto,
  ) {
    return this.catalog.institution(user.id, undefined, input);
  }
  @Patch("institutions/:id")
  @RateLimit("adminWrite")
  updateInstitution(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: SaveInstitutionDto,
  ) {
    return this.catalog.institution(user.id, params.id, input);
  }
  @Post("amenities")
  @RateLimit("adminWrite")
  amenity(@CurrentUser() user: AccessPrincipal, @Body() input: SaveAmenityDto) {
    return this.catalog.amenity(user.id, undefined, input);
  }
  @Patch("amenities/:id")
  @RateLimit("adminWrite")
  updateAmenity(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: SaveAmenityDto,
  ) {
    return this.catalog.amenity(user.id, params.id, input);
  }
}
