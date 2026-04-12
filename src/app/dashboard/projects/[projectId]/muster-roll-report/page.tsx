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
  toInputDate,
} from "@/features/projects/utils/build-muster-roll-monthly-report";
import { formatDisplayDate, formatDisplayMonthYear } from "@/lib/date-format";

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

  const monthlyEntries = useMemo(
    () =>
      entries.filter((entry) =>
        toInputDate(entry.recordDate).startsWith(`${monthValue}-`)
      ),
    [entries, monthValue]
  );
  const monthlyReport = useMemo(
    () => buildMonthlyMusterRollReport(monthlyEntries, monthValue),
    [monthlyEntries, monthValue]
  );
  const reportSummary = useMemo(() => {
    const grossHoursAmount = monthlyReport.rows.reduce(
      (sum, row) => sum + row.totalAmount,
      0
    );
    const pettyContractorTotals = new Map<
      string,
      {
        pettyContractorId: number | null;
        pettyContractorName: string;
        crewCount: number;
        grossHoursAmount: number;
        totalAdvances: number;
        netPayable: number;
        advances: Array<{
          id: string;
          recordDate: string;
          amount: number;
          description: string;
        }>;
      }
    >();

    monthlyReport.rows.forEach((row) => {
      const key = String(row.pettyContractorId ?? row.pettyContractorName);
      const existingTotal = pettyContractorTotals.get(key);

      if (existingTotal) {
        existingTotal.grossHoursAmount += row.totalAmount;
        existingTotal.crewCount += 1;
        existingTotal.netPayable = existingTotal.grossHoursAmount;
        return;
      }

      pettyContractorTotals.set(key, {
        pettyContractorId: row.pettyContractorId,
        pettyContractorName: row.pettyContractorName,
        grossHoursAmount: row.totalAmount,
        crewCount: 1,
        totalAdvances: 0,
        netPayable: row.totalAmount,
        advances: [],
      });
    });

    monthlyEntries
      .filter((entry) => entry.entryType === "advance-payment")
      .forEach((entry) => {
        const pettyContractorId = entry.rows[0]?.pettyContractorId ?? null;
        const pettyContractorName =
          entry.rows[0]?.pettyContractorName || entry.pettyContractorSummary;
        const key = String(pettyContractorId ?? pettyContractorName);
        const existingTotal =
          pettyContractorTotals.get(key) ??
          {
            pettyContractorId,
            pettyContractorName,
            crewCount: 0,
            grossHoursAmount: 0,
            totalAdvances: 0,
            netPayable: 0,
            advances: [],
          };

        existingTotal.totalAdvances += entry.advancePaymentAmount;
        existingTotal.advances.push({
          id: entry.entryGroupId,
          recordDate: entry.recordDate,
          amount: entry.advancePaymentAmount,
          description: entry.advancePaymentDescription,
        });
        existingTotal.netPayable =
          existingTotal.grossHoursAmount - existingTotal.totalAdvances;

        pettyContractorTotals.set(key, existingTotal);
      });

    const totalAdvances = Array.from(pettyContractorTotals.values()).reduce(
      (sum, row) => sum + row.totalAdvances,
      0
    );

    return {
      grossHoursAmount,
      totalAdvances,
      netPayable: grossHoursAmount - totalAdvances,
      pettyContractorTotals: Array.from(pettyContractorTotals.values()).sort(
        (left, right) =>
          right.netPayable - left.netPayable ||
          left.pettyContractorName.localeCompare(right.pettyContractorName)
      ).map((row) => ({
        ...row,
        advances: row.advances.sort((left, right) =>
          toInputDate(right.recordDate).localeCompare(toInputDate(left.recordDate))
        ),
      })),
    };
  }, [monthlyEntries, monthlyReport]);

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
            ) : monthlyEntries.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-10 text-center">
                <h2 className="text-2xl font-semibold">No rows for {formatMonthValue(monthValue)}</h2>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Save muster roll entries in this month and the report will appear here.
                </p>
              </section>
            ) : (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
                  {monthlyReport.rows.length === 0 ? (
                    <div className="p-8 text-center">
                      <h2 className="text-2xl font-semibold">
                        No labour-hour rows for {formatMonthValue(monthValue)}
                      </h2>
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        Advance payments exist for this month, but no crew-hour
                        entries have been saved yet.
                      </p>
                    </div>
                  ) : (
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
                  )}
                </section>

                <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--subtle)]">
                      Total Payable
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Monthly payable after accounting for all recorded advance
                      payments in {formatMonthValue(monthValue)}.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <SummaryValueCard
                      label="Gross Hours Amount"
                      value={formatAccountingCurrencyInr(
                        reportSummary.grossHoursAmount
                      )}
                    />
                    <SummaryValueCard
                      label="Advances Paid"
                      value={formatAccountingCurrencyInr(
                        -reportSummary.totalAdvances
                      )}
                    />
                    <SummaryValueCard
                      label="Net Payable"
                      value={formatAccountingCurrencyInr(
                        reportSummary.netPayable
                      )}
                    />
                  </div>
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
                            Gross Hours Amount
                          </th>
                          <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Advance Payment Log
                          </th>
                          <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Total Advances
                          </th>
                          <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Net Payable
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
                              {formatAccountingCurrencyInr(
                                summaryRow.grossHoursAmount
                              )}
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {summaryRow.advances.length === 0 ? (
                                "No advances recorded"
                              ) : (
                                <div className="space-y-2">
                                  {summaryRow.advances.map((advance) => (
                                    <div key={advance.id}>
                                      <p>
                                        {formatDate(advance.recordDate)}:{" "}
                                        {formatAccountingCurrencyInr(
                                          -advance.amount
                                        )}
                                      </p>
                                      {advance.description ? (
                                        <p className="text-xs text-[var(--subtle)]">
                                          {advance.description}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {summaryRow.totalAdvances > 0
                                ? formatAccountingCurrencyInr(
                                    -summaryRow.totalAdvances
                                  )
                                : formatCurrencyInr(0)}
                            </td>
                            <td className="px-4 py-4 text-[var(--muted)]">
                              {formatAccountingCurrencyInr(summaryRow.netPayable)}
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
  return formatDisplayMonthYear(value, value);
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

function formatAccountingCurrencyInr(value: number) {
  if (value < 0) {
    return `(${formatCurrencyInr(Math.abs(value))})`;
  }

  return formatCurrencyInr(value);
}

function formatDate(dateValue: string) {
  return formatDisplayDate(dateValue, dateValue);
}

function SummaryValueCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
