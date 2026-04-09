"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { RegisterBulkGenerateDraft, RegisterBulkSaveDraft } from "@/features/dashboard/components/job-estimate-bulk-draft";
import { buildEstimateBadges } from "@/features/dashboard/components/job-estimate-branch-metrics";
import { parseDraftResponse } from "@/features/dashboard/components/job-estimate-draft-response";
import { JobEstimateHierarchyNode } from "@/features/dashboard/components/job-estimate-hierarchy-node";
import { calculateQuantityPerGfa } from "@/features/dashboard/components/job-estimate-quantity-metrics";
import { JobEstimateRatioInput } from "@/features/dashboard/components/job-estimate-ratio-input";
import { getJobEstimateAreaTakeoffs } from "@/features/dashboard/services/get-job-estimate-area-takeoffs";
import { getJobEstimateDetailedItem } from "@/features/dashboard/services/get-job-estimate-detailed-item";
import { getJobEstimateFinishes } from "@/features/dashboard/services/get-job-estimate-finishes";
import { getJobEstimateOpenings } from "@/features/dashboard/services/get-job-estimate-openings";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import { getRoofWaterproofingCostCodeHierarchy } from "@/features/dashboard/services/get-roof-waterproofing-cost-code-hierarchy";
import { saveJobEstimateDetailedItem } from "@/features/dashboard/services/save-job-estimate-detailed-item";
import type {
  CostCodeHierarchyNode,
  JobEstimate,
  JobEstimateAreaTakeoff,
  JobEstimateFinish,
  JobEstimateOpening,
  JobEstimateProjectDetails,
} from "@/features/dashboard/types/job-estimate";

type RoofWaterproofingReviewRow = {
  item: string;
  area: string;
  areaSourceLabel: string;
  roofContextDescription: string;
  assumedWaterproofingSystem: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
  assumptions: string;
  confidence: "low" | "medium" | "high" | "pending";
  status: string;
};

type RoofAreaContext = {
  areaSqft: number;
  sourceLabel: string;
  description: string;
  matchedRows: JobEstimateAreaTakeoff[];
};

type JobEstimateRoofWaterproofingEstimateBranchProps = {
  estimate: JobEstimate;
  itemOnly?: boolean;
  grossFloorArea: number;
  defaultItemOpen?: boolean;
  onTotalChange?: (total: number) => void;
  savedById: string | null;
  savedByName: string;
  registerBulkGenerate?: RegisterBulkGenerateDraft;
  registerBulkSave?: RegisterBulkSaveDraft;
};

