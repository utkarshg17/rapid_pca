"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import {
  getSiteInventoryBalances,
  getSiteInventorySources,
  getSiteInventoryTransactions,
} from "@/features/dashboard/services/site-inventory";
import type {
  SiteInventoryBalance,
  SiteInventorySource,
  SiteInventoryTransaction,
} from "@/features/dashboard/types/site-inventory";
import type { ProjectRecord } from "@/features/projects/types/project";

type ProjectSiteInventoryPanelProps = {
  project: ProjectRecord;
};

type BalanceMovement = {
  transaction: SiteInventoryTransaction;
  line: SiteInventoryTransaction["lines"][number];
  quantityIn: number;
  quantityOut: number;
  netQuantity: number;
  runningTotal: number;
};

type SiteSourceMatch = {
  source: SiteInventorySource;
  matchedBy: "project name" | "project code";
};

export function ProjectSiteInventoryPanel({
  project,
}: ProjectSiteInventoryPanelProps) {
  const [sources, setSources] = useState<SiteInventorySource[]>([]);
  const [balances, setBalances] = useState<SiteInventoryBalance[]>([]);
  const [transactions, setTransactions] = useState<SiteInventoryTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInventory() {
      setIsLoading(true);

      try {
        const [loadedSources, loadedBalances, loadedTransactions] =
          await Promise.all([
            getSiteInventorySources(),
            getSiteInventoryBalances(),
            getSiteInventoryTransactions(),
          ]);

        if (!isMounted) {
          return;
        }

        setSources(loadedSources);
        setBalances(loadedBalances);
        setTransactions(loadedTransactions);
        setErrorMessage("");
      } catch (error) {
        console.error("Failed to load project site inventory:", error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load project site inventory."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInventory();

    return () => {
      isMounted = false;
    };
  }, [project.id]);

  const matchedSite = useMemo(
    () => findMatchingSiteSource(project, sources),
    [project, sources]
  );

  const projectSiteBalances = useMemo(
    () =>
      matchedSite
        ? balances.filter((balance) => balance.siteSourceId === matchedSite.source.id)
        : [],
    [balances, matchedSite]
  );

  const latestUpdatedAt = useMemo(() => {
    if (projectSiteBalances.length === 0) {
      return "--";
    }

    const latestTimestamp = Math.max(
      ...projectSiteBalances.map((row) => new Date(row.updatedAt).getTime())
    );

    return Number.isNaN(latestTimestamp)
      ? "--"
      : new Date(latestTimestamp).toLocaleString();
  }, [projectSiteBalances]);

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
        Loading site inventory...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {errorMessage}
      </section>
    );
  }

  if (!matchedSite) {
    return (
      <section className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
            Site Inventory
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Current Site Inventory</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            This view mirrors the company inventory balance table, but only for the
            site linked to this project.
          </p>
        </div>

        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-8 text-sm text-[var(--muted)]">
          We could not find an active inventory source of type <span className="font-medium text-[var(--foreground)]">Site</span>
          {" "}that matches this project. We looked for a source named <span className="font-medium text-[var(--foreground)]">{project.project_name}</span>
          {" "}or <span className="font-medium text-[var(--foreground)]">{project.project_code}</span>.
          Add one of those in the company Site Inventory workspace and this project tab will start reflecting the same live stock position.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Site Inventory
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Current Site Inventory</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review the live stock position for this project site using the same
              company-wide inventory ledger and expandable transaction history.
            </p>
          </div>

          <div className="grid min-w-[15rem] gap-3 sm:min-w-[32rem] sm:grid-cols-3">
            <InfoTile label="Inventory Source" value={matchedSite.source.sourceName} />
            <InfoTile label="Items In Stock" value={String(projectSiteBalances.length)} />
            <InfoTile label="Last Updated" value={latestUpdatedAt} />
          </div>
        </div>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Matched by {matchedSite.matchedBy}. Project inventory is shown only for
          active site balances under this source.
        </p>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
            Actual Inventory
          </p>
          <h3 className="mt-2 text-2xl font-semibold">{matchedSite.source.sourceName}</h3>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            This is the same site-level balance view from the company inventory page,
            filtered down to this project only.
          </p>
        </div>

        <ProjectSiteBalanceTable
          rows={projectSiteBalances}
          transactions={transactions}
        />
      </section>
    </section>
  );
}

