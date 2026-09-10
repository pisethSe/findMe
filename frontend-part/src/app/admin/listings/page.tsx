import type { Metadata } from "next";
import { AdminSafetyWorkspace } from "../../../features/admin/admin-safety-workspace";
export const metadata: Metadata = {
  title: "Admin listings",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; query?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminSafetyWorkspace
      section="listings"
      listingId={typeof params.id === "string" ? params.id : undefined}
      initialSearch={
        typeof params.query === "string" ? params.query : undefined
      }
    />
  );
}
