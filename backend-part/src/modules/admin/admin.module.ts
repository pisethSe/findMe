import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminRepository } from "./admin.repository.js";
import { AdminService } from "./admin.service.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogRepository } from "./catalog.repository.js";
import { CatalogService } from "./catalog.service.js";
@Module({
  imports: [AuthModule],
  controllers: [AdminController, CatalogController],
  providers: [AdminRepository, AdminService, CatalogRepository, CatalogService],
})
export class AdminModule {}
