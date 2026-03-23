"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  getCurrentUserProfile,
  type UserProfile,
} from "@/features/auth/services/get-current-user-profile";
import { EditProjectDialog } from "@/features/projects/components/edit-project-dialog";
import { ProjectAccessPanel } from "@/features/projects/components/project-access-panel";
import { UnitQuantitiesPanel } from "@/features/projects/components/unit-quantities-panel";
import { getProjectById } from "@/features/projects/services/get-project-by-id";
import type { ProjectRecord } from "@/features/projects/types/project";

type ProjectWorkspaceTab =
  | "overview"
  | "production-log"
  | "resources"
  | "unit-quantities"
  | "project-access";

type ProjectSidebarProps = {
  activeTab: ProjectWorkspaceTab;
  onTabChange: (tab: ProjectWorkspaceTab) => void;
  project: ProjectRecord | null;
};

type ProjectOverviewPanelProps = {
  project: ProjectRecord;
};

type ProjectPlaceholderPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
};

const tabs: { key: ProjectWorkspaceTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "production-log", label: "Production Log" },
  { key: "resources", label: "Resources" },
  { key: "unit-quantities", label: "Unit Quantities" },
  { key: "project-access", label: "Project Access" },
];

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const rawProjectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId;
  const projectId = Number(rawProjectId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProjectWorkspaceTab>("overview");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      setProject(null);
      setIsLoading(false);
      return;
    }

    async function loadWorkspace() {
      setIsLoading(true);

      try {
        const [currentProfile, projectRecord] = await Promise.all([
          getCurrentUserProfile(),
          getProjectById(projectId),
        ]);

        setProfile(currentProfile);
        setProject(projectRecord);
      } catch (error) {
        console.error("Failed to load project workspace:", error);
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, [projectId]);

  function renderMainPanel() {
    if (isLoading) {
      return (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
          Loading project workspace...
        </div>
      );
    }

    if (!Number.isFinite(projectId)) {
      return (
        <ProjectPlaceholderPanel
          eyebrow="Project"
          title="Invalid project link"
          description="The project URL is not valid. Please return to the dashboard and open a project from the list."
        />
      );
    }

    if (!project) {
      return (
        <ProjectPlaceholderPanel
          eyebrow="Project"
          title="Project not found"
          description="We could not find that project. Please return to the dashboard and try another one."
        />
      );
    }

    switch (activeTab) {
      case "production-log":
        return (
          <ProjectPlaceholderPanel
            eyebrow="Production Log"
            title="Production log is coming next"
            description="This space is ready for daily updates, field progress, and timeline tracking once we wire that feature in."
          />
        );
      case "resources":
        return (
          <ProjectPlaceholderPanel
            eyebrow="Resources"
            title="Resources are coming next"
            description="This area will hold labor, equipment, materials, and any supporting project resource views."
          />
        );
      case "unit-quantities":
        return (
          <UnitQuantitiesPanel
            project={project}
            currentUser={profile}
          />
        );
      case "project-access":
        return (
          <ProjectAccessPanel
            projectId={project.id}
            currentUserRole={profile?.role ?? null}
          />
        );
      case "overview":
      default:
        return <ProjectOverviewPanel project={project} />;
    }
  }

  return (
    <PageShell>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DashboardHeader />

        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ProjectWorkspaceSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            project={project}
          />

          <main className="space-y-6">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                    Project Workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold">
                    {project?.project_name ?? "Project Workspace"}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm text-[var(--muted)]">
                    Navigate project-specific work from the sidebar and use this
                    area as the main working surface for the selected project.
                  </p>
                </div>

                {project && activeTab === "overview" ? (
                  <button
                    type="button"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="rounded-full border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-5 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer"
                  >
                    Edit Project
                  </button>
                ) : null}
              </div>
            </div>

            {renderMainPanel()}
          </main>
        </div>

        {project ? (
          <EditProjectDialog
            isOpen={isEditDialogOpen}
            project={project}
            onClose={() => setIsEditDialogOpen(false)}
            onProjectUpdated={(updatedProject) => {
              setProject(updatedProject);
              setIsEditDialogOpen(false);
            }}
          />
        ) : null}
      </div>
    </PageShell>
  );
}

function ProjectWorkspaceSidebar({
  activeTab,
  onTabChange,
  project,
}: ProjectSidebarProps) {
  return (
    <aside className="w-full border-b border-[var(--border)] pb-6 md:w-72 md:border-b-0 md:pb-0 md:pr-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-lg)]">
        <Link
          href="/dashboard"
          className="inline-flex text-xs uppercase tracking-[0.22em] text-[var(--subtle)] transition duration-200 hover:text-[var(--foreground)]"
        >
          Back To Dashboard
        </Link>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
            Current Project
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {project?.project_name ?? "Loading project..."}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {project?.project_code ?? "Project code will appear here"}
          </p>
        </div>

        <div className="mt-5">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[var(--subtle)]">
            Navigation
          </p>

          <div className="space-y-3">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={[
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition duration-200 ease-out",
                    "hover:scale-105 hover:cursor-pointer",
                    isActive
                      ? "border-[var(--inverse-bg)] bg-[var(--inverse-bg)] text-[var(--inverse-fg)]"
                      : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)] hover:border-[var(--border-strong)]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ProjectOverviewPanel({ project }: ProjectOverviewPanelProps) {
  return (
    <section className="space-y-6 text-[var(--foreground)]">
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
        <InfoCard
          label="Plot Area"
          value={formatArea(project.plot_area)}
        />
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

function ProjectPlaceholderPanel({
  eyebrow,
  title,
  description,
}: ProjectPlaceholderPanelProps) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
      <p className="text-xs uppercase tracking-[0.3em] text-[var(--subtle)]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-semibold">{title}</h2>
      <p className="mt-4 max-w-2xl text-[var(--muted)]">{description}</p>
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
  if (!dateValue) return "N/A";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString();
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
