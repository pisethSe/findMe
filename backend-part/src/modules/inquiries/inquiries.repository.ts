import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  CreateInquiryDto,
  UpdateInquiryStatusDto,
} from "./dto/inquiry-mutations.dto.js";
import {
  assertInquiryRateLimit,
  assertInquiryTransition,
  inquiryRateLimitError,
  INQUIRY_HOUR_MS,
} from "./inquiry-policy.js";
import { InquiryRateLimiter } from "./inquiry-rate-limiter.js";
import { recordAnalyticsEvent } from "../analytics/analytics.events.js";

const coreSelect = {
  id: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
const landlordSelect = {
  ...coreSelect,
  student: { select: { studentProfile: { select: { displayName: true } } } },
  listing: {
    select: {
      id: true,
      titleKm: true,
      titleEn: true,
      property: { select: { name: true } },
    },
  },
} satisfies Prisma.InquirySelect;
const publicListingWhere = {
  status: "PUBLISHED",
  deletedAt: null,
  availableUnits: { gt: 0 },
  publishedAt: { not: null },
  availabilityConfirmedAt: { not: null },
  property: { deletedAt: null },
  landlord: { deletedAt: null, accountStatus: "ACTIVE" },
} satisfies Prisma.ListingWhereInput;
type PageInput = { page: number; pageSize: number };

@Injectable()
export class InquiriesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: InquiryRateLimiter,
  ) {}

  async listForLandlord(landlordId: string, input: PageInput) {
    return this.prisma.$transaction(
      async (tx) => ({
        records: await tx.inquiry.findMany({
          where: { landlordId },
          select: landlordSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        total: await tx.inquiry.count({ where: { landlordId } }),
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async listForStudent(studentId: string, input: PageInput) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.inquiry.findMany({
          where: { studentId },
          select: { ...coreSelect, listingId: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        });
        const listings = await tx.listing.findMany({
          where: {
            ...publicListingWhere,
            id: { in: rows.map((row) => row.listingId) },
          },
          select: { id: true, slug: true, titleKm: true, titleEn: true },
        });
        const byId = new Map(listings.map((listing) => [listing.id, listing]));
        return {
          records: rows.map(({ listingId, ...row }) => ({
            ...row,
            listing: byId.get(listingId) ?? null,
          })),
          total: await tx.inquiry.count({ where: { studentId } }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async create(studentId: string, listingId: string, input: CreateInquiryDto) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        // Serialize sends across API processes and recheck the account under lock.
        const students = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM users WHERE id=${studentId}::uuid AND role='student' AND account_status='active' AND deleted_at IS NULL AND onboarding_completed_at IS NOT NULL FOR UPDATE`,
        );
        if (!students.length)
          throw new ForbiddenException({
            code: "STUDENT_ONBOARDING_REQUIRED",
            message: "Complete your student account before sending an inquiry.",
          });
        const previous = await tx.inquiry.findUnique({
          where: {
            studentId_clientRequestId: {
              studentId,
              clientRequestId: input.clientRequestId,
            },
          },
        });
        if (previous) {
          if (
            previous.listingId !== listingId ||
            previous.message !== input.message
          )
            throw new ConflictException({
              code: "INQUIRY_REQUEST_CONFLICT",
              message:
                "This request was already used for a different inquiry. Check your sent inquiries.",
            });
          return { inquiry: previous, created: false };
        }
        // Keep target eligibility stable until insertion, including owner/property.
        const targets = await tx.$queryRaw<{ landlordId: string }[]>(Prisma.sql`
        SELECT l.landlord_id AS "landlordId" FROM listings l
        JOIN properties p ON p.id=l.property_id JOIN users u ON u.id=l.landlord_id
        WHERE l.id=${listingId}::uuid AND l.status='published' AND l.deleted_at IS NULL
          AND l.available_units>0 AND l.published_at IS NOT NULL AND l.availability_confirmed_at IS NOT NULL
          AND p.deleted_at IS NULL AND u.deleted_at IS NULL AND u.account_status='active'
        FOR SHARE OF l,p,u`);
        const target = targets[0];
        if (!target)
          throw new NotFoundException({
            code: "LISTING_NOT_FOUND",
            message: "This rental is unavailable or could not be found.",
          });
        const [clock] = await tx.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        if (!clock) throw new Error("Database clock unavailable.");
        if (await this.limiter.isLimited(studentId, listingId, clock.now))
          throw inquiryRateLimitError();
        const recent = await tx.inquiry.findMany({
          where: {
            studentId,
            createdAt: { gt: new Date(clock.now.getTime() - INQUIRY_HOUR_MS) },
          },
          select: { listingId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        assertInquiryRateLimit(recent, listingId, clock.now);
        const inquiry = await tx.inquiry.create({
          data: {
            studentId,
            listingId,
            landlordId: target.landlordId,
            message: input.message,
            clientRequestId: input.clientRequestId,
            createdAt: clock.now,
          },
        });
        await recordAnalyticsEvent(tx, "INQUIRY_CREATED");
        return { inquiry, created: true };
      },
      { timeout: 10000 },
    );
    if (result.created) await this.limiter.record(studentId, result.inquiry);
    // Replay may follow withdrawal: use the same private history projection.
    const listing = await this.prisma.listing.findFirst({
      where: { ...publicListingWhere, id: listingId },
      select: { id: true, slug: true, titleKm: true, titleEn: true },
    });
    const row = result.inquiry;
    return {
      id: row.id,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      listing,
    };
  }

  async updateStatus(
    landlordId: string,
    id: string,
    status: UpdateInquiryStatusDto["status"],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM inquiries WHERE id=${id}::uuid AND landlord_id=${landlordId}::uuid FOR UPDATE`,
      );
      if (!rows.length)
        throw new NotFoundException({
          code: "INQUIRY_NOT_FOUND",
          message: "This inquiry could not be found.",
        });
      const existing = await tx.inquiry.findUniqueOrThrow({ where: { id } });
      assertInquiryTransition(existing.status, status);
      if (existing.status !== status) {
        const now = new Date();
        await tx.inquiry.update({
          where: { id },
          data: {
            status,
            ...(status === "READ" || status === "RESPONDED"
              ? { readAt: existing.readAt ?? now }
              : {}),
            ...(status === "RESPONDED" ? { respondedAt: now } : {}),
            ...(status === "CLOSED" ? { closedAt: now } : {}),
          },
        });
      }
      return tx.inquiry.findUniqueOrThrow({
        where: { id },
        select: landlordSelect,
      });
    });
  }
}
