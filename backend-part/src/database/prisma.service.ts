import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { getDatabaseUrl } from "../config/environment.js";
import { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    // Pin the database session to UTC. Timestamp columns are `timestamptz`,
    // and the driver adapter otherwise reinterprets them in the server's local
    // zone, shifting availability/freshness windows by the server offset.
    const adapter = new PrismaPg({
      connectionString: getDatabaseUrl(process.env.DATABASE_URL),
      options: "-c timezone=UTC",
    });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
