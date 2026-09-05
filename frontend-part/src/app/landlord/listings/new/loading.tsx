export default function NewRentalLoading() {
  return (
    <main className="rental-form-page">
      <div className="rental-route-loading" aria-busy="true" aria-live="polite">
        <p>Opening the rental form…</p>
        <div className="skeleton rental-loading-title" />
        <div className="skeleton rental-loading-field" />
        <div className="skeleton rental-loading-field" />
      </div>
    </main>
  );
}
