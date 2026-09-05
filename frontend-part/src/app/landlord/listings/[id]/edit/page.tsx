import type { Metadata } from "next";

import { GuidedRentalForm } from "../../../../../features/landlord-listings/guided-rental-form";

export const metadata: Metadata = {
  title: "Edit rental",
  description: "Update an owned FindMe rental.",
  robots: { index: false, follow: false },
};

export default async function EditLandlordListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuidedRentalForm listingId={id} />;
}
