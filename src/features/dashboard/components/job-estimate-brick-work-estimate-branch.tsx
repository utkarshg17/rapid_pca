"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { RegisterBulkGenerateDraft } from "@/features/dashboard/components/job-estimate-bulk-draft";
import { buildEstimateBadges } from "@/features/dashboard/components/job-estimate-branch-metrics";
import { parseDraftResponse } from "@/features/dashboard/components/job-estimate-draft-response";
import { JobEstimateRatioInput } from "@/features/dashboard/components/job-estimate-ratio-input";
import { calculateQuantityPerGfa } from "@/features/dashboard/components/job-estimate-quantity-metrics";
import { JobEstimateHierarchyNode } from "@/features/dashboard/components/job-estimate-hierarchy-node";
import { getJobEstimateAreaTakeoffs } from "@/features/dashboard/services/get-job-estimate-area-takeoffs";
import { getBrickWorkCostCodeHierarchy } from "@/features/dashboard/services/get-brick-work-cost-code-hierarchy";
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

type BrickWorkReviewRow = {
  item: "Exterior Brickwork" | "Interior Brickwork";
  quantity: string;
  finishDescription: string;
  assumedSystem: string;
  materialCostPerCum: string;
  labourCostPerCum: string;
  equipmentCostPerCum: string;
  assumptions: string;
  confidence: "low" | "medium" | "high" | "pending";
  status: string;
};

type JobEstimateBrickWorkEstimateBranchProps = {
  estimate: JobEstimate;
  itemOnly?: boolean;
  grossFloorArea: number;
  defaultItemOpen?: boolean;
  onTotalChange?: (total: number) => void;
  savedById: string | null;
  savedByName: string;
  registerBulkGenerate?: RegisterBulkGenerateDraft;
};

const defaultHierarchy: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Masonry",
  subSubCategory: "Brickwork",
  item: "Brick Work",
  costCode: "C1018",
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

function createDefaultReviewRows(): BrickWorkReviewRow[] {
  return [
    {
      item: "Exterior Brickwork",
      quantity: "",
      finishDescription: "",
      assumedSystem: "Pending AI",
      materialCostPerCum: "",
      labourCostPerCum: "",
      equipmentCostPerCum: "",
      assumptions: "Awaiting AI draft",
      confidence: "pending",
      status: "Awaiting draft",
    },
    {
      item: "Interior Brickwork",
      quantity: "",
      finishDescription: "",
      assumedSystem: "Pending AI",
      materialCostPerCum: "",
      labourCostPerCum: "",
      equipmentCostPerCum: "",
      assumptions: "Awaiting AI draft",
      confidence: "pending",
      status: "Awaiting draft",
    },
  ];
}

