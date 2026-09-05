export default function EditRentalLoading() {
  return (
    <main className="rental-form-page" lang="en">
      <div className="rental-route-loading" aria-busy="true" aria-live="polite">
        <p>Opening your rental…</p>
        <div className="skeleton rental-loading-title" />
        <div className="skeleton rental-loading-field" />
        <div className="skeleton rental-loading-field" />
      </div>
    </main>
  );
}
