"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { buildEstimateBadges } from "@/features/dashboard/components/job-estimate-branch-metrics";
import { JobEstimateHierarchyNode } from "@/features/dashboard/components/job-estimate-hierarchy-node";
import { getPlumbingPipeCostCodeHierarchy } from "@/features/dashboard/services/get-plumbing-pipe-cost-code-hierarchy";
import { getJobEstimateAreaTakeoffs } from "@/features/dashboard/services/get-job-estimate-area-takeoffs";
import { getJobEstimateDetailedItem } from "@/features/dashboard/services/get-job-estimate-detailed-item";
import { getJobEstimateFinishes } from "@/features/dashboard/services/get-job-estimate-finishes";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import { saveJobEstimateDetailedItem } from "@/features/dashboard/services/save-job-estimate-detailed-item";
import type {
  CostCodeHierarchyNode,
  JobEstimate,
  JobEstimateAreaTakeoff,
  JobEstimateFinish,
  JobEstimateProjectDetails,
} from "@/features/dashboard/types/job-estimate";

type PlumbingPipeReviewRow = {
  item: string;
  quantity: string;
  unit: "LF";
  assumedSystem: string;
  materialCostPerUnit: string;
  labourCostPerUnit: string;
  equipmentCostPerUnit: string;
  assumptions: string;
  confidence: "low" | "medium" | "high" | "pending";
  status: string;
};

type JobEstimatePlumbingPipeEstimateBranchProps = {
  estimate: JobEstimate;
  itemOnly?: boolean;
  grossFloorArea: number;
  defaultItemOpen?: boolean;
  onTotalChange?: (total: number) => void;
  savedById: string | null;
  savedByName: string;
};

const defaultHierarchy: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "MEP",
  subSubCategory: "Plumbing",
  item: "Plumbing Pipe",
  costCode: "D2024",
};

const emptyProjectDetails: JobEstimateProjectDetails = {
  id: null,
  jobEstimateProjectId: 0,
  projectName: "",
  projectType: "",
  client: "",
  architect: "",
  contractType: "",
  submissionDeadline: "",
  tenderEstimatedAmount: "",
  city: "",
  state: "",
  country: "",
  totalPlotArea: "",
  boundaryWall: "",
  basementCount: "",
  basementArea: "",
  superstructureFootprint: "",
  stiltFloorCount: "",
  floorCount: "",
  foundationType: "",
  superstructureType: "",
  createdById: null,
  createdByName: "",
  createdAt: null,
};

const defaultReviewRow: PlumbingPipeReviewRow = {
  item: "Plumbing Pipe",
  quantity: "",
  unit: "LF",
  assumedSystem: "Pending AI",
  materialCostPerUnit: "",
  labourCostPerUnit: "",
  equipmentCostPerUnit: "",
  assumptions: "Awaiting AI draft",
  confidence: "pending",
  status: "Awaiting draft",
};

