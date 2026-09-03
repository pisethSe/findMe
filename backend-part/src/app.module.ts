import { Module } from "@nestjs/common";

import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";

@Module({
  imports: [DatabaseModule, AuthModule, HealthModule],
})
export class AppModule {}
