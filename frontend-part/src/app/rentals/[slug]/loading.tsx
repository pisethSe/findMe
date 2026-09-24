"use client";

import { Localized } from "../../../features/preferences/translated-text";
export default function RentalLoading() {
  return (
    <Localized>
      <main className="rental-route-state" lang="en" aria-busy="true">
        <h1>Rental details</h1>
        <p role="status">Loading photos, price, and current availability…</p>
        <div className="rental-loading-photo" aria-hidden="true" />
      </main>
    </Localized>
  );
}
