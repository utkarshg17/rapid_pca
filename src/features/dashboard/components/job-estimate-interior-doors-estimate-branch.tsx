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
import { getJobEstimateDetailedItem } from "@/features/dashboard/services/get-job-estimate-detailed-item";
import { getInteriorDoorsCostCodeHierarchy } from "@/features/dashboard/services/get-interior-doors-cost-code-hierarchy";
import { getJobEstimateOpenings } from "@/features/dashboard/services/get-job-estimate-openings";
import { getJobEstimateFinishes } from "@/features/dashboard/services/get-job-estimate-finishes";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import { saveJobEstimateDetailedItem } from "@/features/dashboard/services/save-job-estimate-detailed-item";
import type {
  CostCodeHierarchyNode,
  JobEstimate,
  JobEstimateAreaTakeoff,
  JobEstimateFinish,
  JobEstimateOpening,
  JobEstimateProjectDetails,
} from "@/features/dashboard/types/job-estimate";

type InteriorDoorReviewRow = {
  id: number;
  openingName: string;
  areaSqft: string;
  description: string;
  assumedDoorSystem: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
  assumptions: string;
  confidence: "low" | "medium" | "high" | "pending";
  status: string;
};

type JobEstimateInteriorDoorsEstimateBranchProps = {
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
  subCategory: "Openings",
  subSubCategory: "Doors",
  item: "Interior Doors",
  costCode: "C1021",
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

export function JobEstimateInteriorDoorsEstimateBranch({
  estimate,
  itemOnly = false,
  grossFloorArea,
  defaultItemOpen = true,
  onTotalChange,
  savedById,
  savedByName,
  registerBulkGenerate,
}: JobEstimateInteriorDoorsEstimateBranchProps) {
  const [areaTakeoffs, setAreaTakeoffs] = useState<JobEstimateAreaTakeoff[]>([]);
  const [openings, setOpenings] = useState<JobEstimateOpening[]>([]);
  const [finishes, setFinishes] = useState<JobEstimateFinish[]>([]);
  const [projectDetails, setProjectDetails] =
    useState<JobEstimateProjectDetails>(emptyProjectDetails);
  const [hierarchy, setHierarchy] = useState<CostCodeHierarchyNode>(defaultHierarchy);
  const [reviewRows, setReviewRows] = useState<InteriorDoorReviewRow[]>([]);
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
          loadedOpenings,
          loadedFinishes,
          loadedHierarchy,
          loadedProjectDetails,
          savedEstimate,
        ] = await Promise.all([
          getJobEstimateAreaTakeoffs(estimate.id),
          getJobEstimateOpenings(estimate.id),
          getJobEstimateFinishes(estimate.id),
          getInteriorDoorsCostCodeHierarchy(),
          getJobEstimateProjectDetails(estimate),
          getJobEstimateDetailedItem(estimate.id, "C1021"),
        ]);

        if (!isMounted) {
          return;
        }

        setAreaTakeoffs(loadedAreaTakeoffs);
        setOpenings(loadedOpenings);
        setFinishes(loadedFinishes);
        setHierarchy(loadedHierarchy);
        setProjectDetails(loadedProjectDetails);
        const initialReviewRows = buildReviewRows(loadedOpenings, savedEstimate);
        setReviewRows(initialReviewRows);
        setPersistedSignature(createSignature(initialReviewRows));
      } catch (error) {
        console.error("Failed to load interior doors estimate branch:", error);

        if (isMounted) {
          setAreaTakeoffs([]);
          setOpenings([]);
          setFinishes([]);
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
      openings.filter(
        (row) =>
          row.openingType === "Door" &&
          (row.openingName.trim() ||
            row.height.trim() ||
            row.width.trim() ||
            row.quantity.trim() ||
            row.description.trim())
      ),
    [openings]
  );

  useEffect(() => {
    setReviewRows((previousRows) => buildReviewRows(sourceRows, undefined, previousRows));
  }, [sourceRows]);

  const branchTotal = useMemo(
    () => reviewRows.reduce((sum, row) => sum + calculateRowTotal(row), 0),
    [reviewRows]
  );
  const totalQuantity = useMemo(
    () => reviewRows.reduce((sum, row) => sum + parseOptionalNumber(row.areaSqft), 0),
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
        costCode: "C1021",
        itemName: "Interior Doors",
        unit: "sq.ft",
        gfaSnapshot: grossFloorArea,
        saveStatus: "reviewed",
        sourceType: "ai_edited",
        savedById,
        savedByName,
        rows: reviewRows.map((row, index) => ({
          rowKey: `interior-doors-${row.id}`,
          rowLabel: row.openingName,
          quantity: parseOptionalNumber(row.areaSqft),
          quantityPerGfa: calculateQuantityPerGfa(parseOptionalNumber(row.areaSqft), grossFloorArea),
          unit: "sq.ft",
          materialCostPerUnit: parseOptionalNumber(row.materialCostPerSqft),
          labourCostPerUnit: parseOptionalNumber(row.labourCostPerSqft),
          equipmentCostPerUnit: parseOptionalNumber(row.equipmentCostPerSqft),
          totalCostPerUnit: calculateRatePerSqft(row),
          rowTotal: calculateRowTotal(row),
          assumedSystem: row.assumedDoorSystem,
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
    setGenerationStatusMessage("Generating interior doors draft...");

    try {
      const response = await fetch("/api/job-estimates/interior-doors-draft", {
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
          areaTakeoffs: areaTakeoffs
            .filter((row) => row.roomType.trim() || row.area.trim() || row.floorFinish.trim())
            .map((row) => ({
              roomType: row.roomType,
              areaSqft: parseOptionalNumber(row.area),
              floorFinish: row.floorFinish,
            })),
          finishes: finishes.map((row) => ({
            finishType: row.finishType,
            description: row.description,
          })),
          openings: sourceRows.map((row) => ({
            sourceRowId: row.id,
            openingName: row.openingName,
            heightMm: parseOptionalNumber(row.height),
            widthMm: parseOptionalNumber(row.width),
            quantity: parseOptionalNumber(row.quantity),
            totalAreaSqft: calculateOpeningAreaSqft(row),
            description: row.description,
          })),
        }),
      });

      const payload = await parseDraftResponse<
        {
          rows?: Array<{
            sourceRowId: number;
            assumedDoorSystem: string;
            materialCostPerSqft: number;
            labourCostPerSqft: number;
            equipmentCostPerSqft: number;
            assumptions: string;
            confidence: "low" | "medium" | "high";
          }>;
          error?: string;
        }
      >(response, "Failed to generate interior doors draft.");

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
            assumedDoorSystem: generatedRow.assumedDoorSystem,
            materialCostPerSqft: formatCurrencyNumber(generatedRow.materialCostPerSqft),
            labourCostPerSqft: formatCurrencyNumber(generatedRow.labourCostPerSqft),
            equipmentCostPerSqft: formatCurrencyNumber(generatedRow.equipmentCostPerSqft),
            assumptions: generatedRow.assumptions,
            confidence: generatedRow.confidence,
            status: "AI drafted",
          };
        })
      );

      setGenerationStatusMessage(`Draft generated at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error(error);
      setGenerationError(
        error instanceof Error
          ? error.message
          : "Failed to generate interior doors draft."
      );
      setGenerationStatusMessage("");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function handleCostChange(
    rowId: number,
    key: keyof Pick<
      InteriorDoorReviewRow,
      "areaSqft" | "materialCostPerSqft" | "labourCostPerSqft" | "equipmentCostPerSqft"
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
        Loading Interior Doors estimate branch...
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
                    <h4 className="text-lg font-semibold">Interior Doors Cost Breakdown Review</h4>
                    <p className="text-sm text-[var(--muted)]">
                      Generate a draft using project details, area takeoffs, finishes,
                      and the saved door openings. Quantity comes directly from the opening area.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateDraft()}
                      disabled={reviewRows.length === 0 || isGeneratingDraft}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingDraft ? "Generating Draft..." : "Generate Interior Doors Draft"}
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
                          Item
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Quantity/GFA
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
                          <tr key={`interior-doors-${row.id}`}>
                            <td className="px-3 py-3 whitespace-normal break-words">
                              <p className="font-medium">{row.openingName}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">{row.assumedDoorSystem}</p>
                              <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                                {row.description}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                                {row.assumptions}
                              </p>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <JobEstimateRatioInput
                                quantityValue={row.areaSqft}
                                grossFloorArea={grossFloorArea}
                                onQuantityChange={(value) =>
                                  handleCostChange(row.id, "areaSqft", value)
                                }
                                className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                              />
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                              {formatArea(parseOptionalNumber(row.areaSqft))} sq.ft
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Input
                                value={row.materialCostPerSqft}
                                onChange={(event) =>
                                  handleCostChange(row.id, "materialCostPerSqft", event.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0"
                                className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                              />
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Input
                                value={row.labourCostPerSqft}
                                onChange={(event) =>
                                  handleCostChange(row.id, "labourCostPerSqft", event.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0"
                                className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                              />
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <Input
                                value={row.equipmentCostPerSqft}
                                onChange={(event) =>
                                  handleCostChange(row.id, "equipmentCostPerSqft", event.target.value)
                                }
                                inputMode="decimal"
                                placeholder="0"
                                className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                              />
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                              INR {formatCurrencyNumber(calculateRatePerSqft(row))}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                              INR {formatCurrencyNumber(calculateRowTotal(row))}
                            </td>
                            <td className="px-3 py-3 whitespace-normal break-words">
                              <span className={buildStatusClassName(row.confidence)}>
                                {buildStatusLabel(row)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                            Add door rows in the Openings tab to generate the Interior Doors estimate.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {reviewRows.length > 0 ? (
                      <tfoot>
                        <tr className="bg-[var(--surface)]">
                          <td className="px-3 py-3 font-semibold" colSpan={7}>
                            Interior Doors Branch Total
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

function calculateOpeningAreaSqft(row: JobEstimateOpening) {
  const heightMm = parseOptionalNumber(row.height);
  const widthMm = parseOptionalNumber(row.width);
  const quantity = parseOptionalNumber(row.quantity);

  if (heightMm <= 0 || widthMm <= 0 || quantity <= 0) {
    return 0;
  }

  return (heightMm * widthMm * quantity) / 92903.04;
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
  areaSqft: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
}) {
  return calculateRatePerSqft(row) * parseOptionalNumber(row.areaSqft);
}

function buildStatusLabel(row: {
  confidence: InteriorDoorReviewRow["confidence"];
  status: string;
}) {
  if (row.confidence === "pending") {
    return row.status;
  }

  return `${row.status} • ${row.confidence} confidence`;
}

function buildStatusClassName(confidence: InteriorDoorReviewRow["confidence"]) {
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
  openings: JobEstimateOpening[],
  savedEstimate?: Awaited<ReturnType<typeof getJobEstimateDetailedItem>> | null,
  existingRows: InteriorDoorReviewRow[] = []
) {
  const savedRowsByKey = new Map(
    (savedEstimate?.rows ?? []).map((row) => [row.rowKey, row] as const)
  );

  return openings
    .filter(
      (row) =>
        row.openingType === "Door" &&
        (row.openingName.trim() ||
          row.height.trim() ||
          row.width.trim() ||
          row.quantity.trim() ||
          row.description.trim())
    )
    .map((row) => {
      const rowKey = `interior-doors-${row.id}`;
      const savedRow = savedRowsByKey.get(rowKey);
      const existingRow = existingRows.find((candidate) => candidate.id === row.id);
      const areaSqft = calculateOpeningAreaSqft(row);

      return {
        id: row.id,
        openingName: row.openingName || savedRow?.rowLabel || "Untitled door",
        areaSqft: formatArea(savedRow?.quantity ?? areaSqft),
        description: row.description || "No description provided",
        assumedDoorSystem:
          savedRow?.assumedSystem || existingRow?.assumedDoorSystem || "Pending AI",
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
          savedRow?.assumptions || existingRow?.assumptions || "Awaiting AI draft",
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

function createSignature(rows: InteriorDoorReviewRow[]) {
  return JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      openingName: row.openingName,
      areaSqft: row.areaSqft,
      description: row.description,
      assumedDoorSystem: row.assumedDoorSystem,
      materialCostPerSqft: row.materialCostPerSqft,
      labourCostPerSqft: row.labourCostPerSqft,
      equipmentCostPerSqft: row.equipmentCostPerSqft,
      assumptions: row.assumptions,
      confidence: row.confidence,
      status: row.status,
    }))
  );
}







