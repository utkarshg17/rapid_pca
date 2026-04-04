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
import { JobEstimateAreaTakeoffsPanel } from "@/features/dashboard/components/job-estimate-area-takeoffs-panel";
import { JobEstimateProjectDetailsPanel } from "@/features/dashboard/components/job-estimate-project-details-panel";
import { getJobEstimateById } from "@/features/dashboard/services/get-job-estimate-by-id";
import type { JobEstimate } from "@/features/dashboard/types/job-estimate";

type JobEstimateWorkspaceTab =
  | "overview"
  | "project-details"
  | "area-takeoffs";

type JobEstimateSidebarProps = {
  activeTab: JobEstimateWorkspaceTab;
  onTabChange: (tab: JobEstimateWorkspaceTab) => void;
  estimate: JobEstimate | null;
};

type PlaceholderPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
};

const tabs: { key: JobEstimateWorkspaceTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "project-details", label: "Project Details" },
  { key: "area-takeoffs", label: "Area Takeoffs" },
];

export default function JobEstimateWorkspacePage() {
  const params = useParams<{ estimateId: string }>();
  const rawEstimateId = Array.isArray(params.estimateId)
    ? params.estimateId[0]
    : params.estimateId;
  const estimateId = Number(rawEstimateId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JobEstimateWorkspaceTab>(
    "project-details"
  );

  useEffect(() => {
    if (!Number.isFinite(estimateId)) {
      setEstimate(null);
      setIsLoading(false);
      return;
    }

    async function loadWorkspace() {
      setIsLoading(true);

      try {
        const [currentProfile, estimateRecord] = await Promise.all([
          getCurrentUserProfile(),
          getJobEstimateById(estimateId),
        ]);

        setProfile(currentProfile);
        setEstimate(estimateRecord);
      } catch (error) {
        console.error("Failed to load job estimate workspace:", error);
        setEstimate(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, [estimateId]);

  function renderMainPanel() {
    if (isLoading) {
      return (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
          Loading job estimate workspace...
        </div>
      );
    }

    if (!Number.isFinite(estimateId)) {
      return (
        <PlaceholderPanel
          eyebrow="Job Estimate"
          title="Invalid estimate link"
          description="The job estimate URL is not valid. Please return to the dashboard and open an estimate from the list."
        />
      );
    }

    if (!estimate) {
      return (
        <PlaceholderPanel
          eyebrow="Job Estimate"
          title="Estimate not found"
          description="We could not find that job estimate. Please return to the dashboard and try another one."
        />
      );
    }

    switch (activeTab) {
      case "overview":
        return (
          <PlaceholderPanel
            eyebrow="Overview"
            title="Overview is coming next"
            description="This space is reserved for the high-level AI estimate summary, confidence notes, and review insights once the estimator workflow is in place."
          />
        );
      case "area-takeoffs":
        return <JobEstimateAreaTakeoffsPanel estimate={estimate} />;
      case "project-details":
      default:
        return (
          <JobEstimateProjectDetailsPanel
            estimate={estimate}
            currentUser={profile}
            onEstimateUpdated={setEstimate}
          />
        );
    }
  }

  return (
    <PageShell>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DashboardHeader />

        <div className="grid gap-6 px-6 py-8 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <JobEstimateWorkspaceSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            estimate={estimate}
          />

          <main className="min-w-0">{renderMainPanel()}</main>
        </div>
      </div>
    </PageShell>
  );
}

function JobEstimateWorkspaceSidebar({
  activeTab,
  onTabChange,
  estimate,
}: JobEstimateSidebarProps) {
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
            Current Estimate
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {estimate?.projectName ?? "Loading estimate..."}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {estimate?.projectType ?? "Project type will appear here"}
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

function PlaceholderPanel({
  eyebrow,
  title,
  description,
}: PlaceholderPanelProps) {
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
