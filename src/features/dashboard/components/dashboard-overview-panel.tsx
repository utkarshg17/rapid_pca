type DashboardOverviewPanelProps = {
  firstName?: string | null;
};

export function DashboardOverviewPanel({
  firstName,
}: DashboardOverviewPanelProps) {
  const welcomeText = firstName ? `Welcome ${firstName}!` : "Welcome!";

  return (
    <section className="rounded-3xl border border-white/10 bg-neutral-950 p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-white/45">
        Dashboard
      </p>

      <h1 className="mt-4 text-4xl font-semibold">{welcomeText}</h1>

      <p className="mt-4 max-w-2xl text-white/65">
        You are now inside Rapid PCA. This dashboard will become the home for
        field updates, office visibility, and construction data management.
      </p>
    </section>
  );
}