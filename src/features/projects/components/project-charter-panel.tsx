import type { ProjectRecord } from "@/features/projects/types/project";
import { formatDisplayDate } from "@/lib/date-format";

type ProjectCharterPanelProps = {
  project: ProjectRecord;
  onEditProject?: () => void;
};

export function ProjectCharterPanel({
  project,
  onEditProject,
}: ProjectCharterPanelProps) {
  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Project Charter
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Project Details</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Review the core project profile, structural details, and site
              information for this project.
            </p>
          </div>

          {onEditProject ? (
            <button
              type="button"
              onClick={onEditProject}
              className="rounded-full border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-5 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer"
            >
              Edit Project
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <InfoCard label="Project Code" value={project.project_code} />
        <InfoCard
          label="Project Type"
          value={project.project_type_options?.type_name ?? "N/A"}
        />
        <InfoCard
          label="Expected Start Date"
          value={formatDate(project.expected_start_date)}
        />
        <InfoCard label="Location" value={formatLocation(project)} />
        <InfoCard label="Client Name" value={project.client_name ?? "N/A"} />
        <InfoCard
          label="Project Manager"
          value={project.project_manager ?? "N/A"}
        />
        <InfoCard label="Architect" value={project.architect ?? "N/A"} />
        <InfoCard
          label="Site In-Charge"
          value={project.site_incharge ?? "N/A"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <InfoCard label="Plot Area" value={formatArea(project.plot_area)} />
        <InfoCard
          label="Project Footprint"
          value={formatArea(project.project_footprint)}
        />
        <InfoCard
          label="Basements"
          value={formatCount(project.basement_count)}
        />
        <InfoCard label="Stilt" value={formatCount(project.stilt_count)} />
        <InfoCard label="Podium" value={formatCount(project.podium_count)} />
        <InfoCard label="Floors" value={formatCount(project.floor_count)} />
        <InfoCard
          label="Foundation Type"
          value={project.foundation_type ?? "N/A"}
        />
        <InfoCard
          label="Super-structure Type"
          value={project.super_structure_type ?? "N/A"}
        />
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
          Site Address
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {project.site_address ?? "No site address has been added yet."}
        </p>
      </div>
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-5 shadow-[var(--shadow-md)]">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </p>
      <p className="mt-2 text-base font-medium text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function formatDate(dateValue: string | null) {
  return formatDisplayDate(dateValue, "N/A");
}

function formatLocation(project: ProjectRecord) {
  const parts = [project.city, project.state, project.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}

function formatArea(value: number | null) {
  return value === null ? "N/A" : `${value} sq.ft`;
}

function formatCount(value: number | null) {
  return value === null ? "N/A" : String(value);
}
