import type { ProjectRecord } from "@/features/projects/types/project";

type ProjectTileProps = {
  project: ProjectRecord;
};

function formatDate(dateValue: string | null) {
  if (!dateValue) return "—";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString();
}

function formatLocation(project: ProjectRecord) {
  const parts = [project.city, project.state, project.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function ProjectTile({ project }: ProjectTileProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{project.project_name}</h3>
          <p className="mt-1 text-sm text-white/65">{project.project_code}</p>
        </div>

        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80">
          {project.project_type_options?.type_name ?? "—"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoBlock label="Expected Start Date" value={formatDate(project.expected_start_date)} />
        <InfoBlock label="Location" value={formatLocation(project)} />
        <InfoBlock label="Client Name" value={project.client_name || "—"} />
        <InfoBlock label="Project Manager" value={project.project_manager || "—"} />
      </div>
    </div>
  );
}

type InfoBlockProps = {
  label: string;
  value: string;
};

function InfoBlock({ label, value }: InfoBlockProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
        {label}
      </p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}