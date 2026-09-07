import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createClient } from "redis";
import { getAppEnvironment, getRedisUrl } from "../../config/environment.js";

const READ_LIMIT = `
local now=tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now-3600000)
if redis.call('ZCARD',KEYS[1])>=10 then return 1 end
local recent=redis.call('ZRANGEBYSCORE',KEYS[1],'('..(now-60000),'+inf')
for _,member in ipairs(recent) do
  if string.sub(member,-36)==ARGV[2] then return 1 end
end
return 0`;

function newClient(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 500,
      socketTimeout: 750,
      reconnectStrategy: false,
    },
  });
}
type Client = ReturnType<typeof newClient>;

@Injectable()
export class InquiryRateLimiter implements OnModuleDestroy {
  private client: Client | null = null;
  private connecting: Promise<Client | null> | null = null;
  private retryAt = 0;
  private readonly url = getRedisUrl(
    process.env.REDIS_URL,
    getAppEnvironment(process.env.APP_ENV),
  );

  async isLimited(
    studentId: string,
    listingId: string,
    now: Date,
  ): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false; // PostgreSQL checks the same limits under a lock.
    try {
      return (
        (await client.eval(READ_LIMIT, {
          keys: [this.key(studentId)],
          arguments: [String(now.getTime()), listingId],
        })) === 1
      );
    } catch {
      this.disable();
      return false;
    }
  }

  async record(
    studentId: string,
    inquiry: { id: string; listingId: string; createdAt: Date },
  ): Promise<void> {
    const client = await this.getClient();
    if (!client) return;
    try {
      await client
        .multi()
        .zAdd(this.key(studentId), {
          score: inquiry.createdAt.getTime(),
          value: `${inquiry.id}:${inquiry.listingId}`,
        })
        .expire(this.key(studentId), 3600)
        .exec();
    } catch {
      this.disable();
    } // Committed PostgreSQL inquiries stay authoritative.
  }

  private key(studentId: string) {
    return `findme:v1:inquiry-limit:${studentId}`;
  }
  private async getClient(): Promise<Client | null> {
    if (!this.url || Date.now() < this.retryAt) return null;
    if (this.client?.isReady) return this.client;
    if (!this.connecting)
      this.connecting = this.connect(this.url).finally(() => {
        this.connecting = null;
      });
    return this.connecting;
  }
  private async connect(url: string): Promise<Client | null> {
    const client = newClient(url);
    client.on("error", () => {
      this.retryAt = Date.now() + 30000;
    });
    try {
      await client.connect();
      this.client = client;
      return client;
    } catch {
      if (client.isOpen) client.destroy();
      this.retryAt = Date.now() + 30000;
      return null;
    }
  }
  private disable() {
    if (this.client?.isOpen) this.client.destroy();
    this.client = null;
    this.retryAt = Date.now() + 30000;
  }
  onModuleDestroy() {
    this.disable();
  }
}
