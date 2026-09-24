import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface GoogleOAuthStatePayload {
  /** Path on the web origin to continue to after sign-in. */
  next: string | null;
  /** Random value that makes every authorization request unique. */
  nonce: string;
  /** Unix seconds after which the state is refused. */
  expiresAt: number;
}

const STATE_TTL_SECONDS = 600;

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function signature(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function isSafeNextPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return false;
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return false;
  }
  return !Array.from(value).some((character) => character.charCodeAt(0) <= 32);
}

/**
 * Creates a signed, expiring OAuth state value.
 *
 * The payload travels through Google and comes back on the callback URL, so it
 * is signed with a server secret instead of trusted as-is. Only relative paths
 * on this application are accepted as the post-sign-in destination, which keeps
 * the flow from being used as an open redirect.
 */
export function createGoogleOAuthState(
  secret: string,
  options: { next?: string | null; now?: Date } = {},
): string {
  const now = options.now ?? new Date();
  const payload: GoogleOAuthStatePayload = {
    next: isSafeNextPath(options.next) ? options.next : null,
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Math.floor(now.getTime() / 1000) + STATE_TTL_SECONDS,
  };
  const body = base64Url(JSON.stringify(payload));
  return `${body}.${signature(secret, body)}`;
}

export function verifyGoogleOAuthState(
  secret: string,
  state: string,
  now: Date = new Date(),
): GoogleOAuthStatePayload | null {
  const [body, provided] = state.split(".");
  if (!body || !provided) return null;

  const expected = signature(secret, body);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;

  const candidate = payload as Partial<GoogleOAuthStatePayload>;
  if (
    typeof candidate.nonce !== "string" ||
    candidate.nonce.length < 8 ||
    typeof candidate.expiresAt !== "number" ||
    !Number.isFinite(candidate.expiresAt)
  ) {
    return null;
  }
  if (candidate.expiresAt <= Math.floor(now.getTime() / 1000)) return null;

  return {
    next: isSafeNextPath(candidate.next) ? candidate.next : null,
    nonce: candidate.nonce,
    expiresAt: candidate.expiresAt,
  };
}
