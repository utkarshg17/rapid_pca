"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatAreaNumber,
  formatCurrencyNumber,
} from "@/features/dashboard/components/job-estimate-branch-metrics";
import { getJobEstimateOverviewSummary } from "@/features/dashboard/services/get-job-estimate-overview-summary";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import type {
  JobEstimate,
  JobEstimateOverviewSummaryItem,
} from "@/features/dashboard/types/job-estimate";

type JobEstimateOverviewPanelProps = {
  estimate: JobEstimate;
};

export function JobEstimateOverviewPanel({
  estimate,
}: JobEstimateOverviewPanelProps) {
  const [grossFloorArea, setGrossFloorArea] = useState(0);
  const [summaryItems, setSummaryItems] = useState<JobEstimateOverviewSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setIsLoading(true);

      try {
        const [projectDetails, loadedSummaryItems] = await Promise.all([
          getJobEstimateProjectDetails(estimate),
          getJobEstimateOverviewSummary(estimate.id),
        ]);

        if (!isMounted) {
          return;
        }

        const superstructureFootprint = parseOptionalNumber(
          projectDetails.superstructureFootprint
        );
        const stiltFloorCount = parseOptionalNumber(projectDetails.stiltFloorCount);
        const floorCount = parseOptionalNumber(projectDetails.floorCount);

        setGrossFloorArea(
          superstructureFootprint * (stiltFloorCount + floorCount)
        );
        setSummaryItems(loadedSummaryItems);
      } catch (error) {
        console.error("Failed to load job estimate overview:", error);

        if (isMounted) {
          setGrossFloorArea(0);
          setSummaryItems([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, [estimate]);

  const overviewRows = useMemo(
    () =>
      summaryItems.map((item) => {
        const unitQuantity = grossFloorArea > 0 ? item.quantity / grossFloorArea : 0;
        const unitCost = item.quantity > 0 ? item.cost / item.quantity : 0;

        return {
          ...item,
          unitQuantity,
          unitCost,
        };
      }),
    [grossFloorArea, summaryItems]
  );

  const estimatedProjectCost = useMemo(
    () => overviewRows.reduce((sum, row) => sum + row.cost, 0),
    [overviewRows]
  );
  const estimatedUnitCost = useMemo(
    () => (grossFloorArea > 0 ? estimatedProjectCost / grossFloorArea : 0),
    [estimatedProjectCost, grossFloorArea]
  );

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
        Loading estimate overview...
      </section>
    );
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Estimate Overview</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              This roll-up summarizes the saved detailed estimate items by category
              so estimators can quickly review high-level quantity and cost signals.
            </p>
          </div>

          <div className="grid min-w-[15rem] gap-3 sm:min-w-[42rem] sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                Estimated Project Cost
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                INR {formatCurrencyNumber(estimatedProjectCost)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Sum of all saved estimate items.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                Gross Floor Area
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {formatAreaNumber(grossFloorArea)} sq.ft
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Superstructure Footprint x (Stilt Floor Count + Floor Count)
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                Unit Cost
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                INR {formatCurrencyNumber(estimatedUnitCost)}/sq.ft
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Estimated Project Cost / Gross Floor Area
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
        <div className="border-b border-[var(--border)] px-4 pt-4 pb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
            Summary Table
          </p>
          <h3 className="mt-2 text-xl font-semibold">Saved Estimate Roll-Up</h3>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Compact summary of each saved estimate item grouped by the category in your cost code database.
          </p>
        </div>

        {overviewRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--muted)]">
            No saved estimate items yet. Save changes in Detailed Job Estimate to populate this overview.
          </div>
        ) : (
          <div className="mt-4 w-full overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[1160px] divide-y divide-[var(--border)] text-left text-sm">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                    Category
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Cost Code
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                    Item
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Unit Quantity
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Unit Cost
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Quantity
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Unit
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {overviewRows.map((row) => (
                  <tr key={row.costCode}>
                    <td className="px-3 py-2.5 text-xs text-[var(--muted)]">
                      {row.category}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[var(--muted)]">
                      {row.costCode}
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {row.item}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--muted)]">
                      {grossFloorArea > 0 ? formatMetricNumber(row.unitQuantity) : "--"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--muted)]">
                      {row.quantity > 0
                        ? `INR ${formatCurrencyNumber(row.unitCost)}/${row.unit || "unit"}`
                        : "--"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--muted)]">
                      {formatAreaNumber(row.quantity)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--muted)]">
                      {row.unit || "--"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                      INR {formatCurrencyNumber(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim();
  const parsed = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMetricNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      })
    : "0.000";
}
