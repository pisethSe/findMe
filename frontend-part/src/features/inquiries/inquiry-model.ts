import type { InquiryStatus } from "@findme/contracts";

export const INQUIRY_MESSAGE_MAX = 2000;
export type EditableInquiryStatus = Exclude<InquiryStatus, "NEW">;

export function inquiryStatusLabel(status: InquiryStatus): string {
  return {
    NEW: "Sent",
    READ: "Read",
    RESPONDED: "Marked replied",
    CLOSED: "Closed",
  }[status];
}

export function allowedInquiryStatuses(
  status: InquiryStatus,
): readonly EditableInquiryStatus[] {
  switch (status) {
    case "NEW":
      return ["READ", "RESPONDED", "CLOSED"];
    case "READ":
      return ["RESPONDED", "CLOSED"];
    case "RESPONDED":
      return ["CLOSED"];
    case "CLOSED":
      return [];
  }
}

export function inquiryMessageError(message: string): string | null {
  if (!message.trim()) return "Write a message before sending your inquiry.";
  if (Array.from(message.trim()).length > INQUIRY_MESSAGE_MAX)
    return "Keep your message to 2,000 characters or fewer.";
  return null;
}
