import { Injectable, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";

export interface HealthResponse {
  data: {
    status: "ok";
    service: "findme-api";
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): HealthResponse {
    return {
      data: {
        status: "ok",
        service: "findme-api",
      },
    };
  }

  async getReadiness(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getLiveness();
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: "Service Unavailable",
        code: "DATABASE_UNAVAILABLE",
        message: "The database dependency is not ready.",
      });
    }
  }
}
