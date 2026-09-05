import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { ListLandlordInquiriesDto } from "./dto/list-landlord-inquiries.dto.js";
import { InquiriesService } from "./inquiries.service.js";

@Controller("landlord/inquiries")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  async list(
    @CurrentUser() user: AccessPrincipal,
    @Query() query: ListLandlordInquiriesDto,
  ) {
    return this.inquiries.listForLandlord(user.id, query);
  }
}
