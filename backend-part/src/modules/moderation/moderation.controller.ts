import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { ListPendingListingsDto } from "./dto/list-pending-listings.dto.js";
import { RejectListingDto } from "./dto/reject-listing.dto.js";
import { ModerationService } from "./moderation.service.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";

const listingIdPipe = new ParseUUIDPipe({ version: "4" });

@Controller("admin/listings")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get("pending")
  @Header("Cache-Control", "private, no-store")
  listPending(@Query() query: ListPendingListingsDto) {
    return this.moderation.listPending(query);
  }

  @Post(":id/approve")
  @RateLimit("adminWrite")
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() admin: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
  ) {
    return { data: await this.moderation.approve(admin.id, listingId) };
  }

  @Post(":id/reject")
  @RateLimit("adminWrite")
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentUser() admin: AccessPrincipal,
    @Param("id", listingIdPipe) listingId: string,
    @Body() input: RejectListingDto,
  ) {
    return {
      data: await this.moderation.reject(
        admin.id,
        listingId,
        input.moderationNote,
      ),
    };
  }
}
