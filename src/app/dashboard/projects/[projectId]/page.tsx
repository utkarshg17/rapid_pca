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
import { ProjectCharterPanel } from "@/features/projects/components/project-charter-panel";
import { ProjectOverviewPanel } from "@/features/projects/components/project-overview-panel";
import { EditProjectDialog } from "@/features/projects/components/edit-project-dialog";
import { LabourSheetPanel } from "@/features/projects/components/labour-sheet-panel";
import { MusterRollPanel } from "@/features/projects/components/muster-roll-panel";
import { ProductionLogPanel } from "@/features/projects/components/production-log-panel";
import { ProjectAccessPanel } from "@/features/projects/components/project-access-panel";
import { UnitQuantitiesPanel } from "@/features/projects/components/unit-quantities-panel";
import { getProjectById } from "@/features/projects/services/get-project-by-id";
import type { ProjectRecord } from "@/features/projects/types/project";

type ProjectWorkspaceTab =
  | "overview"
  | "production-log"
  | "resources"
  | "unit-quantities"
  | "labour-sheet"
  | "muster-roll"
  | "site-inventory"
  | "project-charter"
  | "project-access";

type ProjectSidebarProps = {
  activeTab: ProjectWorkspaceTab;
  onTabChange: (tab: ProjectWorkspaceTab) => void;
  project: ProjectRecord | null;
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
  { key: "labour-sheet", label: "Labour Sheet" },
  { key: "muster-roll", label: "Muster Roll" },
  { key: "site-inventory", label: "Site Inventory" },
  { key: "project-charter", label: "Project Charter" },
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
          <ProductionLogPanel
            project={project}
            currentUser={profile}
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
      case "labour-sheet":
        return (
          <LabourSheetPanel
            project={project}
            currentUser={profile}
          />
        );
      case "muster-roll":
        return (
          <MusterRollPanel
            project={project}
            currentUser={profile}
          />
        );
      case "site-inventory":
        return (
          <ProjectPlaceholderPanel
            eyebrow="Site Inventory"
            title="Site inventory is coming next"
            description="This section is reserved for on-site material inventory, stock movement, and inventory status tracking."
          />
        );
      case "project-charter":
        return (
          <ProjectCharterPanel
            project={project}
            onEditProject={() => setIsEditDialogOpen(true)}
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
        return <ProjectOverviewPanel projectId={project.id} />;
    }
  }

  return (
    <PageShell>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DashboardHeader />

        <div className="grid gap-6 px-6 py-8 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <ProjectWorkspaceSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            project={project}
          />

          <main className="min-w-0">{renderMainPanel()}</main>
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
    <aside className="w-full border-b border-[var(--border)] pb-6 lg:sticky lg:top-8 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:border-b-0 lg:pb-0">
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
