"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { PageShell } from "@/components/layout/page-shell";
import { Input } from "@/components/ui/input";
import { getMusterRollEntries } from "@/features/projects/services/get-muster-roll-entries";
import { getProjectById } from "@/features/projects/services/get-project-by-id";
import type { MusterRollEntry } from "@/features/projects/types/muster-roll";
import type { ProjectRecord } from "@/features/projects/types/project";
import {
  buildMonthlyMusterRollReport,
  formatDayHeader,
} from "@/features/projects/utils/build-muster-roll-monthly-report";

export default function MusterRollReportPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const rawProjectId = Array.isArray(params.projectId)
    ? params.projectId[0]
    : params.projectId;
  const projectId = Number(rawProjectId);
  const initialMonthValue = searchParams.get("month") ?? getCurrentMonthValue();

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [entries, setEntries] = useState<MusterRollEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [monthValue, setMonthValue] = useState(initialMonthValue);

  useEffect(() => {
    setMonthValue(searchParams.get("month") ?? getCurrentMonthValue());
  }, [searchParams]);

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      setProject(null);
      setEntries([]);
      setIsLoading(false);
      return;
    }

    async function loadReportPage() {
      setIsLoading(true);

      try {
        const [projectRecord, musterRollEntries] = await Promise.all([
          getProjectById(projectId),
          getMusterRollEntries(projectId),
        ]);

        setProject(projectRecord);
        setEntries(musterRollEntries);
      } catch (error) {
        console.error("Failed to load muster roll report:", error);
        setProject(null);
        setEntries([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadReportPage();
  }, [projectId]);

  const monthlyReport = useMemo(
    () => buildMonthlyMusterRollReport(entries, monthValue),
    [entries, monthValue]
  );
  const reportSummary = useMemo(() => {
    const totalAmount = monthlyReport.rows.reduce(
      (sum, row) => sum + row.totalAmount,
      0
    );
    const pettyContractorTotals = new Map<
      string,
      {
        pettyContractorId: number | null;
        pettyContractorName: string;
        totalAmount: number;
        crewCount: number;
      }
    >();

    monthlyReport.rows.forEach((row) => {
      const key = String(row.pettyContractorId ?? row.pettyContractorName);
      const existingTotal = pettyContractorTotals.get(key);

      if (existingTotal) {
        existingTotal.totalAmount += row.totalAmount;
        existingTotal.crewCount += 1;
        return;
      }

      pettyContractorTotals.set(key, {
        pettyContractorId: row.pettyContractorId,
        pettyContractorName: row.pettyContractorName,
        totalAmount: row.totalAmount,
        crewCount: 1,
      });
    });

    return {
      totalAmount,
      pettyContractorTotals: Array.from(pettyContractorTotals.values()).sort(
        (left, right) =>
          right.totalAmount - left.totalAmount ||
          left.pettyContractorName.localeCompare(right.pettyContractorName)
      ),
    };
  }, [monthlyReport]);

  return (
    <PageShell>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <DashboardHeader />

        <div className="px-6 py-8 md:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-4">
                  <Link
                    href={Number.isFinite(projectId) ? `/dashboard/projects/${projectId}` : "/dashboard"}
                    className="inline-flex text-xs uppercase tracking-[0.22em] text-[var(--subtle)] transition duration-200 hover:text-[var(--foreground)]"
                  >
                    Back To Project Workspace
                  </Link>

                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--subtle)]">
                      Muster Roll Report
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold">
                      {project?.project_name ?? "Loading project..."}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                      Full-month petty contractor and crew timesheet view with
                      daily regular time, overtime, rate, and total amount for{" "}
                      {formatMonthValue(monthValue)}.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[220px_auto] sm:items-end">
                  <label className="space-y-2 text-sm text-[var(--muted)]">
                    <span className="block text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                      Report Month
                    </span>
                    <Input
                      type="month"
                      value={monthValue}
                      onChange={(event) => setMonthValue(event.target.value)}
                    />
                  </label>

                  <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--muted)]">
                    Export and print actions can be added here next.
                  </div>
                </div>
              </div>
            </section>

            {isLoading ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                Loading muster roll report...
              </section>
            ) : !Number.isFinite(projectId) ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                This project link is not valid.
              </section>
            ) : !project ? (
              <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8">
                We could not find that project.
              </section>
            ) : monthlyReport.rows.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-10 text-center">
                <h2 className="text-2xl font-semibold">No rows for {formatMonthValue(monthValue)}</h2>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Save muster roll entries in this month and the report will appear here.
                </p>
              </section>
            ) : (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
                  <div className="overflow-x-auto">
                    <table className="min-w-[1800px] border-collapse text-left text-sm">
                      <thead className="bg-[var(--surface)]">
                        <tr>
                          <th
                            rowSpan={2}
                            className="border border-[var(--border)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                          >
                            Petty Contractor
                          </th>
                          <th
                            rowSpan={2}
                            className="border border-[var(--border)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                          >
                            Crew Name
                          </th>
                          {monthlyReport.dayKeys.map((dayKey) => (
                            <th
                              key={dayKey}
                              colSpan={2}
                              className="border border-[var(--border)] px-4 py-3 text-center text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                            >
                              {formatDayHeader(dayKey)}
                            </th>
                          ))}
                          <th
                            rowSpan={2}
                            className="border border-[var(--border)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                          >
                            Rate
                          </th>
                          <th
                            rowSpan={2}
                            className="border border-[var(--border)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                          >
                            Total
                          </th>
                        </tr>
                        <tr>
                          {monthlyReport.dayKeys.map((dayKey) => (
                            <Fragment key={`sub-${dayKey}`}>
                              <th className="border border-[var(--border)] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                RT
                              </th>
                              <th className="border border-[var(--border)] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                                OT
                              </th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[var(--border)]">
                        {monthlyReport.rows.map((row) => (
                          <tr
                            key={`${row.pettyContractorId ?? row.pettyContractorName}-${row.crewName}-${row.crewType}`}
                          >
                            <td className="border border-[var(--border)] px-4 py-3 text-[var(--muted)]">
                              {row.pettyContractorName}
                            </td>
                            <td className="border border-[var(--border)] px-4 py-3 font-medium">
                              {row.crewName}
                            </td>
                            {monthlyReport.dayKeys.map((dayKey) => {
                              const dailyHours = row.dailyHours[dayKey] ?? {
                                regularHours: 0,
                                overtimeHours: 0,
                              };

                              return (
                                <Fragment key={`${row.crewName}-${dayKey}`}>
                                  <td className="border border-[var(--border)] px-3 py-3 text-[var(--muted)]">
                                    {formatNumber(dailyHours.regularHours)}
                                  </td>
                                  <td className="border border-[var(--border)] px-3 py-3 text-[var(--muted)]">
                                    {formatNumber(dailyHours.overtimeHours)}
                                  </td>
                                </Fragment>
                              );
                            })}
                            <td className="border border-[var(--border)] px-4 py-3 text-[var(--muted)]">
                              {formatCurrencyInr(row.rate)}
                            </td>
                            <td className="border border-[var(--border)] px-4 py-3 text-[var(--muted)]">
                              {formatCurrencyInr(row.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--subtle)]">
                    Total Payable
                  </p>
                  <p className="mt-3 text-3xl font-semibold">
                    {formatCurrencyInr(reportSummary.totalAmount)}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Total amount to be paid for {formatMonthValue(monthValue)}.
                  </p>
                </section>

                <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--subtle)]">
                      Summary By Petty Contractor
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      What We Owe Each Petty Contractor
                    </h2>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)]">
                    <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                      <thead className="bg-[var(--surface)]">
                        <tr>
                          <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Petty Contractor
                          </th>
                          <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Crew Count
                          </th>
                          <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Amount Payable
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[var(--border)]">
                        {reportSummary.pettyContractorTotals.map((summaryRow) => (
                          <tr
                            key={`${summaryRow.pettyContractorId ?? summaryRow.pettyContractorName}`}
                          >
                            <td className="px-4 py-4 font-medium">
                              {summaryRow.pettyContractorName}
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {summaryRow.crewCount}
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {formatCurrencyInr(summaryRow.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function getCurrentMonthValue() {
  const currentDate = new Date();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");

  return `${currentDate.getFullYear()}-${month}`;
}

function formatMonthValue(value: string) {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(value);

  if (!monthMatch) {
    return value;
  }

  const [, year, month] = monthMatch;
  const parsedDate = new Date(Number(year), Number(month) - 1, 1);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatCurrencyInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