export function JobEstimatePlumbingPipeEstimateBranch({
  estimate,
  itemOnly = false,
  grossFloorArea,
  defaultItemOpen = true,
  onTotalChange,
  savedById,
  savedByName,
}: JobEstimatePlumbingPipeEstimateBranchProps) {
  const [areaTakeoffs, setAreaTakeoffs] = useState<JobEstimateAreaTakeoff[]>([]);
  const [finishes, setFinishes] = useState<JobEstimateFinish[]>([]);
  const [projectDetails, setProjectDetails] =
    useState<JobEstimateProjectDetails>(emptyProjectDetails);
  const [hierarchy, setHierarchy] = useState<CostCodeHierarchyNode>(defaultHierarchy);
  const [reviewRow, setReviewRow] =
    useState<PlumbingPipeReviewRow>(defaultReviewRow);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationStatusMessage, setGenerationStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [saveStatusMessage, setSaveStatusMessage] = useState("");
  const [persistedSignature, setPersistedSignature] = useState("");
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);
  const [isSubCategoryOpen, setIsSubCategoryOpen] = useState(true);
  const [isSubSubCategoryOpen, setIsSubSubCategoryOpen] = useState(true);
  const [isItemOpen, setIsItemOpen] = useState(defaultItemOpen);

  useEffect(() => {
    let isMounted = true;

    async function loadBranch() {
      setIsLoading(true);

      try {
        const [
          loadedAreaTakeoffs,
          loadedFinishes,
          loadedProjectDetails,
          loadedHierarchy,
          savedEstimate,
        ] = await Promise.all([
          getJobEstimateAreaTakeoffs(estimate.id),
          getJobEstimateFinishes(estimate.id),
          getJobEstimateProjectDetails(estimate),
          getPlumbingPipeCostCodeHierarchy(),
          getJobEstimateDetailedItem(estimate.id, "D2024"),
        ]);

        if (!isMounted) {
          return;
        }

        setAreaTakeoffs(loadedAreaTakeoffs);
        setFinishes(loadedFinishes);
        setProjectDetails(loadedProjectDetails);
        setHierarchy(loadedHierarchy);
        const initialReviewRow = buildReviewRow(savedEstimate);
        setReviewRow(initialReviewRow);
        setPersistedSignature(createSignature(initialReviewRow));
      } catch (error) {
        console.error("Failed to load plumbing pipe estimate branch:", error);

        if (isMounted) {
          setAreaTakeoffs([]);
          setFinishes([]);
          setProjectDetails(emptyProjectDetails);
          setHierarchy(defaultHierarchy);
          setReviewRow(defaultReviewRow);
          setPersistedSignature(createSignature(defaultReviewRow));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBranch();

    return () => {
      isMounted = false;
    };
  }, [estimate]);

  const sourceRows = useMemo(
    () =>
      areaTakeoffs.filter(
        (row) => row.roomType.trim() || row.area.trim() || row.floorFinish.trim()
      ),
    [areaTakeoffs]
  );

  const branchTotal = useMemo(() => calculateRowTotal(reviewRow), [reviewRow]);
  const totalQuantity = useMemo(
    () => parseOptionalNumber(reviewRow.quantity),
    [reviewRow.quantity]
  );
  const currentSignature = useMemo(() => createSignature(reviewRow), [reviewRow]);
  const hasUnsavedChanges = currentSignature !== persistedSignature;

  useEffect(() => {
    onTotalChange?.(branchTotal);
  }, [branchTotal, onTotalChange]);

  async function handleSaveChanges() {
    setIsSaving(true);
    setSaveErrorMessage("");
    setSaveStatusMessage("Saving changes...");

    try {
      await saveJobEstimateDetailedItem({
        jobEstimateId: estimate.id,
        costCode: "D2024",
        itemName: "Plumbing Pipe",
        unit: "LF",
        saveStatus: "reviewed",
        sourceType: "ai_edited",
        savedById,
        savedByName,
        rows: [
          {
            rowKey: "d2024-main",
            rowLabel: "Plumbing Pipe",
            quantity: parseOptionalNumber(reviewRow.quantity),
            unit: "LF",
            materialCostPerUnit: parseOptionalNumber(reviewRow.materialCostPerUnit),
            labourCostPerUnit: parseOptionalNumber(reviewRow.labourCostPerUnit),
            equipmentCostPerUnit: parseOptionalNumber(reviewRow.equipmentCostPerUnit),
            totalCostPerUnit: calculateRatePerUnit(reviewRow),
            rowTotal: calculateRowTotal(reviewRow),
            assumedSystem: reviewRow.assumedSystem,
            assumptions: reviewRow.assumptions,
            confidence: reviewRow.confidence,
            status: reviewRow.status,
            sortOrder: 0,
          },
        ],
      });

      setPersistedSignature(currentSignature);
      setSaveStatusMessage(`Saved at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error(error);
      setSaveErrorMessage(
        error instanceof Error ? error.message : "Failed to save estimate changes."
      );
      setSaveStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateDraft() {
    if (sourceRows.length === 0) {
      return;
    }

    setIsGeneratingDraft(true);
    setGenerationError("");
    setGenerationStatusMessage("Generating plumbing pipe draft...");

    try {
      const response = await fetch("/api/job-estimates/plumbing-pipe-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estimate: {
            id: estimate.id,
            projectName: estimate.projectName,
            projectType: estimate.projectType,
          },
          projectDetails: {
            city: projectDetails.city,
            state: projectDetails.state,
            country: projectDetails.country,
            contractType: projectDetails.contractType,
            foundationType: projectDetails.foundationType,
            superstructureType: projectDetails.superstructureType,
            totalPlotArea: projectDetails.totalPlotArea,
            basementCount: projectDetails.basementCount,
            basementArea: projectDetails.basementArea,
            superstructureFootprint: projectDetails.superstructureFootprint,
            stiltFloorCount: projectDetails.stiltFloorCount,
            floorCount: projectDetails.floorCount,
          },
          areaTakeoffs: sourceRows.map((row) => ({
            roomType: row.roomType,
            areaSqft: parseOptionalNumber(row.area),
            floorFinish: row.floorFinish,
          })),
          allFinishes: finishes.map((row) => ({
            finishType: row.finishType,
            description: row.description,
          })),
        }),
      });

      const payload = (await response.json()) as
        | {
            item?: string;
            quantity?: number;
            unit?: "LF";
            assumedSystem?: string;
            materialCostPerUnit?: number;
            labourCostPerUnit?: number;
            equipmentCostPerUnit?: number;
            assumptions?: string;
            confidence?: "low" | "medium" | "high";
            error?: string;
          }
        | undefined;

      if (!response.ok) {
        throw new Error(
          payload?.error || "Failed to generate plumbing pipe draft."
        );
      }

      setReviewRow((previousRow) => ({
        ...previousRow,
        item: payload?.item?.trim() || "Plumbing Pipe",
        quantity: formatQuantityValue(payload?.quantity ?? 0),
        unit: "LF",
        assumedSystem: payload?.assumedSystem?.trim() || "Pending AI",
        materialCostPerUnit: formatCurrencyNumber(
          payload?.materialCostPerUnit ?? 0
        ),
        labourCostPerUnit: formatCurrencyNumber(payload?.labourCostPerUnit ?? 0),
        equipmentCostPerUnit: formatCurrencyNumber(
          payload?.equipmentCostPerUnit ?? 0
        ),
        assumptions: payload?.assumptions?.trim() || "Awaiting AI draft",
        confidence: payload?.confidence ?? "pending",
        status: "AI drafted",
      }));

      setGenerationStatusMessage(
        `Draft generated at ${new Date().toLocaleTimeString()}`
      );
    } catch (error) {
      console.error(error);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Failed to generate plumbing pipe draft."
      );
      setGenerationStatusMessage("");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function handleRowChange(
    key: keyof Pick<
      PlumbingPipeReviewRow,
      | "quantity"
      | "materialCostPerUnit"
      | "labourCostPerUnit"
      | "equipmentCostPerUnit"
    >,
    value: string
  ) {
    setReviewRow((previousRow) => ({
      ...previousRow,
      [key]: value,
    }));
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
        Loading Plumbing Pipe estimate branch...
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <JobEstimateHierarchyNode
        level={0}
        label={hierarchy.category}
        meta="Category"
        isOpen={itemOnly ? true : isCategoryOpen}
        onToggle={() => setIsCategoryOpen((value) => !value)}
        hideHeader={itemOnly}
      >
        <JobEstimateHierarchyNode
          level={1}
          label={hierarchy.subCategory}
          meta="Sub-Category"
          isOpen={itemOnly ? true : isSubCategoryOpen}
          onToggle={() => setIsSubCategoryOpen((value) => !value)}
          hideHeader={itemOnly}
        >
          <JobEstimateHierarchyNode
            level={2}
            label={hierarchy.subSubCategory}
            meta="Sub-Sub-Category"
            isOpen={itemOnly ? true : isSubSubCategoryOpen}
            onToggle={() => setIsSubSubCategoryOpen((value) => !value)}
            hideHeader={itemOnly}
          >
            <JobEstimateHierarchyNode
              level={itemOnly ? 0 : 3}
              label={hierarchy.item}
              meta={`Item • ${hierarchy.costCode}`}
              badge={buildEstimateBadges({
                totalCost: branchTotal,
                totalQuantity,
                grossFloorArea,
                quantityUnitLabel: "LF",
              })}
              isOpen={isItemOpen}
              onToggle={() => setIsItemOpen((value) => !value)}
            >
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                      Review Table
                    </p>
                    <h4 className="text-lg font-semibold">
                      Plumbing Pipe Cost Breakdown Review
                    </h4>
                    <p className="text-sm text-[var(--muted)]">
                      Generate a draft using project details, area takeoffs, and
                      finishes. This scope includes the plumbing piping network only and excludes sanitary fixtures, taps, and other plumbing fixtures.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateDraft()}
                      disabled={sourceRows.length === 0 || isGeneratingDraft}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingDraft
                        ? "Generating Draft..."
                        : "Generate Plumbing Pipe Draft"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveChanges()}
                      disabled={!hasUnsavedChanges || isSaving}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>

                {generationError ? (
                  <div className="mt-4 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">
                    {generationError}
                  </div>
                ) : null}

                {generationStatusMessage ? (
                  <div className="mt-4 rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-fg)]">
                    {generationStatusMessage}
                  </div>
                ) : null}

                {saveErrorMessage ? (
                  <div className="mt-4 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-fg)]">
                    {saveErrorMessage}
                  </div>
                ) : null}

                {saveStatusMessage ? (
                  <div className="mt-4 rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-fg)]">
                    {saveStatusMessage}
                  </div>
                ) : null}

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-[1040px] divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="w-[28rem] px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Item
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Quantity (LF)
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Material / LF
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Labour / LF
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Equipment / LF
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Total / LF
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Row Total
                        </th>
                        <th className="w-[15rem] px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      <tr>
                        <td className="px-3 py-3 align-top whitespace-normal break-words">
                          <p className="font-medium">{reviewRow.item}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {reviewRow.assumedSystem}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                            {reviewRow.assumptions}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.quantity}
                            onChange={(event) =>
                              handleRowChange("quantity", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.materialCostPerUnit}
                            onChange={(event) =>
                              handleRowChange(
                                "materialCostPerUnit",
                                event.target.value
                              )
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.labourCostPerUnit}
                            onChange={(event) =>
                              handleRowChange("labourCostPerUnit", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.equipmentCostPerUnit}
                            onChange={(event) =>
                              handleRowChange(
                                "equipmentCostPerUnit",
                                event.target.value
                              )
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                          INR {formatCurrencyNumber(calculateRatePerUnit(reviewRow))}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                          INR {formatCurrencyNumber(calculateRowTotal(reviewRow))}
                        </td>
                        <td className="px-3 py-3 align-top whitespace-normal break-words">
                          <span className={buildStatusClassName(reviewRow.confidence)}>
                            {buildStatusLabel(reviewRow)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--surface)]">
                        <td className="px-3 py-3 font-semibold" colSpan={6}>
                          Plumbing Pipe Branch Total
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap font-semibold text-[var(--foreground)]">
                          INR {formatCurrencyNumber(branchTotal)}
                        </td>
                        <td className="px-3 py-3 text-[var(--muted)]">Review</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </JobEstimateHierarchyNode>
          </JobEstimateHierarchyNode>
        </JobEstimateHierarchyNode>
      </JobEstimateHierarchyNode>
    </div>
  );
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantityValue(value: number) {
  return Number.isFinite(value)
    ? Number.isInteger(value)
      ? String(value)
      : value.toFixed(2)
    : "0";
}

function calculateRatePerUnit(row: {
  materialCostPerUnit: string;
  labourCostPerUnit: string;
  equipmentCostPerUnit: string;
}) {
  return (
    parseOptionalNumber(row.materialCostPerUnit) +
    parseOptionalNumber(row.labourCostPerUnit) +
    parseOptionalNumber(row.equipmentCostPerUnit)
  );
}

function calculateRowTotal(row: {
  quantity: string;
  materialCostPerUnit: string;
  labourCostPerUnit: string;
  equipmentCostPerUnit: string;
}) {
  return calculateRatePerUnit(row) * parseOptionalNumber(row.quantity);
}

function buildStatusLabel(row: {
  confidence: PlumbingPipeReviewRow["confidence"];
  status: string;
}) {
  if (row.confidence === "pending") {
    return row.status;
  }

  return `${row.status} • ${row.confidence} confidence`;
}

function buildStatusClassName(
  confidence: PlumbingPipeReviewRow["confidence"]
) {
  const baseClassName =
    "inline-flex rounded-full px-2.5 py-1 text-xs font-medium border whitespace-normal break-words leading-5";

  if (confidence === "high") {
    return `${baseClassName} border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]`;
  }

  if (confidence === "medium") {
    return `${baseClassName} border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]`;
  }

  if (confidence === "low") {
    return `${baseClassName} border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]`;
  }

  return `${baseClassName} border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-fg)]`;
}

function formatCurrencyNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function buildReviewRow(
  savedEstimate: Awaited<ReturnType<typeof getJobEstimateDetailedItem>>
): PlumbingPipeReviewRow {
  const savedRow = savedEstimate?.rows[0];

  if (!savedRow) {
    return defaultReviewRow;
  }

  return {
    item: savedEstimate?.item.itemName ?? "Plumbing Pipe",
    quantity: formatQuantityValue(savedRow.quantity),
    unit: "LF",
    assumedSystem: savedRow.assumedSystem || "Pending AI",
    materialCostPerUnit: formatCurrencyNumber(savedRow.materialCostPerUnit),
    labourCostPerUnit: formatCurrencyNumber(savedRow.labourCostPerUnit),
    equipmentCostPerUnit: formatCurrencyNumber(savedRow.equipmentCostPerUnit),
    assumptions: savedRow.assumptions || "Awaiting AI draft",
    confidence:
      savedRow.confidence === "low" ||
      savedRow.confidence === "medium" ||
      savedRow.confidence === "high"
        ? savedRow.confidence
        : "pending",
    status: savedRow.status || "Awaiting draft",
  };
}

function createSignature(row: PlumbingPipeReviewRow) {
  return JSON.stringify({
    item: row.item,
    quantity: row.quantity,
    unit: row.unit,
    assumedSystem: row.assumedSystem,
    materialCostPerUnit: row.materialCostPerUnit,
    labourCostPerUnit: row.labourCostPerUnit,
    equipmentCostPerUnit: row.equipmentCostPerUnit,
    assumptions: row.assumptions,
    confidence: row.confidence,
    status: row.status,
  });
}







