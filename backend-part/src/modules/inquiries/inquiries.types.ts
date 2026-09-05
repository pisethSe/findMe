import type { InquiryStatus } from "../../generated/prisma/client.js";

export interface LandlordInquiryRecord {
  id: string;
  message: string;
  status: InquiryStatus;
  createdAt: Date;
  updatedAt: Date;
  student: {
    studentProfile: { displayName: string } | null;
  };
  listing: {
    id: string;
    titleKm: string | null;
    titleEn: string | null;
    property: { name: string };
  };
}

export interface LandlordInquiryDto {
  id: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
  student: {
    displayName: string;
  };
  listing: {
    id: string;
    titleKm: string | null;
    titleEn: string | null;
    propertyName: string;
  };
}
