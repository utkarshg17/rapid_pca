"use client";

import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  getCurrentUserProfile,
  type UserProfile,
} from "@/features/auth/services/get-current-user-profile";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const welcomeText = isLoading
    ? "Welcome"
    : profile?.first_name
      ? `Welcome ${profile.first_name}!`
      : "Welcome";

  return (
    <PageShell>
      <DashboardHeader />

      <section className="px-6 py-12 md:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.3em] text-white/45">
            Dashboard
          </p>

          <h1 className="mt-4 text-4xl font-semibold">{welcomeText}</h1>

          <p className="mt-4 max-w-2xl text-white/65">
            You are now inside Rapid PCA. This dashboard will become the home
            for field updates, office visibility, and construction data
            management.
          </p>
        </div>
      </section>
    </PageShell>
  );
}