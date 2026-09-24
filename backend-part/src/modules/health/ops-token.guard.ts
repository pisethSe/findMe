import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

import { resolveOpsMetricsToken } from "../../config/environment.js";

function matchesSecret(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

/**
 * Operations endpoints are never public. An unset token makes the route behave
 * as if it did not exist, and a configured token must match exactly.
 */
@Injectable()
export class OpsTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = resolveOpsMetricsToken(process.env.OPS_METRICS_TOKEN);
    if (!token) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
      });
    }

    const [scheme, value] = (
      context.switchToHttp().getRequest<Request>().header("authorization") ?? ""
    ).split(" ");

    if (
      scheme?.toLowerCase() !== "bearer" ||
      !value ||
      !matchesSecret(value, token)
    ) {
      throw new UnauthorizedException({
        code: "OPS_TOKEN_REQUIRED",
        message: "A valid operations token is required.",
      });
    }

    return true;
  }
}
