import type { Metadata } from "next";
import { InquiryInbox } from "../../../features/inquiries/inquiry-inbox";
export const metadata: Metadata = {
  title: "Student inquiries",
  robots: { index: false, follow: false },
};
export default function LandlordInquiriesPage() {
  return <InquiryInbox role="LANDLORD" />;
}
