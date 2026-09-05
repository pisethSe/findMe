"use client";

import Link from "next/link";

export default function EditRentalError({ reset }: { reset: () => void }) {
  return (
    <main className="rental-form-page" lang="en">
      <section
        className="rental-form-message-panel rental-route-error"
        role="alert"
      >
        <h1>The rental editor could not open.</h1>
        <p>Your saved rental is unchanged. Try opening the editor again.</p>
        <div className="rental-success-actions">
          <button
            className="rental-primary-button"
            type="button"
            onClick={reset}
          >
            Try again
          </button>
          <Link className="rental-secondary-button" href="/landlord">
            Return to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
