import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { getAppEnvironment, getAuthSecret } from "../../config/environment.js";
import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyName,
  type RateLimitWindow,
} from "./rate-limit.policy.js";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
} from "./rate-limit.store.js";

@Injectable()
export class RateLimitService {
  private readonly memory = new MemoryRateLimitStore();
  private readonly deployed = ["staging", "production"].includes(
    getAppEnvironment(process.env.APP_ENV),
  );
  private readonly secret = getAuthSecret(
    "REFRESH_TOKEN_SECRET",
    process.env.REFRESH_TOKEN_SECRET,
  );

  constructor(private readonly redis: RedisRateLimitStore) {}

  async enforce(
    policy: RateLimitPolicyName,
    scope: "ip" | "email" | "user",
    identity: string,
    window: RateLimitWindow,
  ): Promise<void> {
    const digest = createHmac("sha256", this.secret)
      .update(JSON.stringify(["rate-limit:v1", scope, identity]))
      .digest("hex");
    const key = `findme:v1:request-limit:${policy}:${scope}:${digest}`;
    let result = await this.redis.consume(key, window);
    if (!result && !(this.deployed && RATE_LIMIT_POLICIES[policy].failClosed)) {
      result = this.memory.consume(key, window);
    }
    if (!result) {
      throw new ServiceUnavailableException({
        code: "RATE_LIMIT_UNAVAILABLE",
        message:
          "This action is temporarily unavailable. Please try again in 30 seconds.",
        retryAfterSeconds: 30,
      });
    }
    if (!result.allowed) {
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: `Too many requests. Please try again in ${result.retryAfterSeconds} seconds.`,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        429,
      );
    }
  }
}
