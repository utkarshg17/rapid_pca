import { AppHeader } from "@/components/layout/app-header";
import { PageShell } from "@/components/layout/page-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <PageShell>
      <AppHeader />
      <section className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 py-10">
        <LoginForm />
      </section>
    </PageShell>
  );
}