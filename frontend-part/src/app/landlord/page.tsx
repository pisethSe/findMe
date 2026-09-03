import type { Metadata } from "next";

import { LandlordWorkspace } from "../../features/landlord/landlord-workspace";

export const metadata: Metadata = {
  title: "Landlord workspace",
  robots: { index: false, follow: false },
};

export default function LandlordPage() {
  return <LandlordWorkspace />;
}
