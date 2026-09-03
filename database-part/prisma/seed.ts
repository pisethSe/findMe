import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../backend-part/src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL_UNPOOLED?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const institutions = [
  {
    slug: "royal-university-of-phnom-penh",
    nameKm: "សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ",
    nameEn: "Royal University of Phnom Penh",
    shortName: "RUPP",
    type: "UNIVERSITY" as const,
    addressKm: "មហាវិថីសហព័ន្ធរុស្ស៊ី ខណ្ឌទួលគោក រាជធានីភ្នំពេញ",
    addressEn: "Russian Federation Boulevard, Tuol Kork, Phnom Penh",
    latitude: 11.569,
    longitude: 104.8914,
  },
  {
    slug: "institute-of-technology-of-cambodia",
    nameKm: "វិទ្យាស្ថានបច្ចេកវិទ្យាកម្ពុជា",
    nameEn: "Institute of Technology of Cambodia",
    shortName: "ITC",
    type: "UNIVERSITY" as const,
    addressKm:
      "មហាវិថីសហព័ន្ធរុស្ស៊ី សង្កាត់ទឹកល្អក់១ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ",
    addressEn:
      "Russian Federation Boulevard, Tuek L'ak I, Tuol Kork, Phnom Penh",
    latitude: 11.5702,
    longitude: 104.8974,
  },
];

const amenities = [
  ["wifi", "វ៉ាយហ្វាយ/អ៊ីនធឺណិត", "Wi-Fi/internet", "connectivity"],
  ["air-conditioning", "ម៉ាស៊ីនត្រជាក់", "Air conditioning", "comfort"],
  ["fan", "កង្ហារ", "Fan", "comfort"],
  ["private-bathroom", "បន្ទប់ទឹកផ្ទាល់ខ្លួន", "Private bathroom", "bathroom"],
  ["shared-bathroom", "បន្ទប់ទឹករួម", "Shared bathroom", "bathroom"],
  ["furnished", "មានគ្រឿងសង្ហារិម", "Furnished", "interior"],
  ["bed", "គ្រែ", "Bed", "interior"],
  ["study-desk", "តុសិក្សា", "Desk/study table", "interior"],
  ["kitchen", "ផ្ទះបាយ", "Kitchen", "kitchen"],
  ["refrigerator", "ទូទឹកកក", "Refrigerator", "kitchen"],
  [
    "laundry",
    "ម៉ាស៊ីនបោកខោអាវ/កន្លែងបោកគក់",
    "Washing machine/laundry access",
    "services",
  ],
  ["motorbike-parking", "ចំណតម៉ូតូ", "Motorbike parking", "parking"],
  ["car-parking", "ចំណតរថយន្ត", "Car parking", "parking"],
  ["security-guard", "សន្តិសុខ", "Security guard", "security"],
  ["cctv", "កាមេរ៉ាសុវត្ថិភាពនៅកន្លែងរួម", "CCTV in common areas", "security"],
  ["gated-access", "មានរបង និងច្រកចូល", "Gated access", "security"],
  ["water-included", "រួមបញ្ចូលថ្លៃទឹក", "Water included", "utilities"],
  [
    "electricity-info",
    "ព័ត៌មានថ្លៃអគ្គិសនី",
    "Electricity billing information",
    "utilities",
  ],
  ["balcony", "យ៉រ", "Balcony", "interior"],
  ["elevator", "ជណ្តើរយន្ត", "Elevator", "accessibility"],
  ["pet-policy", "គោលការណ៍សត្វចិញ្ចឹម", "Pet policy", "policy"],
] as const;

async function seed(): Promise<void> {
  await prisma.$transaction(
    institutions.map((institution) =>
      prisma.institution.upsert({
        where: { slug: institution.slug },
        create: institution,
        update: institution,
      }),
    ),
  );

  await prisma.$transaction(
    amenities.map(([key, nameKm, nameEn, category], sortOrder) =>
      prisma.amenity.upsert({
        where: { key },
        create: { key, nameKm, nameEn, category, sortOrder },
        update: { nameKm, nameEn, category, sortOrder, isActive: true },
      }),
    ),
  );
}

try {
  await seed();
} finally {
  await prisma.$disconnect();
}
