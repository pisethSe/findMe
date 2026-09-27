import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../backend-part/src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL_UNPOOLED?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL_UNPOOLED is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// 35 Phnom Penh institutions drawn from the landing university directory
// (frontend-part/src/features/landing/university-directory-data.ts).
// Coordinates are approximate main-campus positions from public knowledge,
// intended for local search/discovery testing; verify them before relying on
// production distance rankings. The `location` geography column is generated
// from latitude/longitude by PostgreSQL, so no raw spatial SQL is needed here.
const INSTITUTION_TYPE = "UNIVERSITY" as const;

const institutions = [
  {
    slug: "royal-university-of-phnom-penh",
    nameKm: "សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ",
    nameEn: "Royal University of Phnom Penh",
    shortName: "RUPP",
    type: INSTITUTION_TYPE,
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
    type: INSTITUTION_TYPE,
    addressKm:
      "មហាវិថីសហព័ន្ធរុស្ស៊ី សង្កាត់ទឹកល្អក់១ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ",
    addressEn:
      "Russian Federation Boulevard, Tuek L'ak I, Tuol Kork, Phnom Penh",
    latitude: 11.5702,
    longitude: 104.8974,
  },
  {
    slug: "royal-academy-of-cambodia",
    nameKm: "រាជបណ្ឌិត្យសភាកម្ពុជា",
    nameEn: "Royal Academy of Cambodia",
    shortName: "RAC",
    type: INSTITUTION_TYPE,
    latitude: 11.5733,
    longitude: 104.9233,
  },
  {
    slug: "royal-school-of-administration",
    nameKm: "សាលាភូមិន្ទរដ្ឋបាល",
    nameEn: "Royal School of Administration",
    shortName: "ERA",
    type: INSTITUTION_TYPE,
    latitude: 11.5547,
    longitude: 104.9174,
  },
  {
    slug: "cambodian-agricultural-research-and-development-institute",
    nameKm: "វិទ្យាស្ថានស្រាវជ្រាវ និងអភិវឌ្ឍកសិកម្មកម្ពុជា",
    nameEn: "Cambodian Agricultural Research and Development Institute",
    shortName: "CARDI",
    type: INSTITUTION_TYPE,
    latitude: 11.581,
    longitude: 104.885,
  },
  {
    slug: "national-institute-of-education",
    nameKm: "វិទ្យាស្ថានជាតិអប់រំ",
    nameEn: "National Institute of Education",
    shortName: "NIE",
    type: INSTITUTION_TYPE,
    latitude: 11.5713,
    longitude: 104.8776,
  },
  {
    slug: "national-polytechnic-institute-of-cambodia",
    nameKm: "វិទ្យាស្ថានជាតិពហុបច្ចេកទេសកម្ពុជា",
    nameEn: "National Polytechnic Institute of Cambodia",
    shortName: "NPIC",
    type: INSTITUTION_TYPE,
    latitude: 11.6108,
    longitude: 104.8724,
  },
  {
    slug: "national-technical-training-institute",
    nameKm: "វិទ្យាស្ថានជាតិបណ្តុះបណ្តាលបច្ចេកទេស",
    nameEn: "National Technical Training Institute",
    shortName: "NTTI",
    type: INSTITUTION_TYPE,
    latitude: 11.6064,
    longitude: 104.8686,
  },
  {
    slug: "national-university-of-management",
    nameKm: "សាកលវិទ្យាល័យជាតិគ្រប់គ្រង",
    nameEn: "National University of Management",
    shortName: "NUM",
    type: INSTITUTION_TYPE,
    latitude: 11.554,
    longitude: 104.884,
  },
  {
    slug: "prek-leap-national-institute-of-agriculture",
    nameKm: "វិទ្យាស្ថានជាតិកសិកម្មព្រែកលៀប",
    nameEn: "Prek Leap National Institute of Agriculture",
    shortName: "PNIA",
    type: INSTITUTION_TYPE,
    latitude: 11.6444,
    longitude: 104.9065,
  },
  {
    slug: "royal-university-of-agriculture",
    nameKm: "សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម",
    nameEn: "Royal University of Agriculture",
    shortName: "RUA",
    type: INSTITUTION_TYPE,
    latitude: 11.5155,
    longitude: 104.8568,
  },
  {
    slug: "royal-university-of-fine-arts",
    nameKm: "សាកលវិទ្យាល័យភូមិន្ទវិចិត្រសិល្បៈ",
    nameEn: "Royal University of Fine Arts",
    shortName: "RUFA",
    type: INSTITUTION_TYPE,
    latitude: 11.5677,
    longitude: 104.9179,
  },
  {
    slug: "royal-university-of-law-and-economics",
    nameKm: "សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្រ្ត និងវិទ្យាសាស្រ្តសេដ្ឋកិច្ច",
    nameEn: "Royal University of Law and Economics",
    shortName: "RULE",
    type: INSTITUTION_TYPE,
    latitude: 11.6057,
    longitude: 104.8785,
  },
  {
    slug: "university-of-health-sciences",
    nameKm: "សាកលវិទ្យាល័យវិទ្យាសាស្រ្តសុខាភិបាល",
    nameEn: "University of Health Sciences",
    shortName: "UHS",
    type: INSTITUTION_TYPE,
    latitude: 11.5544,
    longitude: 104.917,
  },
  {
    slug: "national-institute-of-business",
    nameKm: "វិទ្យាស្ថានជាតិពាណិជ្ជសាស្រ្ត",
    nameEn: "National Institute of Business",
    shortName: "NIB",
    type: INSTITUTION_TYPE,
    latitude: 11.5763,
    longitude: 104.8848,
  },
  {
    slug: "preah-kossomak-polytechnic-institute",
    nameKm: "វិទ្យាស្ថានពហុបច្ចេកទេសព្រះកុសុមៈ",
    nameEn: "Preah Kossomak Polytechnic Institute",
    shortName: "PPI",
    type: INSTITUTION_TYPE,
    latitude: 11.578,
    longitude: 104.847,
  },
  {
    slug: "industrial-technical-institute",
    nameKm: "វិទ្យាស្ថានបច្ចេកវិទ្យាឧស្សាហកម្ម",
    nameEn: "Industrial Technical Institute",
    shortName: "ITI",
    type: INSTITUTION_TYPE,
    latitude: 11.5649,
    longitude: 104.8413,
  },
  {
    slug: "cambodia-academy-of-digital-technology",
    nameKm: "បណ្ឌិតសភាបច្ចេកវិទ្យាឌីជីថលកម្ពុជា",
    nameEn: "Cambodia Academy of Digital Technology",
    shortName: "CADT",
    type: INSTITUTION_TYPE,
    latitude: 11.6041,
    longitude: 104.8701,
  },
  {
    slug: "american-university-of-phnom-penh",
    nameKm: "សាកលវិទ្យាល័យអាមេរិកាំងភ្នំពេញ",
    nameEn: "American University of Phnom Penh",
    shortName: "AUPP",
    type: INSTITUTION_TYPE,
    latitude: 11.5586,
    longitude: 104.8918,
  },
  {
    slug: "phnom-penh-international-university",
    nameKm: "សាកលវិទ្យាល័យភ្នំពេញអន្តរជាតិ",
    nameEn: "Phnom Penh International University",
    shortName: "PPIU",
    type: INSTITUTION_TYPE,
    latitude: 11.5837,
    longitude: 104.8615,
  },
  {
    slug: "beltei-international-university",
    nameKm: "សាកលវិទ្យាល័យប៊ែលធីអន្តរជាតិ",
    nameEn: "Beltei International University",
    shortName: "BELTEI",
    type: INSTITUTION_TYPE,
    latitude: 11.5577,
    longitude: 104.9077,
  },
  {
    slug: "build-bright-university",
    nameKm: "សាកលវិទ្យាល័យបៀលប្រាយ",
    nameEn: "Build Bright University",
    shortName: "BBU",
    type: INSTITUTION_TYPE,
    latitude: 11.5669,
    longitude: 104.8528,
  },
  {
    slug: "panyasastra-university-of-cambodia",
    nameKm: "សាកលវិទ្យាល័យបញ្ញាសាស្ត្រ",
    nameEn: "Paññāsāstra University of Cambodia",
    shortName: "PUC",
    type: INSTITUTION_TYPE,
    latitude: 11.5615,
    longitude: 104.9147,
  },
  {
    slug: "norton-university",
    nameKm: "សាកលវិទ្យាល័យន័រតុន",
    nameEn: "Norton University",
    shortName: "NU",
    type: INSTITUTION_TYPE,
    latitude: 11.5478,
    longitude: 104.887,
  },
  {
    slug: "international-university",
    nameKm: "សាកលវិទ្យាល័យអន្តរជាតិ",
    nameEn: "International University",
    shortName: "IU",
    type: INSTITUTION_TYPE,
    latitude: 11.552,
    longitude: 104.893,
  },
  {
    slug: "asia-euro-university",
    nameKm: "សាកលវិទ្យាល័យអាស៊ីអឺរ៉ុប",
    nameEn: "Asia Euro University",
    shortName: "AEU",
    type: INSTITUTION_TYPE,
    latitude: 11.556,
    longitude: 104.87,
  },
  {
    slug: "western-university",
    nameKm: "សាកលវិទ្យាល័យវេស្ទើន",
    nameEn: "Western University",
    shortName: "WU",
    type: INSTITUTION_TYPE,
    latitude: 11.624,
    longitude: 104.8743,
  },
  {
    slug: "university-of-cambodia",
    nameKm: "សាកលវិទ្យាល័យកម្ពុជា",
    nameEn: "University of Cambodia",
    shortName: "UC",
    type: INSTITUTION_TYPE,
    latitude: 11.5974,
    longitude: 104.8976,
  },
  {
    slug: "camed-business-school",
    nameKm: "វិទ្យាស្ថាន ខេមអេដ",
    nameEn: "CamEd Business School",
    shortName: "CamEd",
    type: INSTITUTION_TYPE,
    latitude: 11.5844,
    longitude: 104.878,
  },
  {
    slug: "paragon-international-university",
    nameKm: "សាកលវិទ្យាល័យអន្តរជាតិផារ៉ាហ្កន",
    nameEn: "Paragon International University",
    shortName: "Paragon.U",
    type: INSTITUTION_TYPE,
    latitude: 11.5946,
    longitude: 104.9105,
  },
  {
    slug: "limkokwing-university-of-creative-technology",
    nameKm: "សាកលវិទ្យាល័យ លឹមកុកវីង",
    nameEn: "Limkokwing University of Creative Technology",
    shortName: "LKU",
    type: INSTITUTION_TYPE,
    latitude: 11.5574,
    longitude: 104.876,
  },
  {
    slug: "phnom-penh-institute-of-technology",
    nameKm: "វិទ្យាស្ថានបច្ចេកវិទ្យាភ្នំពេញ",
    nameEn: "Phnom Penh Institute of Technology",
    shortName: "PPIT",
    type: INSTITUTION_TYPE,
    latitude: 11.6389,
    longitude: 104.8777,
  },
  {
    slug: "university-of-economics-and-finance",
    nameKm: "សាកលវិទ្យាល័យសេដ្ឋកិច្ចនិងហិរញ្ញវត្ថុ",
    nameEn: "University of Economics and Finance",
    shortName: "UEF",
    type: INSTITUTION_TYPE,
    latitude: 11.56,
    longitude: 104.857,
  },
  {
    slug: "cambodian-university-of-specialties",
    nameKm: "សាកលវិទ្យាល័យឯកទេសកម្ពុជា",
    nameEn: "Cambodian University of Specialties",
    shortName: "CUS",
    type: INSTITUTION_TYPE,
    latitude: 11.5581,
    longitude: 104.8773,
  },
  {
    slug: "chamroeun-university-of-poly-technology",
    nameKm: "សាកលវិទ្យាល័យចំរើនពហុបច្ចេកវិទ្យា",
    nameEn: "Chamroeun University of Poly-Technology",
    shortName: "CUP",
    type: INSTITUTION_TYPE,
    latitude: 11.5874,
    longitude: 104.8711,
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
