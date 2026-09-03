import type { Metadata } from "next";

import { AdminWorkspace } from "../../features/admin/admin-workspace";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminWorkspace />;
}
