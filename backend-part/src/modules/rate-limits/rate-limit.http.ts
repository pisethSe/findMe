import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
  type NestInterceptor,
  type CallHandler,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Observable } from "rxjs";
import type { RequestWithPrincipal } from "../auth/access-token.guard.js";
import { rateLimitEmail, rateLimitIp } from "./rate-limit.identity.js";
import {
  RATE_LIMIT_METADATA,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
  type RateLimitPolicyName,
} from "./rate-limit.policy.js";
import { RateLimitService } from "./rate-limit.service.js";

function policyFor(context: ExecutionContext, reflector: Reflector) {
  const name = reflector.getAllAndOverride<RateLimitPolicyName | undefined>(
    RATE_LIMIT_METADATA,
    [context.getHandler(), context.getClass()],
  );
  return name
    ? { name, policy: RATE_LIMIT_POLICIES[name] as RateLimitPolicy }
    : null;
}

// Runs before authentication and DTO validation to bound invalid requests too.
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = policyFor(context, this.reflector);
    if (!config) return true;
    const request = context.switchToHttp().getRequest<Request>();
    await this.limits.enforce(
      config.name,
      "ip",
      rateLimitIp(request.ip ?? request.socket.remoteAddress),
      config.policy.ip,
    );
    const email = config.policy.email ? rateLimitEmail(request.body) : null;
    if (email && config.policy.email) {
      await this.limits.enforce(
        config.name,
        "email",
        email,
        config.policy.email,
      );
    }
    return true;
  }
}

// Nest interceptors execute after all guards, so identity comes exclusively from
// AccessTokenGuard's verified database principal, never JWT claims or the body.
@Injectable()
export class AccountRateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly limits: RateLimitService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const config = policyFor(context, this.reflector);
    if (config?.policy.user) {
      const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
      if (!request.user)
        throw new UnauthorizedException({
          code: "ACCESS_TOKEN_REQUIRED",
          message: "A valid bearer access token is required.",
        });
      await this.limits.enforce(
        config.name,
        "user",
        request.user.id,
        config.policy.user,
      );
    }
    return next.handle();
  }
}
