import { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {children}
    </main>
  );
}
