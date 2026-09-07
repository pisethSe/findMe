import type { Metadata } from "next";
import { InquiryInbox } from "../../features/inquiries/inquiry-inbox";
export const metadata: Metadata = {
  title: "Sent inquiries",
  robots: { index: false, follow: false },
};
export default function SentInquiriesPage() {
  return <InquiryInbox role="STUDENT" />;
}
