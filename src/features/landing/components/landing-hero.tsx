import Link from "next/link";

const capabilityCards = [
  {
    eyebrow: "Labour tracking",
    title: "Turn attendance into labour cost clarity.",
    description:
      "Record site attendance, connect workers to crews, and understand what every project is spending on labour each day.",
    points: ["Daily attendance", "Crew-wise costs", "Project labour totals"],
  },
  {
    eyebrow: "Monthly reports",
    title: "Prepare month-end labour reports without rebuilding sheets.",
    description:
      "Keep muster roll data organized through the month so reporting becomes a simple review instead of a last-minute chase.",
    points: ["Muster roll reports", "Month-end summaries", "Cleaner payroll checks"],
  },
  {
    eyebrow: "Simple schedules",
    title: "Create a project schedule without a steep learning curve.",
    description:
      "Plan activities in plain language, update progress as work moves, and keep the team aligned without heavy project-management software.",
    points: ["Activity planning", "Progress updates", "Easy site coordination"],
  },
  {
    eyebrow: "Cost control",
    title: "Track project costs, budgets, and estimates in one place.",
    description:
      "Follow labour, materials, quantities, and budget movement together so cost decisions are based on current project data.",
    points: ["Budget planning", "Cost tracking", "Estimate visibility"],
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Create the project",
    description:
      "Add the project details once, then keep the site team and office team working from the same record.",
  },
  {
    step: "02",
    title: "Update daily work",
    description:
      "Capture attendance, labour entries, quantities, production notes, and site updates as the work happens.",
  },
  {
    step: "03",
    title: "Review costs and reports",
    description:
      "Use the saved data to review labour costs, project budgets, schedules, and monthly reports with less manual cleanup.",
  },
];

const dashboardStats = [
  { label: "Attendance linked", value: "Daily" },
  { label: "Reports ready", value: "Month end" },
  { label: "Schedule view", value: "Simple" },
];

export function LandingHero() {
  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),linear-gradient(180deg,var(--panel-soft),transparent)]" />
      <div className="absolute left-1/2 top-24 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[rgba(245,158,11,0.12)] blur-3xl" />

      <section className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-7xl items-center gap-12 px-6 py-16 md:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--subtle)]">
            Construction project control
          </p>

          <h1
            className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] md:text-7xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Run your site records, labour costs, schedules, and budgets from one
            clear place.
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--muted)] md:text-lg">
            Rapid PCA helps construction teams prepare attendance-based labour
            cost trackers, month-end labour reports, simple schedules, project
            budgets, and cost visibility without making the process complicated.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-6 py-3 text-sm font-semibold text-[var(--inverse-fg)] transition duration-200 ease-out hover:scale-[1.02] hover:opacity-95"
            >
              Start organizing projects
            </Link>
            <a
              href="#what-you-can-do"
              className="inline-flex items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition duration-200 ease-out hover:border-[var(--foreground)]"
            >
              See what it does
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(14,165,233,0.12),transparent)] blur-xl" />
          <div className="rounded-[2rem] border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_82%,transparent)] p-4 shadow-[var(--shadow-lg)] backdrop-blur">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--subtle)]">
                    Project snapshot
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Site cost board
                  </h2>
                </div>
                <span className="rounded-full bg-[var(--status-success-bg)] px-3 py-1 text-xs font-semibold text-[var(--status-success-fg)]">
                  Live record
                </span>
              </div>

              <div className="grid gap-3 py-5 sm:grid-cols-3">
                {dashboardStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4"
                  >
                    <p className="text-xs text-[var(--subtle)]">{stat.label}</p>
                    <p className="mt-2 text-lg font-semibold">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  ["Labour cost tracker", "Attendance updates costing"],
                  ["Monthly labour report", "Muster roll data ready"],
                  ["Budget watch", "Labour and material movement"],
                ].map(([title, detail]) => (
                  <div
                    key={title}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-1 text-sm text-[var(--subtle)]">
                        {detail}
                      </p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="what-you-can-do"
        className="mx-auto w-full max-w-7xl px-6 pb-20 md:px-10"
      >
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--subtle)]">
              What you can do
            </p>
            <h2
              className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Simple tools for the work construction teams repeat every week.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-[var(--muted)]">
            The goal is not to make your team learn a complex system. It is to
            make daily records useful for cost control, planning, and reporting.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {capabilityCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-[1.75rem] border border-[var(--border)] bg-[var(--panel-soft)] p-6 transition duration-200 ease-out hover:-translate-y-1 hover:border-[var(--border-strong)] hover:bg-[var(--panel-strong)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--status-warning-fg)]">
                {card.eyebrow}
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                {card.title}
              </h3>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {card.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {card.points.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)]"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-24 md:px-10">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,var(--panel-strong),var(--panel-soft))] p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--subtle)]">
                How it fits your day
              </p>
              <h2
                className="mt-3 text-4xl font-semibold tracking-[-0.04em] md:text-5xl"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                From site entry to office report, keep the path short.
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {workflowSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-5"
                >
                  <span className="text-xs font-semibold text-[var(--status-warning-fg)]">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
