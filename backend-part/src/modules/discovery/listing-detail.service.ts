import { Injectable, NotFoundException } from "@nestjs/common";

import { DiscoveryRepository } from "./discovery.repository.js";
import {
  ListingDetailRepository,
  type PublicDetailRecord,
} from "./listing-detail.repository.js";

@Injectable()
export class ListingDetailService {
  constructor(
    private readonly repository: ListingDetailRepository,
    private readonly discovery: DiscoveryRepository,
  ) {}

  async detail(slug: string, institutionId?: string) {
    const record = await this.repository.findPublic(slug, institutionId);
    if (!record) {
      throw new NotFoundException({
        code: "LISTING_NOT_FOUND",
        message: "This rental is unavailable or could not be found.",
      });
    }
    const institution = institutionId
      ? await this.discovery.findInstitution(institutionId)
      : null;
    if (institutionId && (!institution || record.distanceMeters === null)) {
      throw new NotFoundException({
        code: "INSTITUTION_NOT_FOUND",
        message: "The selected institution could not be found.",
      });
    }
    return {
      data: {
        ...serializePublicDetail(record),
        institution: institution
          ? {
              id: institution.id,
              slug: institution.slug,
              nameKm: institution.nameKm,
              nameEn: institution.nameEn,
              shortName: institution.shortName,
              type: institution.type,
              city: institution.city,
              latitude: Number(institution.latitude),
              longitude: Number(institution.longitude),
            }
          : null,
      },
    };
  }
}

export function serializePublicDetail({
  listing: l,
  distanceMeters,
}: PublicDetailRecord) {
  const profile = l.landlord.landlordProfile;
  // Only explicitly permitted channels are public, never the owner's account.
  const phone = ["PHONE", "PHONE_OR_TELEGRAM"].includes(l.contactPreference)
    ? (profile?.contactPhone ?? null)
    : null;
  const telegram = ["TELEGRAM", "PHONE_OR_TELEGRAM"].includes(
    l.contactPreference,
  )
    ? (profile?.contactTelegram ?? null)
    : null;
  return {
    id: l.id,
    slug: l.slug,
    titleKm: l.titleKm,
    titleEn: l.titleEn,
    descriptionKm: l.descriptionKm,
    descriptionEn: l.descriptionEn,
    propertyType: l.propertyType,
    monthlyPrice: Number(l.monthlyPrice),
    currency: l.currency,
    depositAmount: l.depositAmount === null ? null : Number(l.depositAmount),
    utilityNotesKm: l.utilityNotesKm,
    utilityNotesEn: l.utilityNotesEn,
    houseRulesKm: l.houseRulesKm,
    houseRulesEn: l.houseRulesEn,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    furnished: l.furnished,
    availableUnits: l.availableUnits,
    availableFrom: l.availableFrom?.toISOString().slice(0, 10) ?? null,
    availabilityConfirmedAt: l.availabilityConfirmedAt?.toISOString() ?? null,
    publishedAt: l.publishedAt?.toISOString() ?? null,
    updatedAt: l.updatedAt.toISOString(),
    distanceMeters,
    location: {
      addressLine: l.property.addressLine,
      commune: l.property.commune,
      district: l.property.district,
      city: l.property.city,
      latitude: Number(l.property.latitude),
      longitude: Number(l.property.longitude),
    },
    amenities: l.amenities.map(({ amenity }) => ({ ...amenity })),
    images: l.images.map((image) => ({ ...image })),
    contact: {
      preference: l.contactPreference,
      displayName: profile?.displayName ?? null,
      phone,
      telegram,
    },
  };
}
