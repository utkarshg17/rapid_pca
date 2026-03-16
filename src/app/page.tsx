import { AppHeader } from "@/components/layout/app-header";
import { PageShell } from "@/components/layout/page-shell";
import { LandingHero } from "@/features/landing/components/landing-hero";

export default function HomePage() {
  return (
    <PageShell>
      <AppHeader />
      <LandingHero />
    </PageShell>
  );
}