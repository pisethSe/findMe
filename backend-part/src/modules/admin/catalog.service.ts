import { Injectable } from "@nestjs/common";
import { PublicCacheService } from "../public-cache/public-cache.service.js";
import { CatalogRepository } from "./catalog.repository.js";
import type { AdminPageDto } from "./admin.dto.js";
import type { SaveAmenityDto, SaveInstitutionDto } from "./catalog.dto.js";
@Injectable()
export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly cache: PublicCacheService,
  ) {}
  async list(kind: "institutions" | "amenities", input: AdminPageDto) {
    const result = await this.repository.list(kind, input);
    return {
      data: result.records,
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / input.pageSize),
      },
    };
  }
  async institution(
    adminId: string,
    id: string | undefined,
    input: SaveInstitutionDto,
  ) {
    const data = await this.repository.saveInstitution(adminId, id, input);
    await this.cache.invalidateSearch();
    return { data };
  }
  async amenity(
    adminId: string,
    id: string | undefined,
    input: SaveAmenityDto,
  ) {
    const data = await this.repository.saveAmenity(adminId, id, input);
    await this.cache.invalidateSearch();
    return { data };
  }
}
