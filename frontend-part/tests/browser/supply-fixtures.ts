// Deterministic browser fixtures only. Real authorization and persistence are
// verified separately by the NestJS/PostGIS integration suites.
import type { LandlordListingDto, ListingImageDto } from "@findme/contracts";
import { expect, type Page } from "@playwright/test";
import type {
  AuthSession,
  LandlordEntitlement,
  OnboardingState,
  UserRole,
} from "../../src/features/auth/auth-api";
import type {
  CreateLandlordListingInput,
  UpdateLandlordListingInput,
} from "../../src/features/landlord-listings/landlord-listing-api";

export const listingId = "00000000-0000-4000-8000-000000000041";
export const titleKm = "បន្ទប់ជួលសម្រាប់និស្សិតជិតសាកលវិទ្យាល័យ";
export const amenity = {
  id: "00000000-0000-4000-8000-000000000042",
  key: "wifi",
  nameKm: "អ៊ីនធឺណិត",
  nameEn: "Wi-Fi",
  category: "Facilities",
};

export function ownedRental(): LandlordListingDto {
  return {
    id: listingId,
    slug: "student-room",
    titleKm,
    titleEn: "Student room",
    descriptionKm: null,
    descriptionEn: "Quiet room with space to study.",
    propertyType: "ROOM",
    monthlyPrice: 95,
    currency: "USD",
    depositAmount: null,
    utilityNotesKm: null,
    utilityNotesEn: null,
    houseRulesKm: null,
    houseRulesEn: null,
    bedrooms: null,
    bathrooms: null,
    furnished: false,
    availableFrom: null,
    availableUnits: 2,
    availabilityConfirmedAt: null,
    availabilityFreshness: {
      state: "UNCONFIRMED",
      remindAt: null,
      expiresAt: null,
    },
    contactPreference: "IN_APP_ONLY",
    status: "DRAFT",
    publishedAt: null,
    createdAt: "2026-09-04T00:00:00Z",
    updatedAt: "2026-09-04T00:00:00Z",
    property: {
      id: "00000000-0000-4000-8000-000000000043",
      name: "University rooms",
      addressLine: "Street 138, Phnom Penh",
      commune: null,
      district: "Toul Kork",
      city: "Phnom Penh",
      countryCode: "KH",
      latitude: 11.569,
      longitude: 104.8914,
      googlePlaceId: null,
      totalUnits: 3,
    },
    amenities: [amenity],
    images: [],
  };
}

export function access(active = true): LandlordEntitlement {
  return {
    status: active ? "TRIALING" : "EXPIRED",
    source: "TRIAL",
    trialStartedAt: "2026-09-04T00:00:00Z",
    trialEndsAt: "2026-09-11T00:00:00Z",
    accessEndsAt: "2026-09-11T00:00:00Z",
    evaluatedAt: "2026-09-05T00:00:00Z",
    isAccessActive: active,
    remainingDays: active ? 6 : 0,
    capabilities: {
      canReadListings: true,
      canCreateListings: active,
      canSubmitListings: active,
      canPublishListings: active,
      canIncreaseAvailability: active,
    },
  };
}

export function onboarding(
  role: UserRole | null,
  complete = true,
): OnboardingState {
  return {
    role,
    stage:
      role === null
        ? "ROLE_SELECTION"
        : complete
          ? "COMPLETE"
          : "LANDLORD_PROFILE",
    nextPath:
      role === null
        ? "/onboarding/role"
        : role === "LANDLORD"
          ? complete
            ? "/landlord"
            : "/onboarding/landlord"
          : role === "ADMIN"
            ? "/admin"
            : "/",
    roleSelectionComplete: role !== null,
    profileComplete: role !== null && complete,
    landlordTrialActivated: role === "LANDLORD" && complete,
  };
}

