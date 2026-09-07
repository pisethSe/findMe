import type {
  LandlordInquiryDto,
  LandlordInquiryPage,
  OffsetPageMeta,
  StudentInquiryDto,
  StudentInquiryPage,
} from "@findme/contracts";
import { authorizedPageRequest, authorizedRequest } from "../auth/auth-api.ts";
import type { EditableInquiryStatus } from "./inquiry-model.ts";

export async function createInquiry(
  listingId: string,
  input: { message: string; clientRequestId: string },
): Promise<StudentInquiryDto> {
  const result = await authorizedRequest<unknown>(
    `/listings/${encodeURIComponent(listingId)}/inquiries`,
    { method: "POST", body: input },
  );
  if (!isStudentInquiry(result)) throw new Error("Invalid inquiry response.");
  return result;
}

export async function listStudentInquiries(
  page = 1,
): Promise<StudentInquiryPage> {
  const result = await authorizedPageRequest<unknown, unknown>(
    `/me/inquiries?page=${page}&pageSize=12`,
    { method: "GET" },
  );
  if (!isInquiryPage(result, isStudentInquiry))
    throw new Error("Invalid sent-inquiry response.");
  return result;
}

export async function listLandlordInquiries(
  page = 1,
): Promise<LandlordInquiryPage> {
  const result = await authorizedPageRequest<unknown, unknown>(
    `/landlord/inquiries?page=${page}&pageSize=12`,
    { method: "GET" },
  );
  if (!isInquiryPage(result, isLandlordInquiry))
    throw new Error("Invalid landlord-inquiry response.");
  return result;
}

export async function updateInquiryStatus(
  id: string,
  status: EditableInquiryStatus,
): Promise<LandlordInquiryDto> {
  const result = await authorizedRequest<unknown>(
    `/landlord/inquiries/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: { status } },
  );
  if (
    !isLandlordInquiry(result) ||
    result.id !== id ||
    result.status !== status
  )
    throw new Error("Invalid inquiry-status response.");
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function nullableText(value: unknown) {
  return value === null || typeof value === "string";
}
function timestamp(value: unknown) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
function core(value: Record<string, unknown>) {
  return (
    isUuid(value.id) &&
    typeof value.message === "string" &&
    value.message.trim().length > 0 &&
    Array.from(value.message).length <= 4000 &&
    ["NEW", "READ", "RESPONDED", "CLOSED"].includes(String(value.status)) &&
    timestamp(value.createdAt) &&
    timestamp(value.updatedAt)
  );
}

export function isStudentInquiry(value: unknown): value is StudentInquiryDto {
  if (!isRecord(value) || !core(value)) return false;
  const listing = value.listing;
  return (
    listing === null ||
    (isRecord(listing) &&
      isUuid(listing.id) &&
      typeof listing.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(listing.slug) &&
      nullableText(listing.titleKm) &&
      nullableText(listing.titleEn))
  );
}

export function isLandlordInquiry(value: unknown): value is LandlordInquiryDto {
  if (!isRecord(value) || !core(value)) return false;
  return (
    isRecord(value.student) &&
    typeof value.student.displayName === "string" &&
    isRecord(value.listing) &&
    isUuid(value.listing.id) &&
    nullableText(value.listing.titleKm) &&
    nullableText(value.listing.titleEn) &&
    typeof value.listing.propertyName === "string"
  );
}

export function isInquiryPage<T>(
  value: unknown,
  validate: (row: unknown) => row is T,
): value is { data: T[]; meta: OffsetPageMeta } {
  if (
    !isRecord(value) ||
    !Array.isArray(value.data) ||
    !value.data.every(validate) ||
    !isRecord(value.meta)
  )
    return false;
  const meta = value.meta;
  if (
    ![meta.page, meta.pageSize, meta.total, meta.totalPages].every(
      (n) => typeof n === "number" && Number.isInteger(n),
    )
  )
    return false;
  const { page, pageSize, total, totalPages } =
    meta as unknown as OffsetPageMeta;
  return (
    page >= 1 &&
    page <= 10000 &&
    pageSize >= 1 &&
    pageSize <= 50 &&
    total >= 0 &&
    totalPages === Math.ceil(total / pageSize) &&
    value.data.length ===
      Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize))
  );
}
