import { SetMetadata } from "@nestjs/common";

export interface RateLimitWindow {
  limit: number;
  seconds: number;
}

export interface RateLimitPolicy {
  ip: RateLimitWindow;
  user?: RateLimitWindow;
  email?: RateLimitWindow;
  failClosed: boolean;
}

// Request budgets include invalid attempts and retries. Successful inquiry/report
// budgets remain enforced separately against committed PostgreSQL records.
export const RATE_LIMIT_POLICIES = {
  registration: { ip: { limit: 10, seconds: 3600 }, failClosed: true },
  login: {
    ip: { limit: 30, seconds: 900 },
    email: { limit: 10, seconds: 900 },
    failClosed: true,
  },
  passwordResetRequest: {
    ip: { limit: 10, seconds: 3600 },
    email: { limit: 3, seconds: 3600 },
    failClosed: true,
  },
  passwordReset: { ip: { limit: 10, seconds: 900 }, failClosed: true },
  sessionRefresh: { ip: { limit: 120, seconds: 60 }, failClosed: true },
  search: { ip: { limit: 120, seconds: 60 }, failClosed: false },
  catalog: { ip: { limit: 240, seconds: 60 }, failClosed: false },
  listingRead: { ip: { limit: 600, seconds: 60 }, failClosed: false },
  inquiry: {
    ip: { limit: 120, seconds: 60 },
    user: { limit: 60, seconds: 60 },
    failClosed: false,
  },
  report: {
    ip: { limit: 120, seconds: 60 },
    user: { limit: 30, seconds: 60 },
    failClosed: false,
  },
  uploadIntent: {
    ip: { limit: 120, seconds: 600 },
    user: { limit: 30, seconds: 600 },
    failClosed: true,
  },
  mediaFinalize: {
    ip: { limit: 120, seconds: 600 },
    user: { limit: 60, seconds: 600 },
    failClosed: true,
  },
  adminWrite: {
    ip: { limit: 120, seconds: 60 },
    user: { limit: 30, seconds: 60 },
    failClosed: true,
  },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
export const RATE_LIMIT_METADATA = "findme:rate-limit";
export const RateLimit = (policy: RateLimitPolicyName) =>
  SetMetadata(RATE_LIMIT_METADATA, policy);