export async function supplyApi(page: Page) {
  const mediaById = new Map<string, ListingImageDto>();
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#dedfcf"/></svg>',
    }),
  );
  const state = {
    signedIn: true,
    onboarding: onboarding("LANDLORD"),
    entitlement: access(),
    listing: null as LandlordListingDto | null,
    failLogin: false,
    failRead: false,
    failSave: false,
    failUpload: false,
    googleProvider: true,
    readGate: null as Promise<void> | null,
    saveGate: null as Promise<void> | null,
    writes: [] as Array<{ path: string; method: string; body: unknown }>,
    uploads: 0,
  };
  function session(): AuthSession {
    return {
      accessToken: "browser-fixture-access-token",
      accessTokenExpiresInSeconds: 900,
      user: {
        id: "00000000-0000-4000-8000-000000000044",
        email: "renter@example.test",
        role: state.onboarding.role,
        preferredLocale: "KM",
        onboardingComplete: state.onboarding.profileComplete,
      },
    };
  }
  await page.route("http://127.0.0.1:3102/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();
    const send = (data: unknown, status = 200) =>
      route.fulfill({ status, json: data });
    const error = (code: string, status = 503) =>
      send({ error: { code, message: "Please try again." } }, status);
    if (method !== "GET" && path !== "/auth/refresh") {
      state.writes.push({
        path,
        method,
        body: request.postData() ? (request.postDataJSON() as unknown) : null,
      });
    }
    if (path === "/auth/register" || path === "/auth/login") {
      if (state.failLogin) return error("INVALID_CREDENTIALS", 401);
      state.signedIn = true;
      return send({ data: session() }, path === "/auth/register" ? 201 : 200);
    }
    if (path === "/auth/providers")
      return send({ data: { google: state.googleProvider } });
    if (path.startsWith("/auth/google/"))
      return send(
        { error: { code: "OAUTH_NOT_CONFIGURED", message: "Not configured." } },
        503,
      );
    if (path === "/auth/refresh")
      return state.signedIn
        ? send({ data: session() })
        : error("SESSION_REQUIRED", 401);
    if (path === "/me/onboarding") return send({ data: state.onboarding });
    if (path === "/me/onboarding/role") {
      const input = request.postDataJSON() as { role: "STUDENT" | "LANDLORD" };
      state.onboarding = onboarding(input.role, input.role === "STUDENT");
      return send({ data: state.onboarding });
    }
    if (path === "/landlord/onboarding") {
      state.onboarding = onboarding("LANDLORD");
      return send({
        data: {
          onboarding: state.onboarding,
          successNextPath: "/landlord/listings/new",
          profile: {
            userId: session().user.id,
            displayName: "Rental owner",
            businessName: null,
            contactPhone: "012345678",
            contactTelegram: null,
            verificationStatus: "UNVERIFIED",
          },
          entitlement: { landlordId: session().user.id, ...state.entitlement },
        },
      });
    }
    if (path === "/landlord/entitlement") {
      await state.readGate;
      return state.failRead
        ? error("REQUEST_FAILED")
        : send({ data: state.entitlement });
    }
    if (path === "/amenities") return send({ data: [amenity] });
    if (path === "/landlord/inquiries" || path === "/me/favorites") {
      return send({
        data: [],
        meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
      });
    }
    if (path === "/landlord/listings" && method === "GET") {
      return send({
        data: state.listing ? [state.listing] : [],
        meta: {
          page: 1,
          pageSize: 6,
          total: state.listing ? 1 : 0,
          totalPages: state.listing ? 1 : 0,
        },
      });
    }
    if (path === "/landlord/listings" && method === "POST") {
      if (state.failSave) return error("LANDLORD_ENTITLEMENT_REQUIRED", 403);
      const input = request.postDataJSON() as CreateLandlordListingInput;
      const base = ownedRental();
      state.listing = {
        ...base,
        ...input,
        property: { ...base.property, ...input.property },
      };
      return send({ data: state.listing }, 201);
    }
    if (path === `/landlord/listings/${listingId}`) {
      if (!state.listing) return error("LISTING_NOT_FOUND", 404);
      if (method === "PATCH") {
        if (state.failSave) return error("REQUEST_FAILED");
        const input = request.postDataJSON() as UpdateLandlordListingInput;
        state.listing = {
          ...state.listing,
          ...input,
          property: { ...state.listing.property, ...input.property },
        };
      }
      return send({ data: state.listing });
    }
    if (
      path === `/landlord/listings/${listingId}/availability` &&
      method === "PATCH"
    ) {
      await state.saveGate;
      if (state.failSave) return error("REQUEST_FAILED");
      if (!state.listing) return error("LISTING_NOT_FOUND", 404);
      const input = request.postDataJSON() as { availableUnits: number };
      const now = Date.now();
      state.listing = {
        ...state.listing,
        availableUnits: input.availableUnits,
        availabilityConfirmedAt: new Date(now).toISOString(),
        availabilityFreshness: {
          state: "FRESH",
          remindAt: new Date(now + 7 * 86400000).toISOString(),
          expiresAt: new Date(now + 14 * 86400000).toISOString(),
        },
      };
      return send({ data: state.listing });
    }
    if (path === `/landlord/listings/${listingId}/submit`) {
      if (!state.listing)
        throw new Error("Submission must follow draft creation.");
      state.listing.status = "PENDING_REVIEW";
      return send({ data: state.listing });
    }
    if (path === "/media/upload-intents") {
      const input = request.postDataJSON() as { sortOrder: number };
      const media: ListingImageDto = {
        id: `00000000-0000-4000-8000-${String(state.uploads++).padStart(12, "0")}`,
        listingId,
        publicUrl: "https://images.example.test/room.png",
        altTextKm: null,
        altTextEn: null,
        width: 1,
        height: 1,
        sortOrder: input.sortOrder,
        status: "UPLOADING",
      };
      mediaById.set(media.id, media);
      return send({
        data: {
          media,
          upload: {
            url: "http://127.0.0.1:3102/test-upload",
            method: "PUT",
            headers: { "content-type": "image/png" },
            expiresAt: "2099-01-01T00:00:00Z",
            maxBytes: 10485760,
          },
        },
      });
    }
    if (path.startsWith("/media/")) {
      const id = path.split("/")[2] ?? "";
      const media = mediaById.get(id);
      if (!media) throw new Error("Media mutation requires an upload intent.");
      if (method === "DELETE") {
        mediaById.delete(id);
        return send({ data: { ...media, status: "REMOVED" } });
      }
      if (method === "POST" && path.endsWith("/finalize")) {
        if (!state.listing) throw new Error("Photos require a saved listing.");
        const input = request.postDataJSON() as {
          altTextKm?: string;
          altTextEn?: string;
        };
        const ready: ListingImageDto = { ...media, ...input, status: "READY" };
        mediaById.set(id, ready);
        state.listing.images = [...state.listing.images, ready];
        return send({ data: ready });
      }
      throw new Error(`Unhandled media fixture: ${method} ${path}`);
    }
    if (
      path.startsWith("/landlord/") ||
      path.startsWith("/auth/") ||
      path.startsWith("/me/onboarding")
    ) {
      throw new Error(`Unhandled supply fixture: ${method} ${path}`);
    }
    return route.fallback();
  });
  await page.route("http://127.0.0.1:3102/test-upload", (route) =>
    route.fulfill({ status: state.failUpload ? 503 : 200, body: "" }),
  );
  return state;
}

export async function rentalBasics(page: Page) {
  await page
    .getByLabel("Property or rental name", { exact: true })
    .fill("University rooms");
  await page.getByLabel("Listing title in Khmer").fill(titleKm);
  await page.getByLabel("Monthly rent", { exact: true }).fill("95");
  await page.getByLabel("Total rooms or units").fill("3");
  await page.getByLabel("Available now", { exact: true }).fill("2");
}

export async function rentalReview(page: Page) {
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByText(
      "Map preview is off. Enter coordinates below to keep going.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Address students can recognize")
    .fill("Street 138, Phnom Penh");
  await page.getByLabel("Latitude", { exact: true }).fill("11.569");
  await page.getByLabel("Longitude", { exact: true }).fill("104.8914");
  await expect(
    page.getByText(/Selected coordinates 11.569000, 104.891400/),
  ).toContainText("2 rooms available");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Description in English")
    .fill("Quiet room with space to study.");
  await page.getByRole("checkbox", { name: /Wi-Fi/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeVisible();
}

export function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
