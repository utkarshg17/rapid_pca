import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-white/15 px-6 py-4 md:px-10">
      <Link
        href="/"
        className="text-sm uppercase tracking-[0.22em] text-white/85"
      >
        Rapid PCA
      </Link>

      <Link href="/login">
        <Button type="button">Login</Button>
      </Link>
    </header>
  );
}