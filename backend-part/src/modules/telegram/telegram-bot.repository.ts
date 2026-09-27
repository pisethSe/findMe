import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import {
  AccountStatus,
  ListingStatus,
  ReportStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import type {
  TelegramOpenReportSummary,
  TelegramPendingListingSummary,
  TelegramSupportCounts,
} from "./telegram-bot.types.js";

const OPEN_REPORT_STATUSES = [ReportStatus.OPEN, ReportStatus.IN_REVIEW];

function hoursSince(now: Date, moment: Date): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - moment.getTime()) / 3_600_000),
  );
}

/**
 * Read-only aggregates for the administrator support bot. It selects counts and
 * moderation identifiers only: no student message, contact detail, reporter
 * identity, or credential is ever loaded for a reply.
 */
@Injectable()
export class TelegramSupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async counts(): Promise<TelegramSupportCounts> {
    const [pendingListings, openReports, publishedListings, activeLandlords] =
      await this.prisma.$transaction([
        this.prisma.listing.count({
          where: { status: ListingStatus.PENDING_REVIEW, deletedAt: null },
        }),
        this.prisma.report.count({
          where: { status: { in: OPEN_REPORT_STATUSES } },
        }),
        this.prisma.listing.count({
          where: { status: ListingStatus.PUBLISHED, deletedAt: null },
        }),
        this.prisma.user.count({
          where: {
            role: UserRole.LANDLORD,
            accountStatus: AccountStatus.ACTIVE,
            deletedAt: null,
          },
        }),
      ]);

    return { pendingListings, openReports, publishedListings, activeLandlords };
  }

  async listPending(
    limit: number,
    now: Date,
  ): Promise<TelegramPendingListingSummary[]> {
    const rows = await this.prisma.listing.findMany({
      where: { status: ListingStatus.PENDING_REVIEW, deletedAt: null },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        slug: true,
        titleKm: true,
        titleEn: true,
        updatedAt: true,
        landlord: {
          select: {
            landlordProfile: {
              select: { displayName: true, businessName: true },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.titleEn?.trim() || row.titleKm?.trim() || row.slug,
      landlordName:
        row.landlord.landlordProfile?.businessName?.trim() ||
        row.landlord.landlordProfile?.displayName?.trim() ||
        "—",
      waitingHours: hoursSince(now, row.updatedAt),
    }));
  }

  async listOpenReports(
    limit: number,
    now: Date,
  ): Promise<TelegramOpenReportSummary[]> {
    const rows = await this.prisma.report.findMany({
      where: { status: { in: OPEN_REPORT_STATUSES } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: {
        id: true,
        listingId: true,
        reason: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      reason: row.reason,
      ageHours: hoursSince(now, row.createdAt),
    }));
  }
}
