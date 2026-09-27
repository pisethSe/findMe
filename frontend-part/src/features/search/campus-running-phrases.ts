/** One bilingual example line pair for the running campus field text. */
export interface CampusRunningPhrase {
  km: string;
  en: string;
}

/**
 * Fallback examples for the campus search field while it is idle.
 *
 * Both languages always render together, so a visitor sees Khmer and English
 * regardless of the active locale. These lines are content, not authored UI
 * copy: translation must leave them untouched (see campus-running-phrases.test).
 */
export const CAMPUS_SEARCH_PHRASES: readonly CampusRunningPhrase[] = [
  {
    km: "ស្វែងរកបន្ទប់នៅភ្នំពេញ ជិតសាកលវិទ្យាល័យរបស់អ្នក។",
    en: "Find rooms in Phnom Penh, near your university.",
  },
  {
    km: "ស្វែងរកបន្ទប់ជួលដែលអ្នកពេញចិត្ត និងនៅជិតសាលាអ្នកបំផុត។",
    en: "Find the room you love, near your school.",
  },
  { km: "វាយជាខ្មែរ ឬអង់គ្លេស", en: "Type in Khmer or English" },
  { km: "ឈ្មោះពេញ ឬអក្សរកាត់ RUPP", en: "Full name or abbreviation like RUPP" },
];
