"use client";

import { Localized } from "../../features/preferences/translated-text";
export default function LandlordError({ reset }: { reset: () => void }) {
  return (
    <Localized>
      <main className="landlord-dashboard-page" lang="en">
        <section className="dashboard-error dashboard-route-error" role="alert">
          <h1>The landlord dashboard could not open</h1>
          <p>
            Your rental data has not been changed. Try loading the page again.
          </p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </section>
      </main>
    </Localized>
  );
}
