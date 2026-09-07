import type {
  InstitutionDto,
  PublicListingDetailDto,
  PublicListingDto,
  PublicListingSearchPage,
} from "@findme/contracts";

export const institution: InstitutionDto = {
  id: "a77388a1-a003-4c84-9ce9-cc2eaf801dea",
  slug: "royal-university-of-phnom-penh",
  nameEn: "Royal University of Phnom Penh, Faculty of Science and Engineering",
  nameKm: "សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ មហាវិទ្យាល័យវិទ្យាសាស្ត្រនិងវិស្វកម្ម",
  shortName: null,
  type: "UNIVERSITY",
  city: "Phnom Penh",
  latitude: 11.5683,
  longitude: 104.8908,
};

export const englishTitle =
  "A quiet furnished student room near the university with a private balcony and space to study";
export const khmerTitle =
  "បន្ទប់ជួលសម្រាប់និស្សិតនៅជិតសាកលវិទ្យាល័យមានបន្ទប់ទឹកផ្ទាល់ខ្លួននិងកន្លែងសម្រាប់សិក្សា";

export const listings: readonly PublicListingDto[] = [
  {
    id: "4f981334-aed1-4f56-bc64-35c51c563906",
    slug: "quiet-room-near-university",
    titleEn: englishTitle,
    titleKm: khmerTitle,
    propertyType: "ROOM",
    monthlyPrice: 120,
    currency: "USD",
    availableUnits: 1,
    availableFrom: null,
    availabilityConfirmedAt: "2026-09-05T00:00:00Z",
    publishedAt: "2026-09-04T00:00:00Z",
    distanceMeters: 850,
    location: {
      commune: "Sangkat Teuk Laak, near the northern university entrance",
      district: "Toul Kork",
      city: "Phnom Penh",
      latitude: 11.57,
      longitude: 104.89,
    },
    amenities: [
      {
        id: "wifi",
        key: "wifi",
        nameEn: "Internet connection included in monthly rent",
        nameKm: "មានអ៊ីនធឺណិតសម្រាប់ការសិក្សា",
        category: "Facilities",
      },
    ],
    primaryImage: {
      id: "photo-1",
      publicUrl: "https://images.example.test/room-1.png",
      altTextEn: "Student room with a desk and balcony",
      altTextKm: null,
      width: 800,
      height: 600,
      sortOrder: 0,
    },
  },
  {
    id: "b45c8a91-1669-4b93-9e17-2e28816d46f2",
    slug: "khmer-student-room",
    titleEn: null,
    titleKm: khmerTitle,
    propertyType: "OTHER_STUDENT_RENTAL",
    monthlyPrice: 400000,
    currency: "KHR",
    availableUnits: 2,
    availableFrom: null,
    availabilityConfirmedAt: "2026-09-05T00:00:00Z",
    publishedAt: "2026-09-04T00:00:00Z",
    distanceMeters: 1200,
    location: {
      commune: "ទឹកល្អក់",
      district: "ទួលគោក",
      city: "Phnom Penh",
      latitude: 11.571,
      longitude: 104.891,
    },
    amenities: [],
    primaryImage: null,
  },
];

const firstListing = listings[0];
if (!firstListing?.primaryImage)
  throw new Error("A fixture photo is required.");

export const rental: PublicListingDetailDto = {
  ...firstListing,
  descriptionEn:
    "A student room with study space, a private balcony and nearby shops. Contact the landlord to confirm utility costs and viewing times. ".repeat(
      3,
    ),
  descriptionKm: khmerTitle.repeat(4),
  depositAmount: 120,
  utilityNotesEn: "Electricity is metered separately. Water is included.",
  utilityNotesKm: null,
  houseRulesEn: "Quiet hours begin at 10 pm. Ask about visitor arrangements.",
  houseRulesKm: null,
  bedrooms: 1,
  bathrooms: 1,
  furnished: true,
  updatedAt: "2026-09-05T01:00:00Z",
  institution,
  location: {
    ...firstListing.location,
    addressLine:
      "Street 138, near the northern university entrance, Phnom Penh",
  },
  images: [
    firstListing.primaryImage,
    {
      ...firstListing.primaryImage,
      id: "photo-2",
      publicUrl: "https://images.example.test/room-2.png",
      altTextEn: "Private balcony outside the student room",
      sortOrder: 1,
    },
  ],
  contact: {
    preference: "PHONE",
    displayName: "University neighbourhood student rental contact",
    phone: "+85512345678",
    telegram: null,
  },
};

export function searchPage(params: URLSearchParams): PublicListingSearchPage {
  const empty = params.get("maxPrice") === "1";
  const page = Number(params.get("page") ?? 1);
  const viewport = params.has("north")
    ? {
        north: Number(params.get("north")),
        south: Number(params.get("south")),
        east: Number(params.get("east")),
        west: Number(params.get("west")),
      }
    : null;
  return {
    data: empty ? [] : listings,
    meta: {
      page,
      pageSize: 50,
      total: empty ? 0 : page > 1 ? 52 : listings.length,
      totalPages: empty ? 0 : page > 1 ? 2 : 1,
      institution,
      radiusMeters: Number(params.get("radiusMeters") ?? 3000),
      viewport,
      filters: {
        minPrice: null,
        maxPrice: Number(params.get("maxPrice") ?? 300),
        currency: "USD",
        propertyTypes:
          params.get("propertyType") === "STUDIO" ? ["STUDIO"] : [],
        amenities: [],
        availableBy: "2026-09-06",
      },
      sort: "distance",
      refreshedAt: "2026-09-06T00:00:00Z",
      cacheGeneration: "responsive-test",
    },
  };
}
