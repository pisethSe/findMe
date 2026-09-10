import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import { adminPendingListingSelect } from "../moderation/moderation.repository.js";
import type {
  AdminListingsQueryDto,
  AdminPageDto,
  AdminReportsQueryDto,
  RemoveListingDto,
  UpdateReportDto,
} from "./admin.dto.js";

const userSelect = {
  id: true,
  role: true,
  accountStatus: true,
  createdAt: true,
  studentProfile: { select: { displayName: true } },
  landlordProfile: { select: { displayName: true } },
} as const;
const reportSelect = {
  id: true,
  reason: true,
  details: true,
  status: true,
  resolutionNote: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  listing: {
    select: {
      id: true,
      slug: true,
      titleEn: true,
      titleKm: true,
      status: true,
      landlordId: true,
    },
  },
} as const;
export function moderationConflict() {
  return new ConflictException({
    code: "ADMIN_STATE_CONFLICT",
    message: "This record changed. Refresh and review it again.",
  });
}
export async function requireAdmin(
  tx: Prisma.TransactionClient,
  adminId: string,
) {
  const users = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM users WHERE id=${adminId}::uuid AND role='admin' AND account_status='active' AND deleted_at IS NULL FOR SHARE`,
  );
  if (!users.length)
    throw new ForbiddenException({
      code: "ROLE_FORBIDDEN",
      message: "Active administrator access is required.",
    });
}
export function assertReportTransition(
  current: string,
  expected: string,
  next: string,
) {
  if (
    current !== expected ||
    !["OPEN", "IN_REVIEW"].includes(current) ||
    !["IN_REVIEW", "RESOLVED", "DISMISSED"].includes(next)
  )
    throw moderationConflict();
}
@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}
  listReports(input: AdminReportsQueryDto) {
    const where = { status: input.status };
    return this.prisma.$transaction(
      async (tx) => ({
        records: await tx.report.findMany({
          where,
          select: reportSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        total: await tx.report.count({ where }),
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async updateReport(adminId: string, id: string, input: UpdateReportDto) {
    return this.prisma.$transaction(async (tx) => {
      await requireAdmin(tx, adminId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM reports WHERE id=${id}::uuid FOR UPDATE`,
      );
      const current = await tx.report.findUnique({ where: { id } });
      if (!current)
        throw new NotFoundException({
          code: "REPORT_NOT_FOUND",
          message: "Report not found.",
        });
      if (
        current.status === input.status &&
        current.resolutionNote === input.note
      )
        return tx.report.findUniqueOrThrow({
          where: { id },
          select: reportSelect,
        });
      assertReportTransition(
        current.status,
        input.expectedStatus,
        input.status,
      );
      const terminal = input.status !== "IN_REVIEW";
      const row = await tx.report.update({
        where: { id },
        data: {
          status: input.status,
          resolutionNote: input.note,
          resolvedById: terminal ? adminId : null,
          resolvedAt: terminal ? new Date() : null,
          updatedAt: new Date(),
        },
        select: reportSelect,
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: "REPORT_REVIEWED",
          entityType: "Report",
          entityId: id,
          metadata: {
            previousStatus: current.status,
            nextStatus: input.status,
          },
        },
      });
      return row;
    });
  }
  listUsers(input: AdminPageDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(input.query
        ? {
            OR: [
              {
                studentProfile: {
                  displayName: { contains: input.query, mode: "insensitive" },
                },
              },
              {
                landlordProfile: {
                  displayName: { contains: input.query, mode: "insensitive" },
                },
              },
              ...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                input.query,
              )
                ? [{ id: input.query }]
                : []),
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => ({
        records: await tx.user.findMany({
          where,
          select: userSelect,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        total: await tx.user.count({ where }),
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async setUserStatus(
    adminId: string,
    id: string,
    status: "ACTIVE" | "SUSPENDED",
    note: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await requireAdmin(tx, adminId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`,
      );
      const user = await tx.user.findUnique({ where: { id } });
      if (!user || user.deletedAt || user.accountStatus === "DELETED")
        throw new NotFoundException({
          code: "USER_NOT_FOUND",
          message: "User not found.",
        });
      if (id === adminId || user.role === "ADMIN")
        throw new ForbiddenException({
          code: "ADMIN_ACCOUNT_PROTECTED",
          message:
            "Administrator accounts require a privileged account-management process.",
        });
      const listings = await tx.listing.findMany({
        where: { landlordId: id, status: "PUBLISHED", deletedAt: null },
        select: { id: true, slug: true },
      });
      if (user.accountStatus !== status) {
        await tx.user.update({
          where: { id },
          data: { accountStatus: status, updatedAt: new Date() },
        });
        if (status === "SUSPENDED") {
          await tx.refreshSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await tx.listing.updateMany({
            where: { landlordId: id, status: "PUBLISHED", deletedAt: null },
            data: {
              status: "PAUSED",
              moderationNote: note,
              updatedAt: new Date(),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action:
              status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
            entityType: "User",
            entityId: id,
            metadata: {
              note,
              previousStatus: user.accountStatus,
              nextStatus: status,
            },
          },
        });
      }
      return {
        user: await tx.user.findUniqueOrThrow({
          where: { id },
          select: userSelect,
        }),
        listings,
      };
    });
  }
  listListings(input: AdminListingsQueryDto) {
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.query
        ? {
            OR: [
              { titleEn: { contains: input.query, mode: "insensitive" } },
              { titleKm: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => ({
        records: await tx.listing.findMany({
          where,
          select: adminPendingListingSelect,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        total: await tx.listing.count({ where }),
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async findListing(id: string) {
    const row = await this.prisma.listing.findFirst({
      where: { id },
      select: adminPendingListingSelect,
    });
    if (!row)
      throw new NotFoundException({
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      });
    return row;
  }
  async removeListing(
    adminId: string,
    id: string,
    status: "PAUSED" | "ARCHIVED",
    input: RemoveListingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await requireAdmin(tx, adminId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM listings WHERE id=${id}::uuid FOR UPDATE`,
      );
      const row = await tx.listing.findUnique({ where: { id } });
      if (!row || row.deletedAt)
        throw new NotFoundException({
          code: "LISTING_NOT_FOUND",
          message: "Listing not found.",
        });
      if (row.status !== status) {
        if (
          row.status !== input.expectedStatus ||
          row.status === "ARCHIVED" ||
          (status === "PAUSED" && row.status !== "PUBLISHED")
        )
          throw moderationConflict();
        await tx.listing.update({
          where: { id },
          data: { status, moderationNote: input.note, updatedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action:
              status === "PAUSED"
                ? "LISTING_PAUSED_BY_ADMIN"
                : "LISTING_ARCHIVED_BY_ADMIN",
            entityType: "Listing",
            entityId: id,
            metadata: {
              note: input.note,
              previousStatus: row.status,
              nextStatus: status,
            },
          },
        });
      }
      return tx.listing.findUniqueOrThrow({
        where: { id },
        select: adminPendingListingSelect,
      });
    });
  }
}
