import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { createHash } from "node:crypto";
import { createClient } from "redis";

import { getAppEnvironment, getRedisUrl } from "../../config/environment.js";

const SEARCH_GENERATION_KEY = "findme:v1:public-search:generation";
const SEARCH_CACHE_TTL_SECONDS = 30;

function createPublicRedisClient(redisUrl: string) {
  return createClient({
    url: redisUrl,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 500,
      socketTimeout: 750,
      reconnectStrategy: false,
    },
  });
}

type RedisClient = ReturnType<typeof createPublicRedisClient>;

@Injectable()
export class PublicCacheService implements OnModuleDestroy {
  private client: RedisClient | null = null;
  private connection: Promise<RedisClient | null> | null = null;
  private readonly redisUrl = getRedisUrl(
    process.env.REDIS_URL,
    getAppEnvironment(process.env.APP_ENV),
  );

  async getSearch<T>(fingerprint: object): Promise<{
    generation: string | null;
    value: T | null;
  }> {
    const client = await this.getClient();
    if (!client) return { generation: null, value: null };

    try {
      const generation = (await client.get(SEARCH_GENERATION_KEY)) ?? "0";
      const serialized = await client.get(searchKey(generation, fingerprint));
      return {
        generation,
        value: serialized ? (JSON.parse(serialized) as T) : null,
      };
    } catch {
      this.disableClient();
      return { generation: null, value: null };
    }
  }

  async setSearch(
    generation: string | null,
    fingerprint: object,
    value: object,
  ): Promise<void> {
    if (generation === null) return;
    const client = await this.getClient();
    if (!client) return;

    try {
      await client.set(
        searchKey(generation, fingerprint),
        JSON.stringify(value),
        {
          expiration: { type: "EX", value: SEARCH_CACHE_TTL_SECONDS },
        },
      );
    } catch {
      this.disableClient();
    }
  }

  async invalidatePublishedListing(input: {
    id: string;
    slug: string;
  }): Promise<void> {
    await this.invalidatePublishedListings([input]);
  }

  async invalidatePublishedListings(
    inputs: readonly { id: string; slug: string }[],
  ): Promise<void> {
    if (inputs.length === 0) return;
    const client = await this.getClient();
    if (!client) return;

    try {
      const listingKeys = inputs.flatMap((input) => [
        `findme:v1:public-listing:id:${input.id}`,
        `findme:v1:public-listing:slug:${input.slug}`,
      ]);
      await client.multi().incr(SEARCH_GENERATION_KEY).del(listingKeys).exec();
    } catch {
      this.disableClient();
    }
  }

  async onModuleDestroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connection = null;
    if (client?.isOpen) client.destroy();
  }

  private async getClient(): Promise<RedisClient | null> {
    const redisUrl = this.redisUrl;
    if (!redisUrl) return null;
    if (this.client?.isReady) return this.client;
    if (this.connection) return this.connection;

    this.connection = this.connect(redisUrl);
    return this.connection;
  }

  private async connect(redisUrl: string): Promise<RedisClient | null> {
    const client = createPublicRedisClient(redisUrl);
    client.on("error", () => undefined);

    try {
      await client.connect();
      this.client = client;
      return client;
    } catch {
      client.destroy();
      this.connection = null;
      return null;
    }
  }

  private disableClient(): void {
    if (this.client?.isOpen) this.client.destroy();
    this.client = null;
    this.connection = null;
  }
}

function searchKey(generation: string, fingerprint: object): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex");
  return `findme:v1:public-search:${generation}:${hash}`;
}
