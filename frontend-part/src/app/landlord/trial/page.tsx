import type { Metadata } from "next";

import { LandlordAccessPage } from "../../../features/landlord/landlord-access-page";

export const metadata: Metadata = {
  title: "Landlord access",
  robots: { index: false, follow: false },
};

export default function LandlordTrialPage() {
  return <LandlordAccessPage />;
}
