import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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
import { AdminService } from "./admin.service.js";
import { RateLimit } from "../rate-limits/rate-limit.policy.js";
import {
  AdminIdDto,
  AdminListingsQueryDto,
  AdminNoteDto,
  AdminPageDto,
  AdminReportsQueryDto,
  RemoveListingDto,
  UpdateReportDto,
} from "./admin.dto.js";
@Controller("admin")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles("ADMIN")
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get("reports") @Header("Cache-Control", "private, no-store") reports(
    @Query() query: AdminReportsQueryDto,
  ) {
    return this.admin.reports(query);
  }
  @Patch("reports/:id")
  @RateLimit("adminWrite")
  @Header("Cache-Control", "private, no-store")
  updateReport(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: UpdateReportDto,
  ) {
    return this.admin.updateReport(user.id, params.id, input);
  }
  @Get("users") @Header("Cache-Control", "private, no-store") users(
    @Query() query: AdminPageDto,
  ) {
    return this.admin.users(query);
  }
  @Post("users/:id/suspend")
  @RateLimit("adminWrite")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  suspend(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: AdminNoteDto,
  ) {
    return this.admin.setUserStatus(
      user.id,
      params.id,
      "SUSPENDED",
      input.note,
    );
  }
  @Post("users/:id/reactivate")
  @RateLimit("adminWrite")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  reactivate(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: AdminNoteDto,
  ) {
    return this.admin.setUserStatus(user.id, params.id, "ACTIVE", input.note);
  }
  @Get("listings") @Header("Cache-Control", "private, no-store") listings(
    @Query() query: AdminListingsQueryDto,
  ) {
    return this.admin.listings(query);
  }
  @Get("listings/:id") @Header("Cache-Control", "private, no-store") listing(
    @Param() params: AdminIdDto,
  ) {
    return this.admin.listing(params.id);
  }
  @Post("listings/:id/pause")
  @RateLimit("adminWrite")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  pause(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: RemoveListingDto,
  ) {
    return this.admin.removeListing(user.id, params.id, "PAUSED", input);
  }
  @Post("listings/:id/archive")
  @RateLimit("adminWrite")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  archive(
    @CurrentUser() user: AccessPrincipal,
    @Param() params: AdminIdDto,
    @Body() input: RemoveListingDto,
  ) {
    return this.admin.removeListing(user.id, params.id, "ARCHIVED", input);
  }
}
