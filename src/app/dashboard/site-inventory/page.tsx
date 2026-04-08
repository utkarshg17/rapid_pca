"use client";

import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  getCurrentUserProfile,
  type UserProfile,
} from "@/features/auth/services/get-current-user-profile";
import { SiteInventoryWorkspace } from "@/features/dashboard/components/site-inventory-workspace";

export default function SiteInventoryPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const userProfile = await getCurrentUserProfile();
        setProfile(userProfile);
      } catch (error) {
        console.error("Failed to load user profile for site inventory:", error);
      } finally {
        setIsLoadingProfile(false);
      }
    }

    loadProfile();
  }, []);

  return (
    <PageShell>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DashboardHeader />

        <div className="px-6 py-8 md:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
            {isLoadingProfile ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                Loading inventory workspace...
              </section>
            ) : (
              <SiteInventoryWorkspace profile={profile} />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
