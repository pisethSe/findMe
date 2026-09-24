import { Module } from "@nestjs/common";

import { AccessTokenGuard } from "./access-token.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { PasswordService } from "./password.service.js";
import { RolesGuard } from "./roles.guard.js";
import { TokenService } from "./token.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    GoogleOAuthService,
    PasswordService,
    TokenService,
    AccessTokenGuard,
    RolesGuard,
  ],
  exports: [AuthService, AccessTokenGuard, RolesGuard],
})
export class AuthModule {}
