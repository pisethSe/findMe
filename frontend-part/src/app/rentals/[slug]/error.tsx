"use client";

import Link from "next/link";

export default function RentalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="rental-route-state" lang="en">
      <div role="alert">
        <h1>We could not load this rental</h1>
        <p>
          The service may be temporarily unavailable. Try again, or return to
          search to choose a current rental.
        </p>
      </div>
      <button type="button" onClick={retry}>
        Try again
      </button>
      <Link href="/search">Return to search</Link>
    </main>
  );
}
