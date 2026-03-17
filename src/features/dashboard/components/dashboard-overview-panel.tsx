type DashboardOverviewPanelProps = {
  firstName?: string | null;
};

export function DashboardOverviewPanel({
  firstName,
}: DashboardOverviewPanelProps) {
  return (
    <section className="space-y-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-white/45">
          Dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Welcome{firstName ? `, ${firstName}!` : "!"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/60">
          This is your central workspace for projects, reporting, and future
          construction operations tools.
        </p>
      </div>
    </section>
  );
}