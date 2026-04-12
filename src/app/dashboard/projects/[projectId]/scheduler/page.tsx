"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/layout/page-shell";
import { ProjectSchedulerWorkspace } from "@/features/projects/components/project-scheduler-workspace";
import { getProjectById } from "@/features/projects/services/get-project-by-id";
import type { ProjectRecord } from "@/features/projects/types/project";

export default function ProjectSchedulerPage() {
  const params = useParams<{ projectId: string }>();
  const rawProjectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId;
  const projectId = Number(rawProjectId);

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      setProject(null);
      setIsLoading(false);
      return;
    }

    async function loadProject() {
      setIsLoading(true);

      try {
        const projectRecord = await getProjectById(projectId);
        setProject(projectRecord);
      } catch (error) {
        console.error("Failed to load scheduler project:", error);
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProject();
  }, [projectId]);

  return (
    <PageShell>
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3 md:px-4 md:py-4">
          <div className="flex h-full w-full flex-col gap-3">
            {isLoading ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                Loading scheduler...
              </section>
            ) : !Number.isFinite(projectId) ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                This project link is not valid.
              </section>
            ) : !project ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                We could not find that project.
              </section>
            ) : (
              <ProjectSchedulerWorkspace
                project={project}
                backHref={Number.isFinite(projectId) ? `/dashboard/projects/${projectId}` : "/dashboard"}
              />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
