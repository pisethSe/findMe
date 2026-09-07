import type { PublicListingDetailDto } from "@findme/contracts";

export const RENTAL_TYPE_LABELS: Record<
  PublicListingDetailDto["propertyType"],
  string
> = {
  ROOM: "Room",
  STUDIO: "Studio",
  APARTMENT: "Apartment",
  HOUSE: "House",
  DORM_ROOM: "Dorm room",
  OTHER_STUDENT_RENTAL: "Other student rental",
};

export function rentalDetailHref(
  slug: string,
  institution: string,
  search: string,
): string {
  const params = new URLSearchParams({
    institution,
    returnTo: searchReturnHref(`/search?${search.replace(/^\?/, "")}`),
  });
  return `/rentals/${encodeURIComponent(slug)}?${params}`;
}

export function searchReturnHref(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    !value.startsWith("/search")
  )
    return "/search";
  try {
    const url = new URL(value, "https://findme.invalid");
    return url.origin === "https://findme.invalid" &&
      url.pathname === "/search" &&
      !url.hash
      ? `/search${url.search}`
      : "/search";
  } catch {
    return "/search";
  }
}

export function rentalCanonicalUrl(
  slug: string,
  siteUrl: string | undefined,
): string | undefined {
  if (!siteUrl) return undefined;
  const url = new URL(siteUrl);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("SITE_URL must be a public HTTP(S) origin.");
  return new URL(`/rentals/${encodeURIComponent(slug)}`, url).href;
}

export function rentalTitle(
  rental: Pick<PublicListingDetailDto, "titleEn" | "titleKm">,
): string {
  return rental.titleEn ?? rental.titleKm ?? "Student rental";
}

export function rentalMoney(amount: number, currency: "USD" | "KHR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KHR" ? 0 : 2,
  }).format(amount);
}

export function rentalDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Phnom_Penh",
  }).format(new Date(value));
}

export function rentalAvailability(
  date: string | null,
  now = new Date(),
): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return date && date > today
    ? `Available from ${rentalDate(date)}`
    : "Available now";
}

export function phoneHref(phone: string | null): string | null {
  return phone && /^\+?[\d ()-]{6,32}$/.test(phone)
    ? `tel:${phone.replace(/[ ()-]/g, "")}`
    : null;
}

export function telegramHref(handle: string | null): string | null {
  const username = handle?.replace(/^@/, "");
  return username && /^[A-Za-z0-9_]{5,32}$/.test(username)
    ? `https://t.me/${username}`
    : null;
}
