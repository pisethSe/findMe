import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { CreateReportDto } from "./reports.dto.js";
import { ReportRateLimiter } from "./report-rate-limiter.js";

@Injectable()
export class ReportsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: ReportRateLimiter,
  ) {}

  async create(reporterId: string, listingId: string, input: CreateReportDto) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Serialize each reporter across API instances; account state is authoritative.
        const users = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM users WHERE id=${reporterId}::uuid AND account_status='active'
        AND deleted_at IS NULL FOR UPDATE`);
        if (!users.length)
          throw new ForbiddenException({
            code: "REPORT_ACCOUNT_REQUIRED",
            message: "An active account is required to report a rental.",
          });
        // A retry returns the existing private receipt, even after withdrawal.
        const previous = await tx.report.findFirst({
          where: {
            reporterId,
            listingId,
            status: { in: ["OPEN", "IN_REVIEW"] },
          },
          orderBy: { createdAt: "desc" },
        });
        if (previous) return { report: previous, created: false };
        const targets = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT l.id FROM listings l JOIN properties p ON p.id=l.property_id
        JOIN users u ON u.id=l.landlord_id
        WHERE l.id=${listingId}::uuid AND l.status='published' AND l.deleted_at IS NULL
        AND l.published_at IS NOT NULL AND p.deleted_at IS NULL
        AND u.deleted_at IS NULL AND u.account_status='active'
        FOR SHARE OF l,p,u`);
        if (!targets.length)
          throw new NotFoundException({
            code: "LISTING_NOT_FOUND",
            message: "This rental is unavailable or could not be found.",
          });
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        if (!clock) throw new Error("Database clock unavailable.");
        const recent = await tx.report.findMany({
          where: {
            reporterId,
            createdAt: { gt: new Date(clock.now.getTime() - 3600000) },
          },
          select: { listingId: true, createdAt: true },
          take: 10,
        });
        if (
          (await this.limiter.isLimited(reporterId, listingId, clock.now)) ||
          recent.length >= 10 ||
          recent.some(
            (row) =>
              row.listingId === listingId &&
              row.createdAt.getTime() > clock.now.getTime() - 60000,
          )
        )
          throw new HttpException(
            {
              code: "REPORT_RATE_LIMITED",
              message:
                "You can submit up to 10 reports per hour. Wait one minute before reporting the same rental again.",
            },
            429,
          );
        const report = await tx.report.create({
          data: {
            reporterId,
            listingId,
            reason: input.reason,
            details: input.details || null,
            createdAt: clock.now,
          },
        });
        return { report, created: true };
      },
      { timeout: 10000 },
    );
    if (result.created) await this.limiter.record(reporterId, result.report);
    return result.report;
  }
}
