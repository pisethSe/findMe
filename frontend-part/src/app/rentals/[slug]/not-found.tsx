import Link from "next/link";

export default function RentalNotFound() {
  return (
    <main className="rental-route-state" lang="en">
      <h1>This rental is unavailable</h1>
      <p>
        It may no longer be listed, or the link may be incorrect. Browse current
        rentals near your institution.
      </p>
      <Link href="/search">Find available rentals</Link>
    </main>
  );
}
