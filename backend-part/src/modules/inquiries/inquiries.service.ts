import { Injectable } from "@nestjs/common";

import type { ListLandlordInquiriesDto } from "./dto/list-landlord-inquiries.dto.js";
import { InquiriesRepository } from "./inquiries.repository.js";
import type {
  LandlordInquiryDto,
  LandlordInquiryRecord,
} from "./inquiries.types.js";

@Injectable()
export class InquiriesService {
  constructor(private readonly repository: InquiriesRepository) {}

  async listForLandlord(
    landlordId: string,
    query: ListLandlordInquiriesDto,
  ): Promise<{
    data: LandlordInquiryDto[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const result = await this.repository.listForLandlord(landlordId, query);
    return {
      data: result.records.map(toLandlordInquiryDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
}

export function toLandlordInquiryDto(
  inquiry: LandlordInquiryRecord,
): LandlordInquiryDto {
  return {
    id: inquiry.id,
    message: inquiry.message,
    status: inquiry.status,
    createdAt: inquiry.createdAt.toISOString(),
    updatedAt: inquiry.updatedAt.toISOString(),
    student: {
      displayName: inquiry.student.studentProfile?.displayName ?? "Student",
    },
    listing: {
      id: inquiry.listing.id,
      titleKm: inquiry.listing.titleKm,
      titleEn: inquiry.listing.titleEn,
      propertyName: inquiry.listing.property.name,
    },
  };
}
