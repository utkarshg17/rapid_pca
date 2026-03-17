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
    <aside className="w-full border-b border-white/10 pb-6 md:w-72 md:border-b-0 md:pb-0 md:pr-6">
      <div className="rounded-3xl border border-white/10 bg-neutral-950 p-4">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-white/45">
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
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-black text-white hover:border-white/30",
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