"use client";

import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  getCurrentUserProfile,
  type UserProfile,
} from "@/features/auth/services/get-current-user-profile";
import { DashboardOverviewPanel } from "@/features/dashboard/components/dashboard-overview-panel";
import { DashboardProjectsPanel } from "@/features/dashboard/components/dashboard-projects-panel";
import { DashboardReportsPanel } from "@/features/dashboard/components/dashboard-reports-panel";
import { DashboardSidebar } from "@/features/dashboard/components/dashboard-sidebar";

type DashboardTab = "overview" | "projects" | "reports";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  useEffect(() => {
    async function loadProfile() {
      try {
        const userProfile = await getCurrentUserProfile();
        setProfile(userProfile);
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  function renderMainPanel() {
    if (isLoading) {
      return (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
          Loading dashboard...
        </div>
      );
    }

    switch (activeTab) {
      case "projects":
        return <DashboardProjectsPanel profile={profile} />;
      case "reports":
        return <DashboardReportsPanel />;
      case "overview":
      default:
        return <DashboardOverviewPanel firstName={profile?.first_name} />;
    }
  }

  return (
    <PageShell>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DashboardHeader />

        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <DashboardSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <main>{renderMainPanel()}</main>
        </div>
      </div>
    </PageShell>
  );
}