export function JobEstimateBrickWorkEstimateBranch({
  estimate,
  itemOnly = false,
  grossFloorArea,
  defaultItemOpen = true,
  onTotalChange,
  savedById,
  savedByName,
  registerBulkGenerate,
}: JobEstimateBrickWorkEstimateBranchProps) {
  const [areaTakeoffs, setAreaTakeoffs] = useState<JobEstimateAreaTakeoff[]>([]);
  const [finishes, setFinishes] = useState<JobEstimateFinish[]>([]);
  const [projectDetails, setProjectDetails] =
    useState<JobEstimateProjectDetails>(emptyProjectDetails);
  const [hierarchy, setHierarchy] = useState<CostCodeHierarchyNode>(defaultHierarchy);
  const [reviewRows, setReviewRows] =
    useState<BrickWorkReviewRow[]>(createDefaultReviewRows());
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
          getBrickWorkCostCodeHierarchy(),
          getJobEstimateDetailedItem(estimate.id, "C1018"),
        ]);

        if (!isMounted) {
          return;
        }

        setAreaTakeoffs(loadedAreaTakeoffs);
        setFinishes(loadedFinishes);
        setProjectDetails(loadedProjectDetails);
        setHierarchy(loadedHierarchy);
        const initialReviewRows = buildReviewRows(savedEstimate, loadedFinishes);
        setReviewRows(initialReviewRows);
        setPersistedSignature(createSignature(initialReviewRows));
      } catch (error) {
        console.error("Failed to load brick work estimate branch:", error);

        if (isMounted) {
          setAreaTakeoffs([]);
          setFinishes([]);
          setProjectDetails(emptyProjectDetails);
          setHierarchy(defaultHierarchy);
          const initialReviewRows = createDefaultReviewRows();
          setReviewRows(initialReviewRows);
          setPersistedSignature(createSignature(initialReviewRows));
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

  const finishDescriptions = useMemo(
    () => ({
      exteriorBrickwork: finishes
        .filter(
          (row) =>
            row.finishType.trim().toLowerCase() === "exterior brickwork" &&
            row.description.trim()
        )
        .map((row) => row.description.trim())
        .join("\n\n"),
      interiorBrickwork: finishes
        .filter(
          (row) =>
            row.finishType.trim().toLowerCase() === "interior brickwork" &&
            row.description.trim()
        )
        .map((row) => row.description.trim())
        .join("\n\n"),
    }),
    [finishes]
  );

  useEffect(() => {
    setReviewRows((previousRows) =>
      previousRows.map((row) => ({
        ...row,
        finishDescription:
          row.item === "Exterior Brickwork"
            ? finishDescriptions.exteriorBrickwork
            : finishDescriptions.interiorBrickwork,
      }))
    );
  }, [finishDescriptions]);

  const branchTotal = useMemo(
    () => reviewRows.reduce((total, row) => total + calculateRowTotal(row), 0),
    [reviewRows]
  );
  const totalQuantity = useMemo(
    () => reviewRows.reduce((total, row) => total + parseOptionalNumber(row.quantity), 0),
    [reviewRows]
  );
  const currentSignature = useMemo(() => createSignature(reviewRows), [reviewRows]);
  const hasUnsavedChanges = currentSignature !== persistedSignature;

  const handleBulkGenerateDraft = useEffectEvent(async () => {
    await handleGenerateDraft();
  });

  useEffect(() => {
    onTotalChange?.(branchTotal);
  }, [branchTotal, onTotalChange]);

  useEffect(() => {
    if (!registerBulkGenerate) {
      return;
    }

    registerBulkGenerate(() => handleBulkGenerateDraft());

    return () => {
      registerBulkGenerate(null);
    };
  }, [registerBulkGenerate]);

  async function handleSaveChanges() {
    setIsSaving(true);
    setSaveErrorMessage("");
    setSaveStatusMessage("Saving changes...");

    try {
      await saveJobEstimateDetailedItem({
        jobEstimateId: estimate.id,
        costCode: "C1018",
        itemName: "Brick Work",
        unit: "cu.m",
        gfaSnapshot: grossFloorArea,
        saveStatus: "reviewed",
        sourceType: "ai_edited",
        savedById,
        savedByName,
        rows: reviewRows.map((row, index) => ({
          rowKey:
            row.item === "Exterior Brickwork"
              ? "brickwork-exterior"
              : "brickwork-interior",
          rowLabel: row.item,
          quantity: parseOptionalNumber(row.quantity),
          quantityPerGfa: calculateQuantityPerGfa(parseOptionalNumber(row.quantity), grossFloorArea),
          unit: "cu.m",
          materialCostPerUnit: parseOptionalNumber(row.materialCostPerCum),
          labourCostPerUnit: parseOptionalNumber(row.labourCostPerCum),
          equipmentCostPerUnit: parseOptionalNumber(row.equipmentCostPerCum),
          totalCostPerUnit: calculateRatePerCum(row),
          rowTotal: calculateRowTotal(row),
          assumedSystem: row.assumedSystem,
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
    if (sourceRows.length === 0) {
      return;
    }

    setIsGeneratingDraft(true);
    setGenerationError("");
    setGenerationStatusMessage("Generating brick work draft...");

    try {
      const response = await fetch("/api/job-estimates/brick-work-draft", {
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
          finishDescriptions,
          allFinishes: finishes.map((row) => ({
            finishType: row.finishType,
            description: row.description,
          })),
        }),
      });

      const payload = await parseDraftResponse<
        {
          rows?: Array<{
            item?: "Exterior Brickwork" | "Interior Brickwork";
            quantityCum?: number;
            assumedSystem?: string;
            materialCostPerCum?: number;
            labourCostPerCum?: number;
            equipmentCostPerCum?: number;
            assumptions?: string;
            confidence?: "low" | "medium" | "high";
          }>;
          error?: string;
        }
      >(response, "Failed to generate brick work draft.");

      const draftRows = payload?.rows ?? [];

      setReviewRows((previousRows) =>
        previousRows.map((row) => {
          const matchingDraft = draftRows.find((draft) => draft.item === row.item);

          if (!matchingDraft) {
            return row;
          }

          return {
            ...row,
            quantity: formatQuantityValue(matchingDraft.quantityCum ?? 0),
            assumedSystem: matchingDraft.assumedSystem?.trim() || "Pending AI",
            materialCostPerCum: formatCurrencyNumber(
              matchingDraft.materialCostPerCum ?? 0
            ),
            labourCostPerCum: formatCurrencyNumber(
              matchingDraft.labourCostPerCum ?? 0
            ),
            equipmentCostPerCum: formatCurrencyNumber(
              matchingDraft.equipmentCostPerCum ?? 0
            ),
            assumptions: matchingDraft.assumptions?.trim() || "Awaiting AI draft",
            confidence: matchingDraft.confidence ?? "pending",
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
        error instanceof Error ? error.message : "Failed to generate brick work draft."
      );
      setGenerationStatusMessage("");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function handleRowChange(
    item: BrickWorkReviewRow["item"],
    key: keyof Pick<
      BrickWorkReviewRow,
      "quantity" | "materialCostPerCum" | "labourCostPerCum" | "equipmentCostPerCum"
    >,
    value: string
  ) {
    setReviewRows((previousRows) =>
      previousRows.map((row) => (row.item === item ? { ...row, [key]: value } : row))
    );
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
        Loading Brick Work estimate branch...
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
                quantityUnitLabel: "cu.m",
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
                      Brick Work Cost Breakdown Review
                    </h4>
                    <p className="text-sm text-[var(--muted)]">
                      Generate a draft based on project details, area takeoffs, and
                      the interior and exterior brickwork descriptions.
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
                        : "Generate Brick Work Draft"}
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
                  <table className="min-w-[1120px] divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="w-[28rem] px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Item
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Quantity/GFA
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Quantity (cu.m)
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Material / cu.m
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Labour / cu.m
                        </th>
                        <th className="w-[10rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Equipment / cu.m
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Total / cu.m
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
                      {reviewRows.map((row) => (
                        <tr key={row.item}>
                          <td className="px-3 py-3 align-top whitespace-normal break-words">
                            <p className="font-medium">{row.item}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {row.assumedSystem}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                              {row.finishDescription.trim()
                                ? `Finish description: ${row.finishDescription}`
                                : "No finish description entered. AI will assume a standard brickwork system based on project location."}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                              {row.assumptions}
                            </p>
                          </td>
                          <td className="px-3 py-3 align-top whitespace-nowrap">
                            <JobEstimateRatioInput
                              quantityValue={row.quantity}
                              grossFloorArea={grossFloorArea}
                              onQuantityChange={(value) =>
                                handleRowChange(row.item, "quantity", value)
                              }
                              className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3 align-top whitespace-nowrap">
                            <Input
                              value={row.quantity}
                              onChange={(event) =>
                                handleRowChange(
                                  row.item,
                                  "quantity",
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
                              value={row.materialCostPerCum}
                              onChange={(event) =>
                                handleRowChange(
                                  row.item,
                                  "materialCostPerCum",
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
                              value={row.labourCostPerCum}
                              onChange={(event) =>
                                handleRowChange(
                                  row.item,
                                  "labourCostPerCum",
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
                              value={row.equipmentCostPerCum}
                              onChange={(event) =>
                                handleRowChange(
                                  row.item,
                                  "equipmentCostPerCum",
                                  event.target.value
                                )
                              }
                              inputMode="decimal"
                              placeholder="0"
                              className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                            />
                          </td>
                          <td className="px-3 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                            INR {formatCurrencyNumber(calculateRatePerCum(row))}
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
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--surface)]">
                        <td className="px-3 py-3 font-semibold" colSpan={7}>
                          Brick Work Branch Total
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

function calculateRatePerCum(row: {
  materialCostPerCum: string;
  labourCostPerCum: string;
  equipmentCostPerCum: string;
}) {
  return (
    parseOptionalNumber(row.materialCostPerCum) +
    parseOptionalNumber(row.labourCostPerCum) +
    parseOptionalNumber(row.equipmentCostPerCum)
  );
}

function calculateRowTotal(row: {
  quantity: string;
  materialCostPerCum: string;
  labourCostPerCum: string;
  equipmentCostPerCum: string;
}) {
  return calculateRatePerCum(row) * parseOptionalNumber(row.quantity);
}

function buildStatusLabel(row: {
  confidence: BrickWorkReviewRow["confidence"];
  status: string;
}) {
  if (row.confidence === "pending") {
    return row.status;
  }

  return `${row.status} • ${row.confidence} confidence`;
}

function buildStatusClassName(confidence: BrickWorkReviewRow["confidence"]) {
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

function buildReviewRows(
  savedEstimate: Awaited<ReturnType<typeof getJobEstimateDetailedItem>>,
  finishes: JobEstimateFinish[]
): BrickWorkReviewRow[] {
  const finishDescriptions = {
    exteriorBrickwork: finishDescriptionFromRows(finishes, "exterior brickwork"),
    interiorBrickwork: finishDescriptionFromRows(finishes, "interior brickwork"),
  };

  const rowsByKey = new Map(
    (savedEstimate?.rows ?? []).map((row) => [row.rowKey, row] as const)
  );

  return createDefaultReviewRows().map((row) => {
    const rowKey =
      row.item === "Exterior Brickwork"
        ? "brickwork-exterior"
        : "brickwork-interior";
    const savedRow = rowsByKey.get(rowKey);
    const finishDescription =
      row.item === "Exterior Brickwork"
        ? finishDescriptions.exteriorBrickwork
        : finishDescriptions.interiorBrickwork;

    if (!savedRow) {
      return {
        ...row,
        finishDescription,
      };
    }

    return {
      item:
        savedRow.rowLabel === "Interior Brickwork"
          ? "Interior Brickwork"
          : "Exterior Brickwork",
      quantity: formatQuantityValue(savedRow.quantity),
      finishDescription,
      assumedSystem: savedRow.assumedSystem || "Pending AI",
      materialCostPerCum: formatCurrencyNumber(savedRow.materialCostPerUnit),
      labourCostPerCum: formatCurrencyNumber(savedRow.labourCostPerUnit),
      equipmentCostPerCum: formatCurrencyNumber(savedRow.equipmentCostPerUnit),
      assumptions: savedRow.assumptions || "Awaiting AI draft",
      confidence:
        savedRow.confidence === "low" ||
        savedRow.confidence === "medium" ||
        savedRow.confidence === "high"
          ? savedRow.confidence
          : "pending",
      status: savedRow.status || "Awaiting draft",
    };
  });
}

function finishDescriptionFromRows(
  finishes: JobEstimateFinish[],
  finishType: string
) {
  return finishes
    .filter(
      (row) =>
        row.finishType.trim().toLowerCase() === finishType && row.description.trim()
    )
    .map((row) => row.description.trim())
    .join("\n\n");
}

function createSignature(rows: BrickWorkReviewRow[]) {
  return JSON.stringify(
    rows.map((row) => ({
      item: row.item,
      quantity: row.quantity,
      assumedSystem: row.assumedSystem,
      materialCostPerCum: row.materialCostPerCum,
      labourCostPerCum: row.labourCostPerCum,
      equipmentCostPerCum: row.equipmentCostPerCum,
      assumptions: row.assumptions,
      confidence: row.confidence,
      status: row.status,
    }))
  );
}









