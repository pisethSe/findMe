import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "../../generated/prisma/client.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  FavoriteMutationDto,
  FavoriteParamsDto,
  ListFavoritesDto,
} from "./favorites.dto.js";
import { FavoritesService } from "./favorites.service.js";

@Controller("me/favorites")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@CurrentUser() user: AccessPrincipal, @Query() query: ListFavoritesDto) {
    return this.service.list(user, query);
  }

  @Put(":listingId")
  @Header("Cache-Control", "private, no-store")
  save(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: FavoriteParamsDto,
    @Body() _body: FavoriteMutationDto,
  ) {
    return this.service.setSaved(user, params.listingId, true);
  }

  @Delete(":listingId")
  @Header("Cache-Control", "private, no-store")
  remove(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: FavoriteParamsDto,
    @Body() _body: FavoriteMutationDto,
  ) {
    return this.service.setSaved(user, params.listingId, false);
  }
}
