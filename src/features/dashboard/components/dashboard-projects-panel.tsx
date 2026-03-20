"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { AddProjectDialog } from "@/features/projects/components/add-project-dialog";
import { ProjectTile } from "@/features/projects/components/project-tile";
import { getProjectsForUser } from "@/features/projects/services/get-projects-for-user";
import type { ProjectRecord } from "@/features/projects/types/project";

type DashboardProjectsPanelProps = {
  profile: UserProfile | null;
};

export function DashboardProjectsPanel({
  profile,
}: DashboardProjectsPanelProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isAdmin = profile?.role === "Admin";

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const projectRows = await getProjectsForUser(profile);
      setProjects(projectRows);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
            Projects
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Project Directory</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            View the projects available in the system and add new ones if you
            have Admin access.
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
          >
            + Add New Project
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-sm text-[var(--muted)]">
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-10 text-center">
          <h2 className="text-lg font-semibold">No projects found</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Once projects are added, they will appear here as tiles.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {projects.map((project) => (
            <ProjectTile key={project.id} project={project} />
          ))}
        </div>
      )}

      {isAdmin && profile ? (
        <AddProjectDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onProjectCreated={loadProjects}
          profile={profile}
        />
      ) : null}
    </section>
  );
}
