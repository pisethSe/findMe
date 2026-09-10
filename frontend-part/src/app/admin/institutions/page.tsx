import type { Metadata } from "next";
import { AdminCatalog } from "../../../features/admin/admin-catalog";
export const metadata: Metadata = {
  title: "Admin institutions",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminCatalog kind="institutions" />;
}
