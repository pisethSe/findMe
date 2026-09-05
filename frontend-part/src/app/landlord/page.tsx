import type { Metadata } from "next";

import { LandlordWorkspace } from "../../features/landlord/landlord-workspace";

export const metadata: Metadata = {
  title: "Rental dashboard",
  description:
    "Manage your FindMe rentals, availability, and student inquiries.",
  robots: { index: false, follow: false },
};

export default function LandlordPage() {
  return <LandlordWorkspace />;
}
