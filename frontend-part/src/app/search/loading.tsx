export default function SearchLoading() {
  return (
    <main
      className="search-page"
      lang="en"
      aria-busy="true"
      aria-label="Loading rentals"
    >
      <div className="search-loading-header" />
      <section className="search-loading-layout">
        <div>
          <div className="skeleton skeleton-label" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
        </div>
        <div className="skeleton skeleton-filter" />
      </section>
      <section className="search-loading-results">
        <p>Loading nearby rooms…</p>
        <div
          className="published-search-layout search-results-loading"
          aria-hidden="true"
        >
          <div className="skeleton loading-map" />
          <div className="loading-card-grid">
            <div className="skeleton loading-card" />
            <div className="skeleton loading-card" />
            <div className="skeleton loading-card" />
          </div>
        </div>
      </section>
    </main>
  );
}
