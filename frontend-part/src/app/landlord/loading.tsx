export default function LandlordLoading() {
  return (
    <main className="landlord-dashboard-page" lang="en">
      <div
        className="dashboard-route-loading"
        aria-busy="true"
        aria-live="polite"
      >
        Loading landlord dashboard…
      </div>
    </main>
  );
}
