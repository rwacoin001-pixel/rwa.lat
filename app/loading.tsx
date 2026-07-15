export default function Loading() {
  return (
    <main className="system-state-page" aria-busy="true" aria-label="Loading RWA.LAT">
      <section className="system-state-card system-state-card--loading">
        <div className="loading-orbit" aria-hidden="true"><i /><i /><span /></div>
        <p>RWA.LAT · SECURE WORKSPACE</p>
        <h1>Preparing your market view.</h1>
        <small>Loading the protected interface and the latest available Demo data.</small>
        <div className="loading-rail" aria-hidden="true"><i /></div>
      </section>
    </main>
  )
}
