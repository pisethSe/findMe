"use client";

import Link from "next/link";
import { useEffect } from "react";

interface SearchErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SearchError({ error, reset }: SearchErrorProps) {
  useEffect(() => {
    console.error("Rental search failed", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="route-error">
      <div>
        <p className="hero-context">Search unavailable</p>
        <h1>We couldn’t load nearby rooms.</h1>
        <p>
          Your filters are safe. Try the search again, or return to the landing
          page and choose your university once more.
        </p>
        <div className="error-actions">
          <button type="button" onClick={reset}>
            Try again
          </button>
          <Link href="/">Return home</Link>
        </div>
      </div>
    </main>
  );
}
