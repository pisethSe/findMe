import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AccessPrincipal } from "./auth.types.js";
import type { RequestWithPrincipal } from "./access-token.guard.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessPrincipal => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    if (!request.user) {
      throw new Error("CurrentUser requires AccessTokenGuard.");
    }
    return request.user;
  },
);
