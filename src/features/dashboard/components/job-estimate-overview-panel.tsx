"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  formatAreaNumber,
  formatCurrencyNumber,
} from "@/features/dashboard/components/job-estimate-branch-metrics";
import { getJobEstimateDetailedItem } from "@/features/dashboard/services/get-job-estimate-detailed-item";
import { getJobEstimateOverviewSummary } from "@/features/dashboard/services/get-job-estimate-overview-summary";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import { saveJobEstimateDetailedItem } from "@/features/dashboard/services/save-job-estimate-detailed-item";
import type {
  JobEstimate,
  JobEstimateDetailedItemRow,
  JobEstimateDetailedItemWithRows,
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
  const [editingOverviewRow, setEditingOverviewRow] = useState<OverviewRow | null>(
    null
  );
  const [editingDetailedItem, setEditingDetailedItem] =
    useState<JobEstimateDetailedItemWithRows | null>(null);
  const [editingRows, setEditingRows] = useState<EditableOverviewDetailRow[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoadingEditRows, setIsLoadingEditRows] = useState(false);
  const [isSavingEditRows, setIsSavingEditRows] = useState(false);
  const [editErrorMessage, setEditErrorMessage] = useState("");

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
        const unitQuantity =
          item.quantityPerGfa > 0
            ? item.quantityPerGfa
            : grossFloorArea > 0
              ? item.quantity / grossFloorArea
              : 0;
        const unitCost = item.quantity > 0 ? item.cost / item.quantity : 0;

        return {
          ...item,
          unitQuantity,
          unitCost,
        };
      }),
    [grossFloorArea, summaryItems]
  );
  const overviewGroups = useMemo(() => groupOverviewRows(overviewRows), [overviewRows]);

  const estimatedProjectCost = useMemo(
    () => overviewRows.reduce((sum, row) => sum + row.cost, 0),
    [overviewRows]
  );
  const estimatedUnitCost = useMemo(
    () => (grossFloorArea > 0 ? estimatedProjectCost / grossFloorArea : 0),
    [estimatedProjectCost, grossFloorArea]
  );

  async function refreshOverviewSummary() {
    const loadedSummaryItems = await getJobEstimateOverviewSummary(estimate.id);
    setSummaryItems(loadedSummaryItems);
  }

  async function handleOpenEditDialog(row: OverviewRow) {
    setEditingOverviewRow(row);
    setEditingDetailedItem(null);
    setEditingRows([]);
    setEditErrorMessage("");
    setIsEditDialogOpen(true);
    setIsLoadingEditRows(true);

    try {
      const detailedItem = await getJobEstimateDetailedItem(estimate.id, row.costCode);

      if (!detailedItem) {
        throw new Error("Could not find the saved detailed estimate for this item.");
      }

      setEditingDetailedItem(detailedItem);
      setEditingRows(detailedItem.rows.map(mapDetailedRowToEditableRow));
    } catch (error) {
      console.error("Failed to load overview edit row:", error);
      setEditErrorMessage(
        error instanceof Error ? error.message : "Failed to load this estimate item."
      );
    } finally {
      setIsLoadingEditRows(false);
    }
  }

  function handleCloseEditDialog() {
    if (isSavingEditRows) {
      return;
    }

    setIsEditDialogOpen(false);
    setEditingOverviewRow(null);
    setEditingDetailedItem(null);
    setEditingRows([]);
    setEditErrorMessage("");
  }

  function handleEditRowChange(
    rowKey: string,
    key: keyof EditableOverviewDetailRow,
    value: string
  ) {
    setEditingRows((previousRows) =>
      previousRows.map((row) => {
        if (row.rowKey !== rowKey) {
          return row;
        }

        const nextRow = {
          ...row,
          [key]: value,
        };

        if (key === "quantityPerGfa") {
          const ratio = parseOptionalNumber(value);
          nextRow.quantity =
            value.trim() && grossFloorArea > 0
              ? formatEditableNumber(ratio * grossFloorArea)
              : "";
        }

        if (key === "quantity") {
          const quantity = parseOptionalNumber(value);
          nextRow.quantityPerGfa =
            value.trim() && grossFloorArea > 0
              ? formatEditableRatio(quantity / grossFloorArea)
              : "";
        }

        return nextRow;
      })
    );
  }

  async function handleSaveOverviewEdit() {
    if (!editingDetailedItem) {
      return;
    }

    setIsSavingEditRows(true);
    setEditErrorMessage("");

    try {
      await saveJobEstimateDetailedItem({
        jobEstimateId: estimate.id,
        costCode: editingDetailedItem.item.costCode,
        itemName: editingDetailedItem.item.itemName,
        unit: editingDetailedItem.item.unit,
        gfaSnapshot: grossFloorArea,
        saveStatus: "reviewed",
        sourceType: "manual_override",
        aiGeneratedAt: editingDetailedItem.item.aiGeneratedAt,
        savedById: editingDetailedItem.item.savedById,
        savedByName: editingDetailedItem.item.savedByName,
        rows: editingRows.map((row, index) => {
          const materialCostPerUnit = parseOptionalNumber(row.materialCostPerUnit);
          const labourCostPerUnit = parseOptionalNumber(row.labourCostPerUnit);
          const equipmentCostPerUnit = parseOptionalNumber(row.equipmentCostPerUnit);
          const totalCostPerUnit =
            materialCostPerUnit + labourCostPerUnit + equipmentCostPerUnit;
          const quantity = parseOptionalNumber(row.quantity);

          return {
            rowKey: row.rowKey,
            rowLabel: row.rowLabel.trim() || editingDetailedItem.item.itemName,
            quantity,
            quantityPerGfa: parseOptionalNumber(row.quantityPerGfa),
            unit: row.unit.trim() || editingDetailedItem.item.unit,
            materialCostPerUnit,
            labourCostPerUnit,
            equipmentCostPerUnit,
            totalCostPerUnit,
            rowTotal: quantity * totalCostPerUnit,
            assumedSystem: row.assumedSystem,
            assumptions: row.assumptions,
            confidence: row.confidence.trim() || "reviewed",
            status: row.status.trim() || "Reviewed",
            sortOrder: row.sortOrder ?? index,
          };
        }),
      });

      await refreshOverviewSummary();
      handleCloseEditDialog();
    } catch (error) {
      console.error("Failed to save overview edit row:", error);
      setEditErrorMessage(
        error instanceof Error ? error.message : "Failed to save this estimate item."
      );
    } finally {
      setIsSavingEditRows(false);
    }
  }

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
            <table className="w-full min-w-[1260px] border-collapse text-left text-sm">
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
                  <th className="px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Unit Quantity (Unit/GFA)
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Unit
                  </th>
                  <th className="px-3 py-2 text-center text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Quantity
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Unit Cost
                  </th>
                  <th className="px-3 py-2 pr-8 text-right text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Cost
                  </th>
                  <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {overviewGroups.map((group) => (
                  <Fragment key={group.category}>
                    <tr className="border-t border-[var(--border)] bg-[var(--surface)]">
                      <td
                        className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]"
                        colSpan={7}
                      >
                        {group.category}
                      </td>
                      <td className="px-3 py-2.5 pr-8 whitespace-nowrap text-right text-xs font-semibold text-[var(--foreground)]">
                        INR {formatCurrencyNumber(group.cost)}
                      </td>
                      <td className="px-3 py-2.5"> </td>
                    </tr>

                    {group.rows.map((row) => (
                      <tr key={row.costCode} className="bg-[var(--panel)]">
                        <td className="px-3 py-2 text-xs text-[var(--subtle)]">
                          {" "}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-[var(--muted)]">
                          {row.costCode}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {row.item}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap text-[var(--muted)]">
                          {grossFloorArea > 0 ? formatMetricNumber(row.unitQuantity) : "--"}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap text-[var(--muted)]">
                          {row.unit || "--"}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap text-[var(--muted)]">
                          {formatAreaNumber(row.quantity)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-left text-[var(--muted)]">
                          {row.quantity > 0
                            ? `INR ${formatCurrencyNumber(row.unitCost)}/${row.unit || "unit"}`
                            : "--"}
                        </td>
                        <td className="px-3 py-2 pr-8 whitespace-nowrap text-right font-medium">
                          INR {formatCurrencyNumber(row.cost)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void handleOpenEditDialog(row)}
                            className="rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-[var(--border-strong)]"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isEditDialogOpen && editingOverviewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="max-h-[92vh] w-[96vw] max-w-[96rem] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                  Quick Edit
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  {editingOverviewRow.costCode} - {editingOverviewRow.item}
                </h3>
                <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
                  Edit the saved detailed estimate rows for this item. Quantity and
                  totals recalculate as you type.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseEditDialog}
                disabled={isSavingEditRows}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(92vh-8rem)] overflow-y-auto p-5">
              {isLoadingEditRows ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
                  Loading item details...
                </div>
              ) : editErrorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {editErrorMessage}
                </div>
              ) : editingRows.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
                  This estimate item does not have any saved rows yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                      <thead className="bg-[var(--surface)]">
                        <tr>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                            Row
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Quantity/GFA
                          </th>
                          <th className="text-right px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Quantity
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Unit
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Material / Unit
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Labour / Unit
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Equipment / Unit
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Total / Unit
                          </th>
                          <th className="px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap">
                            Row Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {editingRows.map((row) => (
                          <Fragment key={row.rowKey}>
                            <tr>
                              <td className="min-w-[240px] px-3 py-2">
                                <Input
                                  value={row.rowLabel}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "rowLabel",
                                      event.target.value
                                    )
                                  }
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="min-w-[140px] px-3 py-2">
                                <Input
                                  value={row.quantityPerGfa}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "quantityPerGfa",
                                      event.target.value
                                    )
                                  }
                                  inputMode="decimal"
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="min-w-[140px] px-3 py-2">
                                <Input
                                  value={row.quantity}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "quantity",
                                      event.target.value
                                    )
                                  }
                                  inputMode="decimal"
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="min-w-[110px] px-3 py-2">
                                <Input
                                  value={row.unit}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "unit",
                                      event.target.value
                                    )
                                  }
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="min-w-[150px] px-3 py-2">
                                <Input
                                  value={row.materialCostPerUnit}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "materialCostPerUnit",
                                      event.target.value
                                    )
                                  }
                                  inputMode="decimal"
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="min-w-[150px] px-3 py-2">
                                <Input
                                  value={row.labourCostPerUnit}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "labourCostPerUnit",
                                      event.target.value
                                    )
                                  }
                                  inputMode="decimal"
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="min-w-[150px] px-3 py-2">
                                <Input
                                  value={row.equipmentCostPerUnit}
                                  onChange={(event) =>
                                    handleEditRowChange(
                                      row.rowKey,
                                      "equipmentCostPerUnit",
                                      event.target.value
                                    )
                                  }
                                  inputMode="decimal"
                                  className="rounded-xl px-3 py-2"
                                />
                              </td>
                              <td className="text-right px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                                INR {formatCurrencyNumber(calculateEditableRate(row))}
                              </td>
                              <td className="text-right px-3 py-2 whitespace-nowrap font-medium">
                                INR {formatCurrencyNumber(calculateEditableRowTotal(row))}
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-[var(--muted)]">
                      This saves back to Detailed Job Estimate for{" "}
                      <span className="font-semibold text-[var(--foreground)]">
                        {editingOverviewRow.costCode}
                      </span>
                      .
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {editErrorMessage ? (
                        <span className="text-sm text-red-600">{editErrorMessage}</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleCloseEditDialog}
                        disabled={isSavingEditRows}
                        className="rounded-2xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveOverviewEdit()}
                        disabled={isSavingEditRows}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingEditRows ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.replace(/,/g, "").trim();
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

type OverviewRow = JobEstimateOverviewSummaryItem & {
  unitQuantity: number;
  unitCost: number;
};

type EditableOverviewDetailRow = {
  rowKey: string;
  rowLabel: string;
  quantityPerGfa: string;
  quantity: string;
  unit: string;
  materialCostPerUnit: string;
  labourCostPerUnit: string;
  equipmentCostPerUnit: string;
  assumedSystem: string;
  assumptions: string;
  confidence: string;
  status: string;
  sortOrder: number;
};

function mapDetailedRowToEditableRow(
  row: JobEstimateDetailedItemRow
): EditableOverviewDetailRow {
  return {
    rowKey: row.rowKey,
    rowLabel: row.rowLabel,
    quantityPerGfa: formatEditableRatio(row.quantityPerGfa),
    quantity: formatEditableNumber(row.quantity),
    unit: row.unit,
    materialCostPerUnit: formatEditableNumber(row.materialCostPerUnit),
    labourCostPerUnit: formatEditableNumber(row.labourCostPerUnit),
    equipmentCostPerUnit: formatEditableNumber(row.equipmentCostPerUnit),
    assumedSystem: row.assumedSystem,
    assumptions: row.assumptions,
    confidence: row.confidence,
    status: row.status,
    sortOrder: row.sortOrder,
  };
}

function calculateEditableRate(row: EditableOverviewDetailRow) {
  return (
    parseOptionalNumber(row.materialCostPerUnit) +
    parseOptionalNumber(row.labourCostPerUnit) +
    parseOptionalNumber(row.equipmentCostPerUnit)
  );
}

function calculateEditableRowTotal(row: EditableOverviewDetailRow) {
  return parseOptionalNumber(row.quantity) * calculateEditableRate(row);
}

function formatEditableNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value
    .toFixed(4)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatEditableRatio(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value
    .toFixed(6)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function groupOverviewRows(rows: OverviewRow[]) {
  const groupsByCategory = new Map<
    string,
    { category: string; rows: OverviewRow[]; cost: number }
  >();

  for (const row of rows) {
    const category = row.category || "Uncategorized";
    const group = groupsByCategory.get(category) ?? {
      category,
      rows: [],
      cost: 0,
    };

    group.rows.push(row);
    group.cost += row.cost;
    groupsByCategory.set(category, group);
  }

  return Array.from(groupsByCategory.values());
}






