import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { AuthService } from "./auth.service.js";
import type { AccessPrincipal } from "./auth.types.js";

export type RequestWithPrincipal = Request & { user?: AccessPrincipal };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const authorization = request.header("authorization")?.trim();
    const [scheme, token, ...extra] = authorization?.split(/\s+/) ?? [];

    if (scheme !== "Bearer" || !token || extra.length > 0) {
      throw new UnauthorizedException({
        code: "ACCESS_TOKEN_REQUIRED",
        message: "A valid bearer access token is required.",
      });
    }

    request.user = await this.authService.authenticateAccessToken(token);
    return true;
  }
}