function ProjectSiteBalanceTable({
  rows,
  transactions,
}: {
  rows: SiteInventoryBalance[];
  transactions: SiteInventoryTransaction[];
}) {
  const [expandedBalanceId, setExpandedBalanceId] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center text-sm text-[var(--muted)]">
        No inventory is currently available for this project site.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Item
            </th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Unit
            </th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Category
            </th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Quantity On Hand
            </th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Last Updated
            </th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const isExpanded = expandedBalanceId === row.id;
            const movementHistory = getBalanceMovementHistory(row, transactions);

            return (
              <Fragment key={row.id}>
                <tr>
                  <td className="px-4 py-3 font-medium">{row.itemName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.unit}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.itemCategory || "--"}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatQuantity(row.quantityOnHand)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDateTime(row.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedBalanceId(isExpanded ? null : row.id)}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} inventory history for ${row.itemName}`}
                      title={isExpanded ? "Collapse history" : "View history"}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                    >
                      <ExpandIcon />
                    </button>
                  </td>
                </tr>

                {isExpanded ? (
                  <tr>
                    <td colSpan={6} className="bg-[var(--panel-soft)] px-4 py-4">
                      <InventoryBalanceHistory
                        row={row}
                        movementHistory={movementHistory}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InventoryBalanceHistory({
  row,
  movementHistory,
}: {
  row: SiteInventoryBalance;
  movementHistory: BalanceMovement[];
}) {
  if (movementHistory.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
        No matching movement history was found for {row.itemName} at {row.siteName}.
        Current balance: {formatQuantity(row.quantityOnHand)} {row.unit}.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
            Movement History
          </p>
          <h4 className="mt-1 text-base font-semibold">
            {row.itemName} at {row.siteName}
          </h4>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
          Final Total: {formatQuantity(row.quantityOnHand)} {row.unit}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">
                Date
              </th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">
                From
              </th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">
                To
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-[0.16em] text-[var(--subtle)]">
                In
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-[0.16em] text-[var(--subtle)]">
                Out
              </th>
              <th className="px-3 py-3 text-right uppercase tracking-[0.16em] text-[var(--subtle)]">
                Running Total
              </th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">
                Challan / Bill
              </th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">
                Vehicle
              </th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">
                Remarks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {movementHistory.map((movement) => (
              <tr key={`${movement.transaction.id}-${movement.line.id}`}>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {formatDate(movement.transaction.transactionDate)}
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {movement.transaction.fromSourceName}
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {movement.transaction.toSourceName}
                </td>
                <td className="px-3 py-3 text-right font-medium text-green-600">
                  {movement.quantityIn ? formatQuantity(movement.quantityIn) : "--"}
                </td>
                <td className="px-3 py-3 text-right font-medium text-red-500">
                  {movement.quantityOut ? formatQuantity(movement.quantityOut) : "--"}
                </td>
                <td className="px-3 py-3 text-right font-semibold">
                  {formatQuantity(movement.runningTotal)} {row.unit}
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {movement.transaction.challanBillNo || "--"}
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {movement.transaction.vehicleNumber || "--"}
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">
                  {movement.line.remarks || movement.transaction.remarks || "--"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[var(--surface)]">
            <tr>
              <td colSpan={5} className="px-3 py-3 font-semibold">
                Final Total
              </td>
              <td className="px-3 py-3 text-right font-semibold">
                {formatQuantity(row.quantityOnHand)} {row.unit}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function findMatchingSiteSource(
  project: ProjectRecord,
  sources: SiteInventorySource[]
): SiteSourceMatch | null {
  const activeSiteSources = sources.filter(
    (source) => source.sourceType === "Site" && source.isActive
  );
  const projectName = project.project_name.trim().toLowerCase();
  const projectCode = project.project_code.trim().toLowerCase();

  const exactNameMatch = activeSiteSources.find(
    (source) => source.sourceName.trim().toLowerCase() === projectName
  );

  if (exactNameMatch) {
    return { source: exactNameMatch, matchedBy: "project name" };
  }

  const exactCodeMatch = activeSiteSources.find(
    (source) => source.sourceName.trim().toLowerCase() === projectCode
  );

  if (exactCodeMatch) {
    return { source: exactCodeMatch, matchedBy: "project code" };
  }

  const normalizedProjectName = normalizeInventoryKey(project.project_name);
  const normalizedProjectCode = normalizeInventoryKey(project.project_code);

  const normalizedNameMatch = activeSiteSources.find(
    (source) => normalizeInventoryKey(source.sourceName) === normalizedProjectName
  );

  if (normalizedNameMatch) {
    return { source: normalizedNameMatch, matchedBy: "project name" };
  }

  const normalizedCodeMatch = activeSiteSources.find(
    (source) => normalizeInventoryKey(source.sourceName) === normalizedProjectCode
  );

  if (normalizedCodeMatch) {
    return { source: normalizedCodeMatch, matchedBy: "project code" };
  }

  return null;
}

function getBalanceMovementHistory(
  row: SiteInventoryBalance,
  transactions: SiteInventoryTransaction[]
): BalanceMovement[] {
  let runningTotal = 0;

  return transactions
    .flatMap((transaction) =>
      transaction.lines.flatMap((line) => {
        if (line.itemId !== row.itemId || line.unit !== row.unit) {
          return [];
        }

        const quantityIn =
          transaction.toSourceId === row.siteSourceId &&
          transaction.toSourceType === "Site"
            ? line.quantity
            : 0;
        const quantityOut =
          transaction.fromSourceId === row.siteSourceId &&
          transaction.fromSourceType === "Site"
            ? line.quantity
            : 0;

        if (!quantityIn && !quantityOut) {
          return [];
        }

        return [
          {
            transaction,
            line,
            quantityIn,
            quantityOut,
            netQuantity: quantityIn - quantityOut,
            runningTotal: 0,
          },
        ];
      })
    )
    .sort(
      (left, right) =>
        getInventoryMovementTime(left.transaction) -
        getInventoryMovementTime(right.transaction)
    )
    .map((movement) => {
      runningTotal += movement.netQuantity;
      return { ...movement, runningTotal };
    });
}

function getInventoryMovementTime(transaction: SiteInventoryTransaction) {
  const transactionTime = new Date(transaction.transactionDate).getTime();
  const createdTime = new Date(transaction.createdAt).getTime();

  return (Number.isNaN(transactionTime) ? 0 : transactionTime) +
    (Number.isNaN(createdTime) ? 0 : createdTime / 100000000);
}

function normalizeInventoryKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 4 4 9M15 4l5 5M9 20l-5-5M15 20l5-5"
      />
    </svg>
  );
}
