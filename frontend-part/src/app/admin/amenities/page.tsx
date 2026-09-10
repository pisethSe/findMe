import type { Metadata } from "next";
import { AdminCatalog } from "../../../features/admin/admin-catalog";
export const metadata: Metadata = {
  title: "Admin amenities",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminCatalog kind="amenities" />;
}
