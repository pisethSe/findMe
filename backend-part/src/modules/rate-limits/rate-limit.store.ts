import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { createClient } from "redis";
import { getAppEnvironment, getRedisUrl } from "../../config/environment.js";
import type { RateLimitWindow } from "./rate-limit.policy.js";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Check, increment and expiry are atomic across API instances. Redis owns the
// window clock via PTTL; rejected requests never extend the window.
const CONSUME = `
local ttl = redis.call('PTTL', KEYS[1])
local limit = tonumber(ARGV[1])
if ttl <= 0 then
  redis.call('SET', KEYS[1], 1, 'PX', ARGV[2])
  return {1, tonumber(ARGV[2])}
end
local count = tonumber(redis.call('GET', KEYS[1]))
if count >= limit then return {0, ttl} end
redis.call('INCR', KEYS[1])
return {1, ttl}
`;

function createRateLimitClient(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 500,
      reconnectStrategy: false,
    },
  });
}
type Client = ReturnType<typeof createRateLimitClient>;

async function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Rate limit operation timed out.")),
          750,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class RedisRateLimitStore implements OnModuleDestroy {
  private readonly logger = new Logger(RedisRateLimitStore.name);
  private readonly url = getRedisUrl(
    process.env.REDIS_URL,
    getAppEnvironment(process.env.APP_ENV),
  );
  private client: Client | null = null;
  private connecting: Promise<Client | null> | null = null;
  private retryAt = 0;
  private destroyed = false;

  async consume(
    key: string,
    window: RateLimitWindow,
  ): Promise<RateLimitDecision | null> {
    const client = await this.getClient();
    if (!client) return null;
    try {
      const result = await withDeadline(
        client.eval(CONSUME, {
          keys: [key],
          arguments: [String(window.limit), String(window.seconds * 1000)],
        }),
      );
      if (
        !Array.isArray(result) ||
        (result[0] !== 0 && result[0] !== 1) ||
        typeof result[1] !== "number" ||
        !Number.isFinite(result[1]) ||
        result[1] <= 0
      ) {
        throw new Error("Invalid rate limit result.");
      }
      return {
        allowed: result[0] === 1,
        retryAfterSeconds: Math.max(1, Math.ceil(result[1] / 1000)),
      };
    } catch {
      this.unavailable();
      return null;
    }
  }

  private async getClient(): Promise<Client | null> {
    if (this.destroyed || !this.url || Date.now() < this.retryAt) return null;
    if (this.client?.isReady) return this.client;
    if (!this.connecting) {
      this.connecting = this.connect(this.url).finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private async connect(url: string): Promise<Client | null> {
    if (this.client?.isOpen) this.client.destroy();
    const client = createRateLimitClient(url);
    this.client = client;
    client.on("error", () => this.unavailable());
    try {
      await withDeadline(client.connect());
      if (this.destroyed || !client.isReady) {
        if (client.isOpen) client.destroy();
        return null;
      }
      return client;
    } catch {
      this.unavailable();
      return null;
    }
  }

  private unavailable(): void {
    if (!this.destroyed && Date.now() >= this.retryAt) {
      // No connection URL, IP, email, account identifier or exception details.
      this.logger.warn(
        "RATE_LIMIT_STORE_UNAVAILABLE: Redis retry in 30 seconds.",
      );
    }
    this.retryAt = Date.now() + 30_000;
    if (this.client?.isOpen) this.client.destroy();
    this.client = null;
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.client?.isOpen) this.client.destroy();
    this.client = null;
  }
}

// Bounded, per-process protection for local/test and resilient public routes.
// Never evict an active counter to admit a new identity: that would allow bypass.
export class MemoryRateLimitStore {
  private readonly counters = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private nextSweepAt = 0;

  constructor(private readonly capacity = 10_000) {}

  consume(
    key: string,
    window: RateLimitWindow,
    now = Date.now(),
  ): RateLimitDecision | null {
    if (now >= this.nextSweepAt) {
      for (const [id, counter] of this.counters) {
        if (counter.expiresAt <= now) this.counters.delete(id);
      }
      this.nextSweepAt = now + 1000;
    }
    let counter = this.counters.get(key);
    if (!counter || counter.expiresAt <= now) {
      if (!counter && this.counters.size >= this.capacity) return null;
      counter = { count: 0, expiresAt: now + window.seconds * 1000 };
      this.counters.set(key, counter);
    }
    const allowed = counter.count < window.limit;
    if (allowed) counter.count++;
    return {
      allowed,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((counter.expiresAt - now) / 1000),
      ),
    };
  }
}
