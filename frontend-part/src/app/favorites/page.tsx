import type { Metadata } from "next";
import { SavedRentals } from "../../features/favorites/saved-rentals";

export const metadata: Metadata = {
  title: "Saved rentals",
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return <SavedRentals />;
}
