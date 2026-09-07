import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { FavoritesController } from "./favorites.controller.js";
import { FavoritesRepository } from "./favorites.repository.js";
import { FavoritesService } from "./favorites.service.js";

@Module({
  imports: [AuthModule],
  controllers: [FavoritesController],
  providers: [FavoritesRepository, FavoritesService],
})
export class FavoritesModule {}
