"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { buildEstimateBadges } from "@/features/dashboard/components/job-estimate-branch-metrics";
import { JobEstimateHierarchyNode } from "@/features/dashboard/components/job-estimate-hierarchy-node";
import { getJobEstimateAreaTakeoffs } from "@/features/dashboard/services/get-job-estimate-area-takeoffs";
import { getJobEstimateDetailedItem } from "@/features/dashboard/services/get-job-estimate-detailed-item";
import { getFlooringCostCodeHierarchy } from "@/features/dashboard/services/get-flooring-cost-code-hierarchy";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import { saveJobEstimateDetailedItem } from "@/features/dashboard/services/save-job-estimate-detailed-item";
import type {
  CostCodeHierarchyNode,
  JobEstimate,
  JobEstimateAreaTakeoff,
  JobEstimateProjectDetails,
} from "@/features/dashboard/types/job-estimate";

type FlooringReviewRow = {
  id: number;
  roomType: string;
  area: string;
  floorFinish: string;
  assumedFinishSystem: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
  assumptions: string;
  confidence: "low" | "medium" | "high" | "pending";
  status: string;
};

type JobEstimateFlooringEstimateBranchProps = {
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
  subCategory: "Finishes",
  subSubCategory: "Floor Finishes",
  item: "Flooring",
  costCode: "C3024",
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

export function JobEstimateFlooringEstimateBranch({
  estimate,
  itemOnly = false,
  grossFloorArea,
  defaultItemOpen = true,
  onTotalChange,
  savedById,
  savedByName,
}: JobEstimateFlooringEstimateBranchProps) {
  const [areaTakeoffs, setAreaTakeoffs] = useState<JobEstimateAreaTakeoff[]>([]);
  const [projectDetails, setProjectDetails] =
    useState<JobEstimateProjectDetails>(emptyProjectDetails);
  const [hierarchy, setHierarchy] = useState<CostCodeHierarchyNode>(defaultHierarchy);
  const [reviewRows, setReviewRows] = useState<FlooringReviewRow[]>([]);
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
          loadedHierarchy,
          loadedProjectDetails,
          savedEstimate,
        ] =
          await Promise.all([
            getJobEstimateAreaTakeoffs(estimate.id),
            getFlooringCostCodeHierarchy(),
            getJobEstimateProjectDetails(estimate),
            getJobEstimateDetailedItem(estimate.id, "C3024"),
          ]);

        if (!isMounted) {
          return;
        }

        setAreaTakeoffs(loadedAreaTakeoffs);
        setHierarchy(loadedHierarchy);
        setProjectDetails(loadedProjectDetails);
        const initialReviewRows = buildReviewRows(loadedAreaTakeoffs, savedEstimate);
        setReviewRows(initialReviewRows);
        setPersistedSignature(createSignature(initialReviewRows));
      } catch (error) {
        console.error("Failed to load flooring estimate branch:", error);

        if (isMounted) {
          setAreaTakeoffs([]);
          setHierarchy(defaultHierarchy);
          setProjectDetails(emptyProjectDetails);
          setReviewRows([]);
          setPersistedSignature(createSignature([]));
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

  useEffect(() => {
    setReviewRows((previousRows) => buildReviewRows(sourceRows, undefined, previousRows));
  }, [sourceRows]);

  const branchTotal = useMemo(
    () => reviewRows.reduce((sum, row) => sum + calculateRowTotal(row), 0),
    [reviewRows]
  );
  const totalQuantity = useMemo(
    () => reviewRows.reduce((sum, row) => sum + parseOptionalNumber(row.area), 0),
    [reviewRows]
  );
  const currentSignature = useMemo(() => createSignature(reviewRows), [reviewRows]);
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
        costCode: "C3024",
        itemName: "Flooring",
        unit: "sq.ft",
        saveStatus: "reviewed",
        sourceType: "ai_edited",
        savedById,
        savedByName,
        rows: reviewRows.map((row, index) => ({
          rowKey: `flooring-${row.id}`,
          rowLabel: row.roomType,
          quantity: parseOptionalNumber(row.area),
          unit: "sq.ft",
          materialCostPerUnit: parseOptionalNumber(row.materialCostPerSqft),
          labourCostPerUnit: parseOptionalNumber(row.labourCostPerSqft),
          equipmentCostPerUnit: parseOptionalNumber(row.equipmentCostPerSqft),
          totalCostPerUnit: calculateRatePerSqft(row),
          rowTotal: calculateRowTotal(row),
          assumedSystem: row.assumedFinishSystem,
          assumptions: row.assumptions,
          confidence: row.confidence,
          status: row.status,
          sortOrder: index,
        })),
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
    if (reviewRows.length === 0) {
      return;
    }

    setIsGeneratingDraft(true);
    setGenerationError("");
    setGenerationStatusMessage("Generating flooring draft...");

    try {
      const response = await fetch("/api/job-estimates/flooring-draft", {
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
          },
          rows: reviewRows.map((row) => ({
            sourceRowId: row.id,
            roomType: row.roomType,
            areaSqft: parseOptionalNumber(row.area),
            floorFinish: row.floorFinish,
          })),
        }),
      });

      const payload = (await response.json()) as
        | {
            rows?: Array<{
              sourceRowId: number;
              assumedFinishSystem: string;
              materialCostPerSqft: number;
              labourCostPerSqft: number;
              equipmentCostPerSqft: number;
              assumptions: string;
              confidence: "low" | "medium" | "high";
            }>;
            error?: string;
          }
        | undefined;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to generate flooring draft.");
      }

      const generatedRows = payload?.rows ?? [];

      setReviewRows((previousRows) =>
        previousRows.map((row) => {
          const generatedRow = generatedRows.find(
            (candidate) => candidate.sourceRowId === row.id
          );

          if (!generatedRow) {
            return row;
          }

          return {
            ...row,
            assumedFinishSystem: generatedRow.assumedFinishSystem,
            materialCostPerSqft: formatCurrencyNumber(
              generatedRow.materialCostPerSqft
            ),
            labourCostPerSqft: formatCurrencyNumber(
              generatedRow.labourCostPerSqft
            ),
            equipmentCostPerSqft: formatCurrencyNumber(
              generatedRow.equipmentCostPerSqft
            ),
            assumptions: generatedRow.assumptions,
            confidence: generatedRow.confidence,
            status: "AI drafted",
          };
        })
      );

      setGenerationStatusMessage(
        `Draft generated at ${new Date().toLocaleTimeString()}`
      );
    } catch (error) {
      console.error(error);
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate flooring draft."
      );
      setGenerationStatusMessage("");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function handleCostChange(
    rowId: number,
    key: keyof Pick<
      FlooringReviewRow,
      "materialCostPerSqft" | "labourCostPerSqft" | "equipmentCostPerSqft"
    >,
    value: string
  ) {
    setReviewRows((previousRows) =>
      previousRows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
        Loading Flooring estimate branch...
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
              meta={`Item â€¢ ${hierarchy.costCode}`}
              badge={buildEstimateBadges({
                totalCost: branchTotal,
                totalQuantity,
                grossFloorArea,
                quantityUnitLabel: "sq.ft",
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
                      Flooring Cost Breakdown Review
                    </h4>
                    <p className="text-sm text-[var(--muted)]">
                      Generate a draft, then edit the rates below if you want to
                      adjust them.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateDraft()}
                      disabled={reviewRows.length === 0 || isGeneratingDraft}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingDraft
                        ? "Generating Draft..."
                        : "Generate Flooring Draft"}
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
                  <table className="min-w-[1180px] divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="w-[28rem] px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Room Type
                        </th>
                        <th className="w-[8rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Area
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Material / sq.ft
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Labour / sq.ft
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Equipment / sq.ft
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Total / sq.ft
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
                      {reviewRows.length > 0 ? (
                        reviewRows.map((row) => (
                          <tr key={`flooring-${row.id}`}>
                            <td className="px-3 py-3 align-top whitespace-normal break-words">
                              <p className="font-medium">{row.roomType}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {row.assumedFinishSystem}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                                {row.assumptions}
                              </p>
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                              {formatArea(parseOptionalNumber(row.area))} sq.ft
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap">
                              <Input
                                value={row.materialCostPerSqft}
                                onChange={(event) =>
                                  handleCostChange(
                                    row.id,
                                    "materialCostPerSqft",
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
                                value={row.labourCostPerSqft}
                                onChange={(event) =>
                                  handleCostChange(
                                    row.id,
                                    "labourCostPerSqft",
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
                                value={row.equipmentCostPerSqft}
                                onChange={(event) =>
                                  handleCostChange(
                                    row.id,
                                    "equipmentCostPerSqft",
                                    event.target.value
                                  )
                                }
                                inputMode="decimal"
                                placeholder="0"
                                className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                              />
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                              INR {formatCurrencyNumber(calculateRatePerSqft(row))}
                            </td>
                            <td className="px-3 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                              INR {formatCurrencyNumber(calculateRowTotal(row))}
                            </td>
                            <td className="px-3 py-3 align-top whitespace-normal break-words">
                              <span className={buildStatusClassName(row.confidence)}>
                                {buildStatusLabel(row)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-3 py-6 text-center text-sm text-[var(--muted)]"
                          >
                            Once the user has area takeoff rows for flooring, this
                            review table will be ready to accept AI-generated pricing.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {reviewRows.length > 0 ? (
                      <tfoot>
                        <tr className="bg-[var(--surface)]">
                          <td className="px-3 py-3 font-semibold" colSpan={6}>
                            Flooring Branch Total
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-semibold text-[var(--foreground)]">
                            INR {formatCurrencyNumber(branchTotal)}
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">Review</td>
                        </tr>
                      </tfoot>
                    ) : null}
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

function calculateRatePerSqft(row: {
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
}) {
  return (
    parseOptionalNumber(row.materialCostPerSqft) +
    parseOptionalNumber(row.labourCostPerSqft) +
    parseOptionalNumber(row.equipmentCostPerSqft)
  );
}

function calculateRowTotal(row: {
  area: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
}) {
  return calculateRatePerSqft(row) * parseOptionalNumber(row.area);
}

function buildStatusLabel(row: {
  confidence: FlooringReviewRow["confidence"];
  status: string;
}) {
  if (row.confidence === "pending") {
    return row.status;
  }

  return `${row.status} â€¢ ${row.confidence} confidence`;
}

function buildStatusClassName(confidence: FlooringReviewRow["confidence"]) {
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

function formatArea(value: number) {
  return Number.isFinite(value)
    ? Number.isInteger(value)
      ? String(value)
      : value.toFixed(2)
    : "0";
}

function formatCurrencyNumber(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

function buildReviewRows(
  sourceRows: JobEstimateAreaTakeoff[],
  savedEstimate?: Awaited<ReturnType<typeof getJobEstimateDetailedItem>> | null,
  existingRows: FlooringReviewRow[] = []
) {
  const savedRowsByKey = new Map(
    (savedEstimate?.rows ?? []).map((row) => [row.rowKey, row] as const)
  );

  return sourceRows.map((row) => {
    const rowKey = `flooring-${row.id}`;
    const savedRow = savedRowsByKey.get(rowKey);
    const existingRow = existingRows.find((candidate) => candidate.id === row.id);

    return {
      id: row.id,
      roomType: row.roomType || savedRow?.rowLabel || "Untitled room",
      area: row.area || formatArea(savedRow?.quantity ?? 0),
      floorFinish: row.floorFinish || "Pending floor finish description",
      assumedFinishSystem:
        savedRow?.assumedSystem ||
        existingRow?.assumedFinishSystem ||
        "Pending AI",
      materialCostPerSqft:
        savedRow != null
          ? formatCurrencyNumber(savedRow.materialCostPerUnit)
          : (existingRow?.materialCostPerSqft ?? ""),
      labourCostPerSqft:
        savedRow != null
          ? formatCurrencyNumber(savedRow.labourCostPerUnit)
          : (existingRow?.labourCostPerSqft ?? ""),
      equipmentCostPerSqft:
        savedRow != null
          ? formatCurrencyNumber(savedRow.equipmentCostPerUnit)
          : (existingRow?.equipmentCostPerSqft ?? ""),
      assumptions:
        savedRow?.assumptions ||
        existingRow?.assumptions ||
        "Awaiting AI draft",
      confidence:
        savedRow?.confidence === "low" ||
        savedRow?.confidence === "medium" ||
        savedRow?.confidence === "high"
          ? savedRow.confidence
          : (existingRow?.confidence ?? "pending"),
      status: savedRow?.status || existingRow?.status || "Awaiting draft",
    };
  });
}

function createSignature(rows: FlooringReviewRow[]) {
  return JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      roomType: row.roomType,
      area: row.area,
      floorFinish: row.floorFinish,
      assumedFinishSystem: row.assumedFinishSystem,
      materialCostPerSqft: row.materialCostPerSqft,
      labourCostPerSqft: row.labourCostPerSqft,
      equipmentCostPerSqft: row.equipmentCostPerSqft,
      assumptions: row.assumptions,
      confidence: row.confidence,
      status: row.status,
    }))
  );
}


