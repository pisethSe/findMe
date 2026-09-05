import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../database/prisma.service.js";
import type { LandlordInquiryRecord } from "./inquiries.types.js";

const landlordInquirySelect = {
  id: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  student: {
    select: {
      studentProfile: { select: { displayName: true } },
    },
  },
  listing: {
    select: {
      id: true,
      titleKm: true,
      titleEn: true,
      property: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class InquiriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForLandlord(
    landlordId: string,
    input: { page: number; pageSize: number },
  ): Promise<{ records: LandlordInquiryRecord[]; total: number }> {
    const where = { landlordId };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.inquiry.findMany({
        where,
        select: landlordInquirySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.inquiry.count({ where }),
    ]);
    return { records, total };
  }
}
