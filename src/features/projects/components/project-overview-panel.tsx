"use client";

import { useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/theme/theme-provider";
import { getMaterialCostSeries, type MaterialCostPoint } from "@/features/projects/services/get-material-cost-series";

type ProjectOverviewPanelProps = {
  projectId: number;
};

export function ProjectOverviewPanel({
  projectId,
}: ProjectOverviewPanelProps) {
  const { theme } = useTheme();
  const [materialCostSeries, setMaterialCostSeries] = useState<
    MaterialCostPoint[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMaterialCostSeries() {
      setIsLoading(true);

      try {
        const series = await getMaterialCostSeries(projectId);
        setMaterialCostSeries(series);
      } catch (error) {
        console.error("Failed to load material cost series:", error);
        setMaterialCostSeries([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadMaterialCostSeries();
  }, [projectId]);

  const chartMax = useMemo(() => {
    const highestAmount = Math.max(
      ...materialCostSeries.map((point) => point.amount),
      0
    );

    return highestAmount > 0 ? highestAmount : 1;
  }, [materialCostSeries]);

  const totalMaterialCost = useMemo(
    () =>
      materialCostSeries.reduce((sum, point) => sum + point.amount, 0),
    [materialCostSeries]
  );
  const currentMonthKey = useMemo(() => buildCurrentMonthKey(), []);

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Project Overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Material Cost</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Monthly material cost is calculated from unit quantity entries
              using quantity multiplied by unit cost for this project.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
              Total Material Cost
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrencyInr(totalMaterialCost)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8 text-sm text-[var(--muted)]">
            Loading material cost chart...
          </div>
        ) : materialCostSeries.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8">
            <h3 className="text-lg font-semibold">No material cost data yet</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add unit quantity entries with quantity and unit cost values to
              start plotting monthly material cost here.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
              <div className="flex h-80 flex-col justify-between pb-8 text-xs text-[var(--subtle)]">
                {buildYAxisTicks(chartMax).map((tick) => (
                  <div key={tick} className="leading-none">
                    {formatCompactCurrencyInr(tick)}
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                  <div className="relative h-80 border-l border-b border-[var(--border)] px-4 pt-4">
                    <div className="relative flex h-[calc(100%-3rem)] items-end gap-4">
                      {buildYAxisTicks(chartMax).map((tick, index) => (
                        <div
                          key={`grid-${tick}`}
                          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--border)]/60"
                          style={{
                            bottom: `${((index + 1) / 4) * 100}%`,
                          }}
                        />
                      ))}

                      {materialCostSeries.map((point) => {
                        const isCurrentMonth = point.monthKey === currentMonthKey;
                        const barHeight = `${Math.max(
                          (point.amount / chartMax) * 100,
                          point.amount > 0 ? 4 : 0
                        )}%`;
                        const barColor = isCurrentMonth
                          ? "#16a34a"
                          : theme === "dark"
                            ? "#3f3f46"
                            : "#111111";

                        return (
                          <div
                            key={point.monthKey}
                            className="flex h-full min-w-[88px] flex-1 flex-col items-center justify-end"
                          >
                            <div className="mb-3 text-center text-[11px] text-[var(--subtle)]">
                              {formatCompactCurrencyInr(point.amount)}
                            </div>
                            <div
                              className="w-full max-w-[56px] rounded-t-2xl transition duration-200"
                              style={{
                                height: barHeight,
                                backgroundColor: barColor,
                                opacity: 1,
                              }}
                              title={`${point.label}: ${formatCurrencyInr(point.amount)}`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex gap-4">
                      {materialCostSeries.map((point) => (
                        <div
                          key={`label-${point.monthKey}`}
                          className="min-w-[88px] flex-1 text-center text-xs text-[var(--muted)]"
                        >
                          {point.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-between px-4 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                    <span>Amount (INR)</span>
                    <span>Months - Year</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function buildYAxisTicks(maxValue: number) {
  return [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25];
}

function buildCurrentMonthKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatCurrencyInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactCurrencyInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
