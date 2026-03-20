export function DashboardReportsPanel() {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-[var(--shadow-lg)]">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--subtle)]">
        Reports
      </p>

      <h1 className="mt-4 text-4xl font-semibold">Reports</h1>

      <p className="mt-4 max-w-2xl text-[var(--muted)]">
        This section will allow users to view and generate project reports.
        Later, we can add predefined report templates and filters here.
      </p>
    </section>
  );
}
