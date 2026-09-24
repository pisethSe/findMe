"use client";

import { Localized } from "../../../../../features/preferences/translated-text";
export default function EditRentalLoading() {
  return (
    <Localized>
      <main className="rental-form-page" lang="en">
        <div
          className="rental-route-loading"
          aria-busy="true"
          aria-live="polite"
        >
          <p>Opening your rental…</p>
          <div className="skeleton rental-loading-title" />
          <div className="skeleton rental-loading-field" />
          <div className="skeleton rental-loading-field" />
        </div>
      </main>
    </Localized>
  );
}
