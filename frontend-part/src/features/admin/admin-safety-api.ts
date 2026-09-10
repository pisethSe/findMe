import type {
  AdminPendingListingDto,
  AdminReportDto,
  AdminUserDto,
  OffsetPageMeta,
} from "@findme/contracts";
import { authorizedPageRequest, authorizedRequest } from "../auth/auth-api.ts";
export type AdminRow = AdminReportDto | AdminUserDto | AdminPendingListingDto;
export type AdminSection = "reports" | "users" | "listings";
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function text(value: unknown) {
  return typeof value === "string";
}
function nullable(value: unknown) {
  return value === null || text(value);
}
export function validAdminRow(
  value: unknown,
  section: AdminSection,
): value is AdminRow {
  if (!record(value) || !text(value.id)) return false;
  if (section === "users")
    return (
      text(value.displayName) &&
      (value.role === null ||
        ["STUDENT", "LANDLORD", "ADMIN"].includes(String(value.role))) &&
      ["ACTIVE", "SUSPENDED", "DELETED"].includes(
        String(value.accountStatus),
      ) &&
      text(value.createdAt)
    );
  if (section === "reports")
    return (
      ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"].includes(
        String(value.status),
      ) &&
      [
        "INACCURATE",
        "UNAVAILABLE",
        "SCAM_SUSPICIOUS",
        "DUPLICATE",
        "INAPPROPRIATE",
        "OTHER",
      ].includes(String(value.reason)) &&
      nullable(value.details) &&
      nullable(value.resolutionNote) &&
      nullable(value.resolvedAt) &&
      text(value.createdAt) &&
      text(value.updatedAt) &&
      record(value.listing) &&
      text(value.listing.id) &&
      text(value.listing.slug) &&
      nullable(value.listing.titleEn) &&
      nullable(value.listing.titleKm) &&
      text(value.listing.status) &&
      text(value.listing.landlordId)
    );
  return (
    [
      "DRAFT",
      "PENDING_REVIEW",
      "PUBLISHED",
      "PAUSED",
      "RENTED",
      "REJECTED",
      "ARCHIVED",
    ].includes(String(value.status)) &&
    ["USD", "KHR"].includes(String(value.currency)) &&
    text(value.propertyType) &&
    nullable(value.descriptionEn) &&
    nullable(value.descriptionKm) &&
    nullable(value.titleEn) &&
    nullable(value.titleKm) &&
    record(value.property) &&
    text(value.property.name) &&
    text(value.property.addressLine) &&
    text(value.property.city) &&
    typeof value.property.latitude === "number" &&
    typeof value.property.longitude === "number" &&
    typeof value.monthlyPrice === "number" &&
    typeof value.availableUnits === "number" &&
    record(value.landlord) &&
    text(value.landlord.displayName) &&
    text(value.landlord.verificationStatus) &&
    Array.isArray(value.images) &&
    value.images.every(
      (image) =>
        record(image) &&
        text(image.id) &&
        text(image.status) &&
        text(image.publicUrl),
    )
  );
}
export async function listAdmin(
  section: AdminSection,
  page: number,
  filter: string,
  query: string,
  id?: string,
) {
  if (id && section === "listings") {
    const row = await authorizedRequest<unknown>(
      `/admin/listings/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    if (!validAdminRow(row, section))
      throw new Error("Invalid rental response.");
    return {
      data: [row],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
  }
  const params = new URLSearchParams({
    page: String(page),
    pageSize: "20",
    ...(filter ? { status: filter } : {}),
    ...(query ? { query } : {}),
  });
  const result = await authorizedPageRequest<unknown, unknown>(
    `/admin/${section}?${params}`,
    { method: "GET" },
  );
  if (
    !Array.isArray(result.data) ||
    !result.data.every((row) => validAdminRow(row, section)) ||
    !record(result.meta)
  )
    throw new Error("Invalid admin response.");
  const meta = result.meta;
  if (
    ![meta.page, meta.pageSize, meta.total, meta.totalPages].every(
      (n) => typeof n === "number" && Number.isInteger(n),
    ) ||
    Number(meta.page) < 1 ||
    Number(meta.pageSize) < 1 ||
    Number(meta.total) < 0 ||
    meta.totalPages !== Math.ceil(Number(meta.total) / Number(meta.pageSize))
  )
    throw new Error("Invalid admin pagination.");
  return { data: result.data, meta: meta as unknown as OffsetPageMeta };
}
export async function adminAction(
  section: AdminSection,
  id: string,
  action: string,
  note: string,
  expectedStatus: string,
) {
  const value = await authorizedRequest<unknown>(
    `/admin/${section}/${encodeURIComponent(id)}${section === "reports" ? "" : `/${action}`}`,
    {
      method: section === "reports" ? "PATCH" : "POST",
      body:
        section === "reports"
          ? { note, status: action, expectedStatus }
          : section === "listings"
            ? { note, expectedStatus }
            : { note },
    },
  );
  if (!validAdminRow(value, section))
    throw new Error(
      "The action returned an invalid response. Refresh before retrying.",
    );
  return value;
}
