import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 md:px-10">
      <Link
        href="/"
        className="text-sm uppercase tracking-[0.22em] text-[var(--muted)]"
      >
        Rapid PCA
      </Link>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        <Link href="/login">
          <Button type="button">Login</Button>
        </Link>
      </div>
    </header>
  );
}
