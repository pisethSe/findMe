import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { requireAdmin } from "./admin.repository.js";
import type { AdminPageDto } from "./admin.dto.js";
import type { SaveAmenityDto, SaveInstitutionDto } from "./catalog.dto.js";
const institutionSelect = {
  id: true,
  slug: true,
  nameKm: true,
  nameEn: true,
  type: true,
  addressEn: true,
  city: true,
  latitude: true,
  longitude: true,
  isActive: true,
} as const;
const amenitySelect = {
  id: true,
  key: true,
  nameKm: true,
  nameEn: true,
  category: true,
  sortOrder: true,
  isActive: true,
} as const;
@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(kind: "institutions" | "amenities", input: AdminPageDto) {
    const where = input.query
      ? {
          OR: [
            { nameEn: { contains: input.query, mode: "insensitive" as const } },
            { nameKm: { contains: input.query, mode: "insensitive" as const } },
          ],
        }
      : {};
    return this.prisma.$transaction(
      async (tx) =>
        kind === "institutions"
          ? {
              records: (
                await tx.institution.findMany({
                  where,
                  select: institutionSelect,
                  orderBy: [{ nameEn: "asc" }, { id: "asc" }],
                  skip: (input.page - 1) * input.pageSize,
                  take: input.pageSize,
                })
              ).map((row) => ({
                ...row,
                latitude: Number(row.latitude),
                longitude: Number(row.longitude),
              })),
              total: await tx.institution.count({ where }),
            }
          : {
              records: await tx.amenity.findMany({
                where,
                select: amenitySelect,
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                skip: (input.page - 1) * input.pageSize,
                take: input.pageSize,
              }),
              total: await tx.amenity.count({ where }),
            },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async saveInstitution(
    adminId: string,
    id: string | undefined,
    input: SaveInstitutionDto,
  ) {
    return this.save(
      async (tx) => {
        const row = id
          ? await tx.institution.update({
              where: { id },
              data: { ...input, updatedAt: new Date() },
              select: institutionSelect,
            })
          : await tx.institution.create({
              data: input,
              select: institutionSelect,
            });
        return {
          ...row,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        };
      },
      adminId,
      "Institution",
      id,
    );
  }
  async saveAmenity(
    adminId: string,
    id: string | undefined,
    input: SaveAmenityDto,
  ) {
    return this.save(
      (tx) =>
        id
          ? tx.amenity.update({
              where: { id },
              data: input,
              select: amenitySelect,
            })
          : tx.amenity.create({ data: input, select: amenitySelect }),
      adminId,
      "Amenity",
      id,
    );
  }
  private async save<T extends { id: string }>(
    write: (tx: Prisma.TransactionClient) => Promise<T>,
    adminId: string,
    kind: string,
    id: string | undefined,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await requireAdmin(tx, adminId);
        const row = await write(tx);
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: `${kind.toUpperCase()}_${id ? "UPDATED" : "CREATED"}`,
            entityType: kind,
            entityId: row.id,
            metadata: {},
          },
        });
        return row;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002")
          throw new ConflictException({
            code: "CATALOG_KEY_CONFLICT",
            message: "That slug or key is already in use.",
          });
        if (error.code === "P2025")
          throw new NotFoundException({
            code: "CATALOG_NOT_FOUND",
            message: "Catalog record not found.",
          });
      }
      throw error;
    }
  }
}
