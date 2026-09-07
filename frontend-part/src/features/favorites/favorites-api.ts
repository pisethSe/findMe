import type {
  FavoriteDto,
  FavoriteMutationResult,
  FavoritesPage,
} from "@findme/contracts";
import { authorizedPageRequest, authorizedRequest } from "../auth/auth-api.ts";
import { isPublicListingSummary } from "../search/search-api.ts";

export async function listFavorites(
  page = 1,
  listingIds?: readonly string[],
): Promise<FavoritesPage> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: listingIds ? "50" : "12",
  });
  if (listingIds?.length) query.set("listingIds", listingIds.join(","));
  const result = await authorizedPageRequest<unknown, unknown>(
    `/me/favorites?${query}`,
    { method: "GET" },
  );
  if (!isFavoritesPage(result))
    throw new Error("Invalid saved-rentals response.");
  return result;
}

export async function setFavorite(
  listingId: string,
  saved: boolean,
): Promise<FavoriteMutationResult> {
  const result = await authorizedRequest<unknown>(
    `/me/favorites/${encodeURIComponent(listingId)}`,
    { method: saved ? "PUT" : "DELETE", body: {} },
  );
  if (
    !result ||
    typeof result !== "object" ||
    !("listingId" in result) ||
    result.listingId !== listingId ||
    !("saved" in result) ||
    result.saved !== saved
  )
    throw new Error("Invalid saved-rentals response.");
  return { listingId, saved };
}

export function isFavoritesPage(value: unknown): value is FavoritesPage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<FavoritesPage>;
  const meta = page.meta;
  return (
    Array.isArray(page.data) &&
    page.data.every(isFavorite) &&
    new Set(page.data.map((f) => f.listingId)).size === page.data.length &&
    !!meta &&
    Number.isInteger(meta.page) &&
    meta.page >= 1 &&
    meta.page <= 10000 &&
    Number.isInteger(meta.pageSize) &&
    meta.pageSize >= 1 &&
    meta.pageSize <= 50 &&
    Number.isInteger(meta.total) &&
    meta.total >= 0 &&
    meta.totalPages === Math.ceil(meta.total / meta.pageSize) &&
    page.data.length ===
      Math.max(
        0,
        Math.min(meta.pageSize, meta.total - (meta.page - 1) * meta.pageSize),
      )
  );
}

function isFavorite(value: unknown): value is FavoriteDto {
  if (!value || typeof value !== "object") return false;
  const favorite = value as Partial<FavoriteDto>;
  return (
    typeof favorite.listingId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      favorite.listingId,
    ) &&
    typeof favorite.savedAt === "string" &&
    Number.isFinite(Date.parse(favorite.savedAt)) &&
    (favorite.listing === null ||
      (isPublicListingSummary(favorite.listing) &&
        favorite.listing.id === favorite.listingId))
  );
}
