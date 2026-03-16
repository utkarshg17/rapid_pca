import Link from "next/link";
import { LogoutButton } from "@/features/auth/components/logout-button";

export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/15 px-6 py-4 md:px-10">
      <Link
        href="/dashboard"
        className="text-sm uppercase tracking-[0.22em] text-white/85"
      >
        Rapid PCA
      </Link>

      <LogoutButton />
    </header>
  );
}