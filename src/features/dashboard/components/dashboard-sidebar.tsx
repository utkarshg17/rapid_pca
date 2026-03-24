type DashboardTab = "overview" | "projects" | "reports";

type DashboardSidebarProps = {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
};

const tabs: { key: DashboardTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "projects", label: "Projects" },
  { key: "reports", label: "Reports" },
];

export function DashboardSidebar({
  activeTab,
  onTabChange,
}: DashboardSidebarProps) {
  return (
    <aside className="w-full border-b border-[var(--border)] pb-6 lg:sticky lg:top-8 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:border-b-0 lg:pb-0">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-lg)]">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-[var(--subtle)]">
          Navigation
        </p>

        <div className="space-y-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition duration-200 ease-out",
                  "hover:scale-105 hover:cursor-pointer",
                  isActive
                    ? "border-[var(--inverse-bg)] bg-[var(--inverse-bg)] text-[var(--inverse-fg)]"
                    : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)] hover:border-[var(--border-strong)]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
