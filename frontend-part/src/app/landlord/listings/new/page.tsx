import type { Metadata } from "next";

import { GuidedRentalForm } from "../../../../features/landlord-listings/guided-rental-form";

export const metadata: Metadata = {
  title: "Add a rental",
  description:
    "Create a private student-rental draft and submit it for review.",
  robots: { index: false, follow: false },
};

export default function NewLandlordListingPage() {
  return <GuidedRentalForm />;
}
