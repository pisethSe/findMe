import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AccessPrincipal } from "../auth/auth.types.js";
import type {
  CreateInquiryDto,
  UpdateInquiryStatusDto,
} from "./dto/inquiry-mutations.dto.js";

import type { ListLandlordInquiriesDto } from "./dto/list-landlord-inquiries.dto.js";
import { InquiriesRepository } from "./inquiries.repository.js";
import type {
  LandlordInquiryDto,
  LandlordInquiryRecord,
} from "./inquiries.types.js";

@Injectable()
export class InquiriesService {
  constructor(private readonly repository: InquiriesRepository) {}

  async create(
    user: AccessPrincipal,
    listingId: string,
    input: CreateInquiryDto,
  ) {
    this.requireStudent(user);
    return {
      data: toStudentInquiryDto(
        await this.repository.create(user.id, listingId, input),
      ),
    };
  }

  async listForStudent(user: AccessPrincipal, query: ListLandlordInquiriesDto) {
    this.requireStudent(user);
    const result = await this.repository.listForStudent(user.id, query);
    return {
      data: result.records.map(toStudentInquiryDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async updateStatus(
    landlordId: string,
    id: string,
    input: UpdateInquiryStatusDto,
  ) {
    return {
      data: toLandlordInquiryDto(
        await this.repository.updateStatus(landlordId, id, input.status),
      ),
    };
  }

  private requireStudent(user: AccessPrincipal) {
    if (user.role !== "STUDENT" || !user.onboardingComplete)
      throw new ForbiddenException({
        code: "STUDENT_ONBOARDING_REQUIRED",
        message: "Complete your student account before sending an inquiry.",
      });
  }

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

function toStudentInquiryDto(
  row: Awaited<ReturnType<InquiriesRepository["create"]>>,
) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
