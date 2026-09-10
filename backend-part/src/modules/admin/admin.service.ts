import { Injectable } from "@nestjs/common";
import { PublicCacheService } from "../public-cache/public-cache.service.js";
import { toAdminListingDto } from "../moderation/moderation.service.js";
import { AdminRepository } from "./admin.repository.js";
import type {
  AdminListingsQueryDto,
  AdminPageDto,
  AdminReportsQueryDto,
  RemoveListingDto,
  UpdateReportDto,
} from "./admin.dto.js";
function page<T>(records: T[], total: number, input: AdminPageDto) {
  return {
    data: records,
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    },
  };
}
function reportDto(row: Awaited<ReturnType<AdminRepository["updateReport"]>>) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
function userDto(
  row: Awaited<ReturnType<AdminRepository["setUserStatus"]>>["user"],
) {
  return {
    id: row.id,
    role: row.role,
    accountStatus: row.accountStatus,
    displayName:
      row.studentProfile?.displayName ??
      row.landlordProfile?.displayName ??
      "Account without a profile",
    createdAt: row.createdAt.toISOString(),
  };
}
@Injectable()
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly cache: PublicCacheService,
  ) {}
  async reports(input: AdminReportsQueryDto) {
    const result = await this.repository.listReports(input);
    return page(result.records.map(reportDto), result.total, input);
  }
  async updateReport(adminId: string, id: string, input: UpdateReportDto) {
    return {
      data: reportDto(await this.repository.updateReport(adminId, id, input)),
    };
  }
  async users(input: AdminPageDto) {
    const result = await this.repository.listUsers(input);
    return page(result.records.map(userDto), result.total, input);
  }
  async setUserStatus(
    adminId: string,
    id: string,
    status: "ACTIVE" | "SUSPENDED",
    note: string,
  ) {
    const result = await this.repository.setUserStatus(
      adminId,
      id,
      status,
      note,
    );
    await this.cache.invalidatePublishedListings(result.listings);
    return { data: userDto(result.user) };
  }
  async listings(input: AdminListingsQueryDto) {
    const result = await this.repository.listListings(input);
    return page(result.records.map(toAdminListingDto), result.total, input);
  }
  async listing(id: string) {
    return { data: toAdminListingDto(await this.repository.findListing(id)) };
  }
  async removeListing(
    adminId: string,
    id: string,
    status: "PAUSED" | "ARCHIVED",
    input: RemoveListingDto,
  ) {
    const row = await this.repository.removeListing(adminId, id, status, input);
    await this.cache.invalidatePublishedListing(row);
    return { data: toAdminListingDto(row) };
  }
}
