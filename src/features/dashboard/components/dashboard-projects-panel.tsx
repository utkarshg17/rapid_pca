export function DashboardProjectsPanel() {
  return (
    <section className="rounded-3xl border border-white/10 bg-neutral-950 p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-white/45">
        Projects
      </p>

      <h1 className="mt-4 text-4xl font-semibold">Projects</h1>

      <p className="mt-4 max-w-2xl text-white/65">
        This section will show the projects available to the logged-in user.
        Admin users will be able to see all projects.
      </p>
    </section>
  );
}