const defaultHierarchy: CostCodeHierarchyNode = {
  category: "Construction",
  subCategory: "Envelope",
  subSubCategory: "Roofing & Waterproofing",
  item: "Roof Waterproofing",
  costCode: "B3017",
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

const emptyRoofAreaContext: RoofAreaContext = {
  areaSqft: 0,
  sourceLabel: "No roof area found",
  description:
    "No terrace or roof takeoff rows or superstructure footprint are available yet.",
  matchedRows: [],
};

const defaultReviewRow: RoofWaterproofingReviewRow = {
  item: "Roof Waterproofing",
  area: "",
  areaSourceLabel: emptyRoofAreaContext.sourceLabel,
  roofContextDescription: emptyRoofAreaContext.description,
  assumedWaterproofingSystem: "Pending AI",
  materialCostPerSqft: "",
  labourCostPerSqft: "",
  equipmentCostPerSqft: "",
  assumptions: "Awaiting AI draft",
  confidence: "pending",
  status: "Awaiting draft",
};

export function JobEstimateRoofWaterproofingEstimateBranch({
  estimate,
  itemOnly = false,
  grossFloorArea,
  defaultItemOpen = true,
  onTotalChange,
  savedById,
  savedByName,
  registerBulkGenerate,
registerBulkSave,
}: JobEstimateRoofWaterproofingEstimateBranchProps) {
  const [areaTakeoffs, setAreaTakeoffs] = useState<JobEstimateAreaTakeoff[]>([]);
  const [openings, setOpenings] = useState<JobEstimateOpening[]>([]);
  const [finishes, setFinishes] = useState<JobEstimateFinish[]>([]);
  const [projectDetails, setProjectDetails] =
    useState<JobEstimateProjectDetails>(emptyProjectDetails);
  const [hierarchy, setHierarchy] = useState<CostCodeHierarchyNode>(
    defaultHierarchy
  );
  const [reviewRow, setReviewRow] =
    useState<RoofWaterproofingReviewRow>(defaultReviewRow);
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
          loadedProjectDetails,
          loadedHierarchy,
          savedEstimate,
        ] = await Promise.all([
          getJobEstimateAreaTakeoffs(estimate.id),
          getJobEstimateOpenings(estimate.id),
          getJobEstimateFinishes(estimate.id),
          getJobEstimateProjectDetails(estimate),
          getRoofWaterproofingCostCodeHierarchy(),
          getJobEstimateDetailedItem(estimate.id, "B3017"),
        ]);

        if (!isMounted) {
          return;
        }

        const derivedRoofArea = deriveRoofAreaContext(
          loadedAreaTakeoffs,
          loadedProjectDetails
        );

        setAreaTakeoffs(loadedAreaTakeoffs);
        setOpenings(loadedOpenings);
        setFinishes(loadedFinishes);
        setProjectDetails(loadedProjectDetails);
        setHierarchy(loadedHierarchy);

        const initialReviewRow = buildReviewRow(savedEstimate, derivedRoofArea);
        setReviewRow(initialReviewRow);
        setPersistedSignature(createSignature(initialReviewRow));
      } catch (error) {
        console.error("Failed to load roof waterproofing estimate branch:", error);

        if (isMounted) {
          setAreaTakeoffs([]);
          setOpenings([]);
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

    void loadBranch();

    return () => {
      isMounted = false;
    };
  }, [estimate]);

  const roofAreaContext = useMemo(
    () => deriveRoofAreaContext(areaTakeoffs, projectDetails),
    [areaTakeoffs, projectDetails]
  );

  const sourceOpenings = useMemo(
    () =>
      openings.filter(
        (row) =>
          row.openingName.trim() ||
          row.height.trim() ||
          row.width.trim() ||
          row.quantity.trim() ||
          row.description.trim()
      ),
    [openings]
  );

  useEffect(() => {
    setReviewRow((previousRow) => {
      if (parseOptionalNumber(previousRow.area) > 0) {
        return {
          ...previousRow,
          areaSourceLabel: roofAreaContext.sourceLabel,
          roofContextDescription: roofAreaContext.description,
        };
      }

      return {
        ...previousRow,
        area: formatAreaValue(roofAreaContext.areaSqft),
        areaSourceLabel: roofAreaContext.sourceLabel,
        roofContextDescription: roofAreaContext.description,
      };
    });
  }, [roofAreaContext]);

  const branchTotal = useMemo(() => calculateRowTotal(reviewRow), [reviewRow]);
  const totalQuantity = useMemo(
    () => parseOptionalNumber(reviewRow.area),
    [reviewRow.area]
  );
  const currentSignature = useMemo(() => createSignature(reviewRow), [reviewRow]);
  const hasUnsavedChanges = currentSignature !== persistedSignature;

  

  const handleBulkGenerateDraft = useEffectEvent(async () => {
    await handleGenerateDraft();
  });

  const handleBulkSaveChanges = useEffectEvent(async () => {
    await handleSaveChanges();
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

  useEffect(() => {
    if (!registerBulkSave) {
      return;
    }

    if (!hasUnsavedChanges) {
      registerBulkSave(null);
      return;
    }

    registerBulkSave(() => handleBulkSaveChanges());

    return () => {
      registerBulkSave(null);
    };
  }, [registerBulkSave, hasUnsavedChanges]);
  async function handleSaveChanges() {
    setIsSaving(true);
    setSaveErrorMessage("");
    setSaveStatusMessage("Saving changes...");

    try {
      await saveJobEstimateDetailedItem({
        jobEstimateId: estimate.id,
        costCode: "B3017",
        itemName: "Roof Waterproofing",
        unit: "sq.ft",
        gfaSnapshot: grossFloorArea,
        saveStatus: "reviewed",
        sourceType: "ai_edited",
        savedById,
        savedByName,
        rows: [
          {
            rowKey: "b3017-main",
            rowLabel: "Roof Waterproofing",
            quantity: parseOptionalNumber(reviewRow.area),
            quantityPerGfa: calculateQuantityPerGfa(
              parseOptionalNumber(reviewRow.area),
              grossFloorArea
            ),
            unit: "sq.ft",
            materialCostPerUnit: parseOptionalNumber(reviewRow.materialCostPerSqft),
            labourCostPerUnit: parseOptionalNumber(reviewRow.labourCostPerSqft),
            equipmentCostPerUnit: parseOptionalNumber(reviewRow.equipmentCostPerSqft),
            totalCostPerUnit: calculateRatePerSqft(reviewRow),
            rowTotal: calculateRowTotal(reviewRow),
            assumedSystem: reviewRow.assumedWaterproofingSystem,
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
    const effectiveRoofArea =
      parseOptionalNumber(reviewRow.area) > 0
        ? parseOptionalNumber(reviewRow.area)
        : roofAreaContext.areaSqft;

    if (effectiveRoofArea <= 0) {
      setGenerationError(
        "Add a terrace or roof area in Area Takeoffs, fill in the superstructure footprint in Project Details, or enter the roof waterproofing area manually first."
      );
      setGenerationStatusMessage("");
      return;
    }

    setIsGeneratingDraft(true);
    setGenerationError("");
    setGenerationStatusMessage("Generating roof waterproofing draft...");

    try {
      const response = await fetch("/api/job-estimates/roof-waterproofing-draft", {
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
          roofArea: {
            areaSqft: effectiveRoofArea,
            sourceLabel: reviewRow.areaSourceLabel || roofAreaContext.sourceLabel,
            description:
              reviewRow.roofContextDescription || roofAreaContext.description,
            matchedRows: roofAreaContext.matchedRows.map((row) => ({
              roomType: row.roomType,
              areaSqft: parseOptionalNumber(row.area),
              floorFinish: row.floorFinish,
            })),
          },
          areaTakeoffs: areaTakeoffs.map((row) => ({
            roomType: row.roomType,
            areaSqft: parseOptionalNumber(row.area),
            floorFinish: row.floorFinish,
          })),
          openings: sourceOpenings.map((row) => ({
            openingType: row.openingType,
            openingName: row.openingName,
            heightMm: parseOptionalNumber(row.height),
            widthMm: parseOptionalNumber(row.width),
            quantity: parseOptionalNumber(row.quantity),
            description: row.description,
          })),
          allFinishes: finishes.map((row) => ({
            finishType: row.finishType,
            description: row.description,
          })),
        }),
      });

      const payload = await parseDraftResponse<{
        item?: string;
        areaSqft?: number;
        assumedWaterproofingSystem?: string;
        materialCostPerSqft?: number;
        labourCostPerSqft?: number;
        equipmentCostPerSqft?: number;
        assumptions?: string;
        confidence?: "low" | "medium" | "high";
        error?: string;
      }>(response, "Failed to generate roof waterproofing draft.");

      setReviewRow((previousRow) => ({
        ...previousRow,
        item: payload?.item?.trim() || "Roof Waterproofing",
        area: formatAreaValue(payload?.areaSqft ?? effectiveRoofArea),
        areaSourceLabel: reviewRow.areaSourceLabel || roofAreaContext.sourceLabel,
        roofContextDescription:
          reviewRow.roofContextDescription || roofAreaContext.description,
        assumedWaterproofingSystem:
          payload?.assumedWaterproofingSystem?.trim() || "Pending AI",
        materialCostPerSqft: formatCurrencyNumber(
          payload?.materialCostPerSqft ?? 0
        ),
        labourCostPerSqft: formatCurrencyNumber(payload?.labourCostPerSqft ?? 0),
        equipmentCostPerSqft: formatCurrencyNumber(
          payload?.equipmentCostPerSqft ?? 0
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
          : "Failed to generate roof waterproofing draft."
      );
      setGenerationStatusMessage("");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function handleRowChange(
    key: keyof Pick<
      RoofWaterproofingReviewRow,
      | "area"
      | "materialCostPerSqft"
      | "labourCostPerSqft"
      | "equipmentCostPerSqft"
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
        Loading Roof Waterproofing estimate branch...
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
              meta={`Item - ${hierarchy.costCode}`}
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
                      Roof Waterproofing Cost Breakdown Review
                    </h4>
                    <p className="text-sm text-[var(--muted)]">
                      Generate a draft using project details, area takeoffs,
                      openings, finishes, and the roof or terrace area basis.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateDraft()}
                      disabled={
                        parseOptionalNumber(reviewRow.area) <= 0 ||
                        isGeneratingDraft
                      }
                      className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingDraft
                        ? "Generating Draft..."
                        : "Generate Roof Waterproofing Draft"}
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
                  <table className="min-w-[1080px] divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="w-[30rem] px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Item
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
                          Quantity/GFA
                        </th>
                        <th className="w-[9rem] whitespace-nowrap px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
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
                      <tr>
                        <td className="px-3 py-3 align-top whitespace-normal break-words">
                          <p className="font-medium">{reviewRow.item}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {reviewRow.assumedWaterproofingSystem}
                          </p>
                          <p className="mt-2 text-xs text-[var(--muted)]">
                            Area basis: {reviewRow.areaSourceLabel}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                            {reviewRow.roofContextDescription}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                            {reviewRow.assumptions}
                          </p>
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <JobEstimateRatioInput
                            quantityValue={reviewRow.area}
                            grossFloorArea={grossFloorArea}
                            onQuantityChange={(value) =>
                              handleRowChange("area", value)
                            }
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.area}
                            onChange={(event) =>
                              handleRowChange("area", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.materialCostPerSqft}
                            onChange={(event) =>
                              handleRowChange(
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
                            value={reviewRow.labourCostPerSqft}
                            onChange={(event) =>
                              handleRowChange("labourCostPerSqft", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 align-top whitespace-nowrap">
                          <Input
                            value={reviewRow.equipmentCostPerSqft}
                            onChange={(event) =>
                              handleRowChange(
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
                          INR {formatCurrencyNumber(calculateRatePerSqft(reviewRow))}
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
                        <td className="px-3 py-3 font-semibold" colSpan={7}>
                          Roof Waterproofing Branch Total
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
function deriveRoofAreaContext(
  areaTakeoffs: JobEstimateAreaTakeoff[],
  projectDetails: JobEstimateProjectDetails
): RoofAreaContext {
  const matchedRows = areaTakeoffs.filter((row) => {
    const areaSqft = parseOptionalNumber(row.area);

    if (areaSqft <= 0) {
      return false;
    }

    const searchableText = `${row.roomType} ${row.floorFinish}`.toLowerCase();
    return searchableText.includes("roof") || searchableText.includes("terrace");
  });

  if (matchedRows.length > 0) {
    const areaSqft = matchedRows.reduce(
      (runningTotal, row) => runningTotal + parseOptionalNumber(row.area),
      0
    );
    const description = matchedRows
      .map((row) => {
        const parts = [
          row.roomType.trim() || "Roof/Terrace",
          `${formatAreaValue(parseOptionalNumber(row.area))} sq.ft`,
        ];

        if (row.floorFinish.trim()) {
          parts.push(`Finish: ${row.floorFinish.trim()}`);
        }

        return parts.join(" - ");
      })
      .join("\n");

    return {
      areaSqft,
      sourceLabel: `From area takeoffs (${matchedRows.length} ${
        matchedRows.length === 1 ? "row" : "rows"
      })`,
      description,
      matchedRows,
    };
  }

  const fallbackArea = parseOptionalNumber(projectDetails.superstructureFootprint);

  if (fallbackArea > 0) {
    return {
      areaSqft: fallbackArea,
      sourceLabel: "Fallback to superstructure footprint",
      description: `No terrace or roof area takeoff rows were found, so the superstructure footprint of ${formatAreaValue(
        fallbackArea
      )} sq.ft is being used as the roof waterproofing area.`,
      matchedRows: [],
    };
  }

  return emptyRoofAreaContext;
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAreaValue(value: number) {
  return Number.isFinite(value)
    ? Number.isInteger(value)
      ? String(value)
      : value.toFixed(2)
    : "0";
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
  confidence: RoofWaterproofingReviewRow["confidence"];
  status: string;
}) {
  if (row.confidence === "pending") {
    return row.status;
  }

  return `${row.status} - ${row.confidence} confidence`;
}

function buildStatusClassName(
  confidence: RoofWaterproofingReviewRow["confidence"]
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
  savedEstimate: Awaited<ReturnType<typeof getJobEstimateDetailedItem>>,
  roofAreaContext: RoofAreaContext
): RoofWaterproofingReviewRow {
  const savedRow = savedEstimate?.rows[0];

  if (!savedRow) {
    return {
      ...defaultReviewRow,
      area: formatAreaValue(roofAreaContext.areaSqft),
      areaSourceLabel: roofAreaContext.sourceLabel,
      roofContextDescription: roofAreaContext.description,
    };
  }

  return {
    item: savedEstimate?.item.itemName ?? "Roof Waterproofing",
    area: formatAreaValue(savedRow.quantity),
    areaSourceLabel: roofAreaContext.sourceLabel,
    roofContextDescription: roofAreaContext.description,
    assumedWaterproofingSystem: savedRow.assumedSystem || "Pending AI",
    materialCostPerSqft: formatCurrencyNumber(savedRow.materialCostPerUnit),
    labourCostPerSqft: formatCurrencyNumber(savedRow.labourCostPerUnit),
    equipmentCostPerSqft: formatCurrencyNumber(savedRow.equipmentCostPerUnit),
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

function createSignature(row: RoofWaterproofingReviewRow) {
  return JSON.stringify({
    item: row.item,
    area: row.area,
    assumedWaterproofingSystem: row.assumedWaterproofingSystem,
    materialCostPerSqft: row.materialCostPerSqft,
    labourCostPerSqft: row.labourCostPerSqft,
    equipmentCostPerSqft: row.equipmentCostPerSqft,
    assumptions: row.assumptions,
    confidence: row.confidence,
    status: row.status,
  });
}


