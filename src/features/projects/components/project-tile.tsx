import Link from "next/link";

import type { ProjectRecord } from "@/features/projects/types/project";
import { formatDisplayDate } from "@/lib/date-format";

type ProjectTileProps = {
  project: ProjectRecord;
};

function formatDate(dateValue: string | null) {
  return formatDisplayDate(dateValue, "N/A");
}

function formatLocation(project: ProjectRecord) {
  const parts = [project.city, project.state, project.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}

export function ProjectTile({ project }: ProjectTileProps) {
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--foreground)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]"
    >
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-5 text-[var(--foreground)] shadow-[var(--shadow-md)] transition duration-200 ease-out group-hover:-translate-y-1 group-hover:border-[var(--border-strong)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{project.project_name}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {project.project_code}
            </p>
          </div>

          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">
            {project.project_type_options?.type_name ?? "N/A"}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoBlock
            label="Expected Start Date"
            value={formatDate(project.expected_start_date)}
          />
          <InfoBlock label="Location" value={formatLocation(project)} />
          <InfoBlock label="Client Name" value={project.client_name || "N/A"} />
          <InfoBlock
            label="Project Manager"
            value={project.project_manager || "N/A"}
          />
        </div>
      </div>
    </Link>
  );
}

type InfoBlockProps = {
  label: string;
  value: string;
};

function InfoBlock({ label, value }: InfoBlockProps) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </p>
      <p className="mt-1 text-sm text-[var(--foreground)]">{value}</p>
    </div>
  );
}
