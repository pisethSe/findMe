import type { Metadata } from "next";
import { DirectoryPage } from "../../features/landing/directory-page";
export const metadata: Metadata = { title: "Cambodian university directory" };
export default function UniversitiesPage() {
  return <DirectoryPage />;
}
