"use client";

import Link from "next/link";

export default function NewRentalError({ reset }: { reset: () => void }) {
  return (
    <main className="rental-form-page">
      <section
        className="rental-form-message-panel rental-route-error"
        role="alert"
      >
        <h1>The rental form could not open.</h1>
        <p>Your saved rentals are unchanged. Try opening the form again.</p>
        <div className="rental-success-actions">
          <button
            className="rental-primary-button"
            type="button"
            onClick={reset}
          >
            Try again
          </button>
          <Link className="rental-secondary-button" href="/landlord">
            Return to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
