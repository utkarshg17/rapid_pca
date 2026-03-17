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
        <section className="rounded-3xl border border-white/10 bg-neutral-950 p-8">
          <p className="text-white/65">Loading dashboard...</p>
        </section>
      );
    }

    switch (activeTab) {
      case "projects":
        return <DashboardProjectsPanel />;
      case "reports":
        return <DashboardReportsPanel />;
      case "overview":
      default:
        return <DashboardOverviewPanel firstName={profile?.first_name} />;
    }
  }

  return (
    <PageShell>
      <DashboardHeader />

      <section className="px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row">
          <div className="w-full md:w-72 md:flex-shrink-0">
            <DashboardSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          <div className="min-w-0 flex-1">{renderMainPanel()}</div>
        </div>
      </section>
    </PageShell>
  );
}