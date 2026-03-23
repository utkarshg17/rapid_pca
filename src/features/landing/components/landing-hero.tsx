export function LandingHero() {
  return (
    <section className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 md:px-10">
      <div className="w-full max-w-4xl text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.35em] text-[var(--subtle)]">
          Construction Data Management
        </p>

        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          Welcome to Rapid PCA
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
          A simple platform to connect field updates with office visibility in
          one place.
        </p>
      </div>
    </section>
  );
}

