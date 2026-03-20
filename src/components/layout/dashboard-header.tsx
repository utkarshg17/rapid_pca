import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ProfileButton } from "@/features/auth/components/profile-button";
import { LogoutButton } from "@/features/auth/components/logout-button";

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 md:px-10">
      <Link
        href="/dashboard"
        className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]"
      >
        Rapid PCA
      </Link>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <ProfileButton />
        <LogoutButton />
      </div>
    </header>
  );
}
