// Names and locations supplied in the product brief. This directory is not a
// geocoding database; only institutions returned by the API can anchor rentals.
export interface DirectoryUniversity {
  name: string;
  km: string;
  abbreviation: string;
  city: string;
  sector: "Public" | "Private";
}
type UniversityRow = readonly [string, string, string, string?];
const publicRows: readonly UniversityRow[] = [
  ["Royal Academy of Cambodia", "រាជបណ្ឌិត្យសភាកម្ពុជា", "RAC"],
  ["Royal School of Administration", "សាលាភូមិន្ទរដ្ឋបាល", "ERA"],
  [
    "Cambodian Agricultural Research and Development Institute",
    "វិទ្យាស្ថានស្រាវជ្រាវ និងអភិវឌ្ឍកសិកម្មកម្ពុជា",
    "CARDI",
  ],
  [
    "Institute of Technology of Cambodia",
    "វិទ្យាស្ថានបច្ចេកវិទ្យាកម្ពុជា",
    "ITC",
    "Phnom Penh / Tboung Khmum",
  ],
  [
    "Chea Sim University of Kamchay Mear",
    "សាកលវិទ្យាល័យ ជាស៊ីម កំចាយមារ",
    "CSUK",
    "Prey Veng",
  ],
  ["National Institute of Education", "វិទ្យាស្ថានជាតិអប់រំ", "NIE"],
  [
    "National Polytechnic Institute of Cambodia",
    "វិទ្យាស្ថានជាតិពហុបច្ចេកទេសកម្ពុជា",
    "NPIC",
  ],
  [
    "National Technical Training Institute",
    "វិទ្យាស្ថានជាតិបណ្តុះបណ្តាលបច្ចេកទេស",
    "NTTI",
  ],
  ["National University of Management", "សាកលវិទ្យាល័យជាតិគ្រប់គ្រង", "NUM"],
  [
    "Prek Leap National Institute of Agriculture",
    "វិទ្យាស្ថានជាតិកសិកម្មព្រែកលៀប",
    "PNIA",
  ],
  ["Royal University of Agriculture", "សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម", "RUA"],
  [
    "Royal University of Fine Arts",
    "សាកលវិទ្យាល័យភូមិន្ទវិចិត្រសិល្បៈ",
    "RUFA",
  ],
  [
    "Royal University of Law and Economics",
    "សាកលវិទ្យាល័យភូមិន្ទនីតិសាស្រ្ត និងវិទ្យាសាស្រ្តសេដ្ឋកិច្ច",
    "RULE",
  ],
  ["Royal University of Phnom Penh", "សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ", "RUPP"],
  ["Svay Rieng University", "សាកលវិទ្យាល័យស្វាយរៀង", "SRU", "Svay Rieng"],
  [
    "Meanchey University",
    "សាកលវិទ្យាល័យមានជ័យ",
    "MUC",
    "Sisophon, Banteay Meanchey",
  ],
  ["University of Battambang", "សាកលវិទ្យាល័យនៃបាត់ដំបង", "UBB", "Battambang"],
  [
    "University of Health Sciences",
    "សាកលវិទ្យាល័យវិទ្យាសាស្រ្តសុខាភិបាល",
    "UHS",
  ],
  ["National Institute of Business", "វិទ្យាស្ថានជាតិពាណិជ្ជសាស្រ្ត", "NIB"],
  [
    "Preah Kossomak Polytechnic Institute",
    "វិទ្យាស្ថានពហុបច្ចេកទេសព្រះកុសុមៈ",
    "PPI",
  ],
  [
    "Industrial Technical Institute",
    "វិទ្យាស្ថានបច្ចេកវិទ្យាឧស្សាហកម្ម",
    "ITI",
  ],
  [
    "Cambodia Academy of Digital Technology",
    "បណ្ឌិតសភាបច្ចេកវិទ្យាឌីជីថលកម្ពុជា",
    "CADT",
  ],
];
const privateRows: readonly UniversityRow[] = [
  [
    "American University of Phnom Penh",
    "សាកលវិទ្យាល័យអាមេរិកាំងភ្នំពេញ",
    "AUPP",
  ],
  ["City University, Cambodia", "", "CU"],
  [
    "Phnom Penh International University",
    "សាកលវិទ្យាល័យភ្នំពេញអន្តរជាតិ",
    "PPIU",
  ],
  [
    "Dewey International University",
    "សាកលវិទ្យាល័យអន្តរជាតិឌូវី",
    "DIU",
    "Battambang",
  ],
  ["Beltei International University", "សាកលវិទ្យាល័យប៊ែលធីអន្តរជាតិ", "BELTEI"],
  ["Build Bright University", "សាកលវិទ្យាល័យបៀលប្រាយ", "BBU"],
  ["IIC University of Technology", "", "IIC"],
  ["Paññāsāstra University of Cambodia", "សាកលវិទ្យាល័យបញ្ញាសាស្ត្រ", "PUC"],
  ["Norton University", "សាកលវិទ្យាល័យន័រតុន", "NU"],
  [
    "University of Management and Economics",
    "សាកលវិទ្យាល័យគ្រប់គ្រង និងសេដ្ឋកិច្ច",
    "UME",
    "Battambang / provincial campuses",
  ],
  ["International University", "សាកលវិទ្យាល័យអន្តរជាតិ", "IU"],
  ["Cambodian University of Specialties", "សាកលវិទ្យាល័យឯកទេសកម្ពុជា", "CUS"],
  [
    "Chamroeun University of Poly-Technology",
    "សាកលវិទ្យាល័យចំរើនពហុបច្ចេកវិទ្យា",
    "CUP",
  ],
  [
    "Economics and Finance Institute",
    "វិទ្យាស្ថានសេដ្ឋកិច្ចនិងហិរញ្ញវត្ថុ",
    "EFI",
  ],
  ["University of Cambodia", "សាកលវិទ្យាល័យកម្ពុជា", "UC"],
  ["Asia Euro University", "សាកលវិទ្យាល័យអាស៊ីអឺរ៉ុប", "AEU"],
  ["Western University", "សាកលវិទ្យាល័យវេស្ទើន", "WU"],
  ["Khemarak University", "សាកលវិទ្យាល័យខេមរៈ", "KU"],
  ["Angkor University", "សាកលវិទ្យាល័យអង្គរ", "AU", "Siem Reap"],
  ["Human Resources University", "សាកលវិទ្យាល័យធនធានមនុស្ស", "HRU"],
  [
    "University of Southeast Asia",
    "សាកលវិទ្យាល័យសៅស៏អ៊ីសថ៏អេសៀ",
    "USEA",
    "Siem Reap",
  ],
  ["University of Puthisastra", "សាកលវិទ្យាល័យពុទ្ធិសាស្ត្រ", "UP"],
  ["Chenla University", "សាកលវិទ្យាល័យចេនឡា", "CLU"],
  [
    "Limkokwing University of Creative Technology",
    "សាកលវិទ្យាល័យ លឹមកុកវីង",
    "LKU",
  ],
  [
    "Angkor Khemara University",
    "សាកលវិទ្យាល័យអង្គរខេមរា",
    "AKU",
    "Takéo / Pursat / Kampong Speu / Kampot",
  ],
  [
    "Khmer University of Technology and Management",
    "សាកលវិទ្យាល័យខ្មែរបច្ចេកវិទ្យា និងគ្រប់គ្រង",
    "KUTM",
    "Sihanoukville",
  ],
  ["Panha Chiet University", "សាកលវិទ្យាល័យបញ្ញាជាតិ", "PCU"],
  [
    "East Asia Management University",
    "សាកលវិទ្យាល័យគ្រប់គ្រងអាស៊ីបូព៌ា",
    "EAMU",
  ],
  [
    "Phnom Penh Institute of Technology",
    "វិទ្យាស្ថានបច្ចេកវិទ្យាភ្នំពេញ",
    "PPIT",
  ],
  ["CamEd Business School", "វិទ្យាស្ថាន ខេមអេដ", "CamEd"],
  ["Saint Paul Institute", "វិទ្យាស្ថាន សន្តប៉ូល", "SPI", "Takéo"],
  ["Cambodian Mekong University", "", "CMU"],
  ["Vanda Institute", "វិទ្យាស្ថាន វ៉ាន់ដា", "VI"],
  [
    "Paragon International University",
    "សាកលវិទ្យាល័យអន្តរជាតិផារ៉ាហ្កន",
    "Paragon.U",
  ],
  [
    "Phnom Penh International Institute of the Arts",
    "វិទ្យាស្ថានសិល្បៈភ្នំពេញអន្តរជាតិ",
    "PPIIA",
  ],
  ["Life University", "សាកលវិទ្យាល័យឡាយ", "LU", "Sihanoukville"],
  [
    "Institute of Professional Accounting",
    "វិទ្យាស្ថាន ជំនាញគណនេយ្យ",
    "IPA",
    "Phnom Penh / Siem Reap",
  ],
  [
    "Kirirom Institute of Technology",
    "វិទ្យាស្ថានបច្ចេកវិទ្យាគីរីរម្យ",
    "KIT",
    "Kirirom, Kampong Speu",
  ],
  [
    "ACLEDA Institute of Business",
    "វិទ្យាស្ថាន ពាណិជ្ជសាស្រ្ត អេស៊ីលីដា",
    "AIB",
  ],
  [
    "University of Economics and Finance",
    "សាកលវិទ្យាល័យសេដ្ឋកិច្ចនិងហិរញ្ញវត្ថុ",
    "UEF",
  ],
  ["De Montfort University Cambodia", "", "DMUC"],
];
export const UNIVERSITY_DIRECTORY: readonly DirectoryUniversity[] = [
  ...publicRows.map(([name, km, abbreviation, city]) => ({
    name,
    km,
    abbreviation,
    city: city ?? "Phnom Penh",
    sector: "Public" as const,
  })),
  ...privateRows.map(([name, km, abbreviation, city]) => ({
    name,
    km,
    abbreviation,
    city: city ?? "Phnom Penh",
    sector: "Private" as const,
  })),
];
export function filterDirectory(query: string, sector: string) {
  const normalized = query
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
  return UNIVERSITY_DIRECTORY.filter(
    (item) =>
      (sector === "All" || item.sector === sector) &&
      `${item.name} ${item.km} ${item.abbreviation} ${item.city}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .includes(normalized),
  );
}
