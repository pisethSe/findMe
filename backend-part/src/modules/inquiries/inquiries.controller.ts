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

import { UserRole } from "../../generated/prisma/client.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  ListLandlordInquiriesDto,
  ListStudentInquiriesDto,
} from "./dto/list-landlord-inquiries.dto.js";
import {
  CreateInquiryDto,
  InquiryListingParamsDto,
  InquiryParamsDto,
  UpdateInquiryStatusDto,
} from "./dto/inquiry-mutations.dto.js";
import { InquiriesService } from "./inquiries.service.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";

@Controller("landlord/inquiries")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async list(
    @CurrentUser() user: AccessPrincipal,
    @Query() query: ListLandlordInquiriesDto,
  ) {
    return this.inquiries.listForLandlord(user.id, query);
  }

  @Patch(":id/status")
  @Header("Cache-Control", "private, no-store")
  updateStatus(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: InquiryParamsDto,
    @Body() input: UpdateInquiryStatusDto,
  ) {
    return this.inquiries.updateStatus(user.id, params.id, input);
  }
}

@Controller()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post("listings/:listingId/inquiries")
  @RateLimit("inquiry")
  @Header("Cache-Control", "private, no-store")
  create(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: InquiryListingParamsDto,
    @Body() input: CreateInquiryDto,
  ) {
    return this.inquiries.create(user, params.listingId, input);
  }

  @Get("me/inquiries")
  @Header("Cache-Control", "private, no-store")
  list(
    @CurrentUser() user: AccessPrincipal,
    @Query() query: ListStudentInquiriesDto,
  ) {
    return this.inquiries.listForStudent(user, query);
  }
}
