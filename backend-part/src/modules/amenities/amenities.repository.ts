import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";

@Injectable()
export class AmenitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<
    Array<{
      id: string;
      key: string;
      nameKm: string;
      nameEn: string;
      category: string | null;
    }>
  > {
    return this.prisma.amenity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        key: true,
        nameKm: true,
        nameEn: true,
        category: true,
      },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }
}
