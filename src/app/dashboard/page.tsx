import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageShell } from "@/components/layout/page-shell";

export default function DashboardPage() {
  return (
    <PageShell>
      <DashboardHeader />

      <section className="px-6 py-12 md:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">
            Dashboard
          </p>

          <h1 className="mt-4 text-4xl font-semibold">Welcome</h1>

          <p className="mt-4 max-w-2xl text-white/65">
            You are now inside Rapid PCA. This dashboard will become the home
            for field updates, office visibility, and construction data
            management.
          </p>
        </div>
      </section>
    </PageShell>
  );
}