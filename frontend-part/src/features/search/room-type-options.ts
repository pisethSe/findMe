import type { PropertyType } from "@findme/contracts";

/**
 * One shared student-facing rental taxonomy.
 *
 * The backend enum keeps its original generic values plus the specific room,
 * unit-size and floor values added for Cambodian student rentals. `propertyType`
 * is sent to the API exactly as declared here, so a "2 bedroom" filter narrows
 * to listings published as 2-bedroom offers rather than to a broad category.
 */
export interface RoomTypeOption {
  value: PropertyType;
  en: string;
  km: string;
}

export const ROOM_TYPE_OPTIONS: readonly RoomTypeOption[] = [
  { value: "ONE_BEDROOM", en: "1 bedroom", km: "បន្ទប់គេង 1" },
  { value: "TWO_BEDROOM", en: "2 bedroom", km: "បន្ទប់គេង 2" },
  { value: "THREE_BEDROOM", en: "3 bedroom", km: "បន្ទប់គេង 3" },
  { value: "SHARED_ROOM", en: "Shared room", km: "បន្ទប់រួម" },
  { value: "STUDIO", en: "Studio", km: "ស្ទូឌីយោ" },
  { value: "APARTMENT", en: "Apartment", km: "អាផាតមិន" },
  { value: "HOUSE", en: "Whole house", km: "ផ្ទះទាំងមូល" },
  { value: "DORM_ROOM", en: "Dorm room", km: "បន្ទប់អន្តេវាសិកដ្ឋាន" },
  { value: "FLOOR_1", en: "Floor 1", km: "ជាន់ទី 1" },
  { value: "FLOOR_2", en: "Floor 2", km: "ជាន់ទី 2" },
  { value: "FLOOR_3", en: "Floor 3", km: "ជាន់ទី 3" },
  { value: "ROOM", en: "Room", km: "បន្ទប់" },
  {
    value: "OTHER_STUDENT_RENTAL",
    en: "Other student rental",
    km: "បន្ទប់សម្រាប់និស្សិតផ្សេងទៀត",
  },
] as const;

export const ROOM_TYPE_VALUES: ReadonlySet<PropertyType> = new Set(
  ROOM_TYPE_OPTIONS.map((option) => option.value),
);

export function isRoomType(value: unknown): value is PropertyType {
  return (
    typeof value === "string" && ROOM_TYPE_VALUES.has(value as PropertyType)
  );
}

export function roomTypeEnglishLabel(value: PropertyType): string {
  return (
    ROOM_TYPE_OPTIONS.find((option) => option.value === value)?.en ??
    value.replaceAll("_", " ").toLowerCase()
  );
}
