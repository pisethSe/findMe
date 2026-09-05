import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client.js";
import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AccessPrincipal } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { CreateUploadIntentDto } from "./dto/create-upload-intent.dto.js";
import { FinalizeMediaDto } from "./dto/finalize-media.dto.js";
import { MediaService } from "./media.service.js";

const mediaIdPipe = new ParseUUIDPipe({ version: "4" });

@Controller("media")
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.LANDLORD)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post("upload-intents")
  async createUploadIntent(
    @CurrentUser() user: AccessPrincipal,
    @Body() input: CreateUploadIntentDto,
  ) {
    return { data: await this.media.createUploadIntent(user.id, input) };
  }

  @Post(":id/finalize")
  @HttpCode(200)
  async finalize(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", mediaIdPipe) mediaId: string,
    @Body() input: FinalizeMediaDto,
  ) {
    return { data: await this.media.finalize(user.id, mediaId, input) };
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: AccessPrincipal,
    @Param("id", mediaIdPipe) mediaId: string,
  ) {
    return { data: await this.media.remove(user.id, mediaId) };
  }
}
