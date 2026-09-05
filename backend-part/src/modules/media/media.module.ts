import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { EntitlementsModule } from "../entitlements/entitlements.module.js";
import { MediaController } from "./media.controller.js";
import { MediaRepository } from "./media.repository.js";
import { MediaService } from "./media.service.js";
import { ObjectStorageService } from "./object-storage.service.js";

@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [MediaController],
  providers: [MediaRepository, MediaService, ObjectStorageService],
})
export class MediaModule {}
