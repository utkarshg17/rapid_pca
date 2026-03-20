"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { signIn } from "@/features/auth/services/sign-in";
import { getLoginErrorMessage } from "@/features/auth/utils/auth-errors";

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const { data, error } = await signIn({ email, password });

      if (error || !data.session) {
        setErrorMessage(getLoginErrorMessage());
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setErrorMessage(getLoginErrorMessage());
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[var(--subtle)]">
        Secure Access
      </p>

      <h1 className="text-3xl font-semibold">Login</h1>

      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Enter your email ID and password to continue.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm text-[var(--muted)]">
            Email ID
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm text-[var(--muted)]">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)]">
            {errorMessage}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </Card>
  );
}
