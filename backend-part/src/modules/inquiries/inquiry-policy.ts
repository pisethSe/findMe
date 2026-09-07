import { ConflictException, HttpException, HttpStatus } from "@nestjs/common";
import type { InquiryStatus } from "../../generated/prisma/client.js";

export const INQUIRY_HOUR_LIMIT = 10;
export const INQUIRY_HOUR_MS = 60 * 60 * 1000;
export const INQUIRY_LISTING_COOLDOWN_MS = 60 * 1000;

export function assertInquiryTransition(
  current: InquiryStatus,
  next: InquiryStatus,
): void {
  const order: Record<InquiryStatus, number> = {
    NEW: 0,
    READ: 1,
    RESPONDED: 2,
    CLOSED: 3,
  };
  if (order[next] < order[current]) {
    throw new ConflictException({
      code: "INQUIRY_STATUS_CONFLICT",
      message:
        "This inquiry has already moved past that status. Refresh your inbox.",
    });
  }
}

export function inquiryRateLimitError(): HttpException {
  return new HttpException(
    {
      code: "INQUIRY_RATE_LIMITED",
      message:
        "Wait at least one minute between inquiries about the same rental. You can send up to 10 inquiries per hour.",
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function assertInquiryRateLimit(
  recent: readonly { listingId: string; createdAt: Date }[],
  listingId: string,
  now: Date,
): void {
  const inWindow = recent.filter(
    (item) => item.createdAt.getTime() > now.getTime() - INQUIRY_HOUR_MS,
  );
  if (
    inWindow.length >= INQUIRY_HOUR_LIMIT ||
    inWindow.some(
      (item) =>
        item.listingId === listingId &&
        item.createdAt.getTime() > now.getTime() - INQUIRY_LISTING_COOLDOWN_MS,
    )
  )
    throw inquiryRateLimitError();
}
