
"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { RegisterBulkGenerateDraft, RegisterBulkSaveDraft } from "@/features/dashboard/components/job-estimate-bulk-draft";
import { buildEstimateBadges } from "@/features/dashboard/components/job-estimate-branch-metrics";
import { parseDraftResponse } from "@/features/dashboard/components/job-estimate-draft-response";
import { JobEstimateHierarchyNode } from "@/features/dashboard/components/job-estimate-hierarchy-node";
import { calculateQuantityPerGfa } from "@/features/dashboard/components/job-estimate-quantity-metrics";
import { JobEstimateRatioInput } from "@/features/dashboard/components/job-estimate-ratio-input";
import { getElectricalFixturesCostCodeHierarchy } from "@/features/dashboard/services/get-electrical-fixtures-cost-code-hierarchy";
import { getFireProtectionDistributionAndStorageCostCodeHierarchy } from "@/features/dashboard/services/get-fire-protection-distribution-and-storage-cost-code-hierarchy";
import { getJobEstimateAreaTakeoffs } from "@/features/dashboard/services/get-job-estimate-area-takeoffs";
import { getJobEstimateDetailedItem } from "@/features/dashboard/services/get-job-estimate-detailed-item";
import { getJobEstimateFinishes } from "@/features/dashboard/services/get-job-estimate-finishes";
import { getJobEstimateOpenings } from "@/features/dashboard/services/get-job-estimate-openings";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import { getPlumbingFixturesCostCodeHierarchy } from "@/features/dashboard/services/get-plumbing-fixtures-cost-code-hierarchy";
import { saveJobEstimateDetailedItem } from "@/features/dashboard/services/save-job-estimate-detailed-item";
import type {
  CostCodeHierarchyNode,
  JobEstimate,
  JobEstimateAreaTakeoff,
  JobEstimateFinish,
  JobEstimateOpening,
  JobEstimateProjectDetails,
} from "@/features/dashboard/types/job-estimate";

type GfaFixtureReviewRow = {
  item: string;
  quantity: string;
  unit: "sq.ft";
  assumedSystem: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
  assumptions: string;
  confidence: "low" | "medium" | "high" | "pending";
  status: string;
};

type JobEstimateGfaFixtureEstimateBranchProps = {
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

type GfaFixtureBranchConfig = {
  itemName: string;
  costCode: string;
  rowKey: string;
  endpoint: string;
  defaultHierarchy: CostCodeHierarchyNode;
  loadHierarchy: () => Promise<CostCodeHierarchyNode>;
  loadingLabel: string;
  reviewTitle: string;
  reviewDescription: string;
  generateButtonLabel: string;
  generatingMessage: string;
  generateErrorMessage: string;
  saveErrorMessage: string;
};

const electricalFixturesConfig: GfaFixtureBranchConfig = {
  itemName: "Electrical Fixtures",
  costCode: "D5046",
  rowKey: "d5046-main",
  endpoint: "/api/job-estimates/electrical-fixtures-draft",
  defaultHierarchy: {
    category: "Construction",
    subCategory: "MEP",
    subSubCategory: "Electrical",
    item: "Electrical Fixtures",
    costCode: "D5046",
  },
  loadHierarchy: getElectricalFixturesCostCodeHierarchy,
  loadingLabel: "Loading Electrical Fixtures estimate branch...",
  reviewTitle: "Electrical Fixtures Cost Breakdown Review",
  reviewDescription:
    "Generate a draft using project details, area takeoffs, finishes, and openings. Quantity is the GFA, and this scope covers fans, AC allowance, switches, plug-points, lights, and related fixtures, not the conduit network.",
  generateButtonLabel: "Generate Electrical Fixtures Draft",
  generatingMessage: "Generating electrical fixtures draft...",
  generateErrorMessage: "Failed to generate electrical fixtures draft.",
  saveErrorMessage: "Failed to save electrical fixtures estimate changes.",
};

const plumbingFixturesConfig: GfaFixtureBranchConfig = {
  itemName: "Plumbing Fixtures",
  costCode: "D2019",
  rowKey: "d2019-main",
  endpoint: "/api/job-estimates/plumbing-fixtures-draft",
  defaultHierarchy: {
    category: "Construction",
    subCategory: "MEP",
    subSubCategory: "Plumbing",
    item: "Plumbing Fixtures",
    costCode: "D2019",
  },
  loadHierarchy: getPlumbingFixturesCostCodeHierarchy,
  loadingLabel: "Loading Plumbing Fixtures estimate branch...",
  reviewTitle: "Plumbing Fixtures Cost Breakdown Review",
  reviewDescription:
    "Generate a draft using project details, area takeoffs, finishes, and openings. Quantity is the GFA, and this scope covers taps, WCs, sinks, basins, and sanitary fixtures, not the plumbing pipe network.",
  generateButtonLabel: "Generate Plumbing Fixtures Draft",
  generatingMessage: "Generating plumbing fixtures draft...",
  generateErrorMessage: "Failed to generate plumbing fixtures draft.",
  saveErrorMessage: "Failed to save plumbing fixtures estimate changes.",
};

const fireProtectionDistributionAndStorageConfig: GfaFixtureBranchConfig = {
  itemName: "Fire Protection Distribution and Storage",
  costCode: "G3014",
  rowKey: "g3014-main",
  endpoint: "/api/job-estimates/fire-protection-distribution-and-storage-draft",
  defaultHierarchy: {
    category: "Construction",
    subCategory: "MEP",
    subSubCategory: "Fire Protection",
    item: "Fire Protection Distribution and Storage",
    costCode: "G3014",
  },
  loadHierarchy: getFireProtectionDistributionAndStorageCostCodeHierarchy,
  loadingLabel: "Loading Fire Protection Distribution and Storage estimate branch...",
  reviewTitle: "Fire Protection Distribution and Storage Cost Breakdown Review",
  reviewDescription:
    "Generate a draft using project details, area takeoffs, finishes, and openings. Quantity is the GFA, and this scope covers internal fire protection distribution pipes, sprinklers, and related building fire-fighting equipment, not external site fire infrastructure.",
  generateButtonLabel: "Generate Fire Protection Distribution Draft",
  generatingMessage: "Generating fire protection distribution and storage draft...",
  generateErrorMessage: "Failed to generate fire protection distribution and storage draft.",
  saveErrorMessage:
    "Failed to save fire protection distribution and storage estimate changes.",
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

export function JobEstimateElectricalFixturesEstimateBranch(
  props: JobEstimateGfaFixtureEstimateBranchProps
) {
  return <JobEstimateGfaFixtureEstimateBranch {...props} config={electricalFixturesConfig} />;
}

export function JobEstimatePlumbingFixturesEstimateBranch(
  props: JobEstimateGfaFixtureEstimateBranchProps
) {
  return <JobEstimateGfaFixtureEstimateBranch {...props} config={plumbingFixturesConfig} />;
}

export function JobEstimateFireProtectionDistributionAndStorageEstimateBranch(
  props: JobEstimateGfaFixtureEstimateBranchProps
) {
  return (
    <JobEstimateGfaFixtureEstimateBranch
      {...props}
      config={fireProtectionDistributionAndStorageConfig}
    />
  );
}

function JobEstimateGfaFixtureEstimateBranch({
  estimate,
  itemOnly = false,
  grossFloorArea,
  defaultItemOpen = true,
  onTotalChange,
  savedById,
  savedByName,
  registerBulkGenerate,
  registerBulkSave,
  config,
}: JobEstimateGfaFixtureEstimateBranchProps & { config: GfaFixtureBranchConfig }) {
  const [areaTakeoffs, setAreaTakeoffs] = useState<JobEstimateAreaTakeoff[]>([]);
  const [openings, setOpenings] = useState<JobEstimateOpening[]>([]);
  const [finishes, setFinishes] = useState<JobEstimateFinish[]>([]);
  const [projectDetails, setProjectDetails] =
    useState<JobEstimateProjectDetails>(emptyProjectDetails);
  const [hierarchy, setHierarchy] = useState<CostCodeHierarchyNode>(
    config.defaultHierarchy
  );
  const [reviewRow, setReviewRow] = useState<GfaFixtureReviewRow>(() =>
    buildReviewRow(null, config, grossFloorArea)
  );
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
          config.loadHierarchy(),
          getJobEstimateDetailedItem(estimate.id, config.costCode),
        ]);

        if (!isMounted) {
          return;
        }

        setAreaTakeoffs(loadedAreaTakeoffs);
        setOpenings(loadedOpenings);
        setFinishes(loadedFinishes);
        setProjectDetails(loadedProjectDetails);
        setHierarchy(loadedHierarchy);
        const initialReviewRow = buildReviewRow(
          savedEstimate,
          config,
          grossFloorArea
        );
        setReviewRow(initialReviewRow);
        setPersistedSignature(createSignature(initialReviewRow));
      } catch (error) {
        console.error(`Failed to load ${config.itemName} estimate branch:`, error);

        if (isMounted) {
          setAreaTakeoffs([]);
          setOpenings([]);
          setFinishes([]);
          setProjectDetails(emptyProjectDetails);
          setHierarchy(config.defaultHierarchy);
          const initialReviewRow = buildReviewRow(null, config, grossFloorArea);
          setReviewRow(initialReviewRow);
          setPersistedSignature(createSignature(initialReviewRow));
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
  }, [estimate, grossFloorArea, config]);

  const sourceRows = useMemo(
    () =>
      areaTakeoffs.filter(
        (row) => row.roomType.trim() || row.area.trim() || row.floorFinish.trim()
      ),
    [areaTakeoffs]
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

  const branchTotal = useMemo(() => calculateRowTotal(reviewRow), [reviewRow]);
  const totalQuantity = useMemo(
    () => parseOptionalNumber(reviewRow.quantity),
    [reviewRow.quantity]
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
        costCode: config.costCode,
        itemName: config.itemName,
        unit: "sq.ft",
        gfaSnapshot: grossFloorArea,
        saveStatus: "reviewed",
        sourceType: "ai_edited",
        savedById,
        savedByName,
        rows: [
          {
            rowKey: config.rowKey,
            rowLabel: config.itemName,
            quantity: parseOptionalNumber(reviewRow.quantity),
            quantityPerGfa: calculateQuantityPerGfa(
              parseOptionalNumber(reviewRow.quantity),
              grossFloorArea
            ),
            unit: "sq.ft",
            materialCostPerUnit: parseOptionalNumber(reviewRow.materialCostPerSqft),
            labourCostPerUnit: parseOptionalNumber(reviewRow.labourCostPerSqft),
            equipmentCostPerUnit: parseOptionalNumber(reviewRow.equipmentCostPerSqft),
            totalCostPerUnit: calculateRatePerSqft(reviewRow),
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
        error instanceof Error ? error.message : config.saveErrorMessage
      );
      setSaveStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGenerateDraft() {
    if (grossFloorArea <= 0) {
      setGenerationError("Gross Floor Area is required before generating this draft.");
      return;
    }

    setIsGeneratingDraft(true);
    setGenerationError("");
    setGenerationStatusMessage(config.generatingMessage);

    try {
      const response = await fetch(config.endpoint, {
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
          grossFloorAreaSqft: grossFloorArea,
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
          finishes: finishes.map((row) => ({
            finishType: row.finishType,
            description: row.description,
          })),
          openings: sourceOpenings.map((row) => ({
            openingType: row.openingType,
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
          item?: string;
          quantity?: number;
          unit?: "sq.ft";
          assumedSystem?: string;
          materialCostPerSqft?: number;
          labourCostPerSqft?: number;
          equipmentCostPerSqft?: number;
          assumptions?: string;
          confidence?: "low" | "medium" | "high";
          error?: string;
        }
      >(response, config.generateErrorMessage);

      setReviewRow((previousRow) => ({
        ...previousRow,
        item: payload?.item?.trim() || config.itemName,
        quantity: formatQuantityValue(payload?.quantity ?? grossFloorArea),
        unit: "sq.ft",
        assumedSystem: payload?.assumedSystem?.trim() || "Pending AI",
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
        error instanceof Error ? error.message : config.generateErrorMessage
      );
      setGenerationStatusMessage("");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  function handleRowChange(
    key: keyof Pick<
      GfaFixtureReviewRow,
      | "quantity"
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
        {config.loadingLabel}
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
                    <h4 className="text-lg font-semibold">{config.reviewTitle}</h4>
                    <p className="text-sm text-[var(--muted)]">
                      {config.reviewDescription}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateDraft()}
                      disabled={grossFloorArea <= 0 || isGeneratingDraft}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingDraft ? "Generating Draft..." : config.generateButtonLabel}
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
                          Quantity (sq.ft)
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
                        <td className="px-3 py-3 whitespace-normal break-words">
                          <p className="font-medium">{reviewRow.item}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {reviewRow.assumedSystem}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[var(--subtle)] whitespace-pre-wrap">
                            {reviewRow.assumptions}
                          </p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <JobEstimateRatioInput
                            quantityValue={reviewRow.quantity}
                            grossFloorArea={grossFloorArea}
                            onQuantityChange={(value) =>
                              setReviewRow((previousRow) => ({
                                ...previousRow,
                                quantity: value,
                              }))
                            }
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                          {formatQuantityValue(parseOptionalNumber(reviewRow.quantity))} sq.ft
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Input
                            value={reviewRow.materialCostPerSqft}
                            onChange={(event) =>
                              handleRowChange("materialCostPerSqft", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
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
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Input
                            value={reviewRow.equipmentCostPerSqft}
                            onChange={(event) =>
                              handleRowChange("equipmentCostPerSqft", event.target.value)
                            }
                            inputMode="decimal"
                            placeholder="0"
                            className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                          INR {formatCurrencyNumber(calculateRatePerSqft(reviewRow))}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-[var(--muted)]">
                          INR {formatCurrencyNumber(calculateRowTotal(reviewRow))}
                        </td>
                        <td className="px-3 py-3 whitespace-normal break-words">
                          <span className={buildStatusClassName(reviewRow.confidence)}>
                            {buildStatusLabel(reviewRow)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--surface)]">
                        <td className="px-3 py-3 font-semibold" colSpan={7}>
                          {config.itemName} Branch Total
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

function calculateOpeningAreaSqft(row: JobEstimateOpening) {
  const heightMm = parseOptionalNumber(row.height);
  const widthMm = parseOptionalNumber(row.width);
  const quantity = parseOptionalNumber(row.quantity);

  if (heightMm <= 0 || widthMm <= 0 || quantity <= 0) {
    return 0;
  }

  return (heightMm * widthMm * quantity) / 92903.04;
}

function formatQuantityValue(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
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
  quantity: string;
  materialCostPerSqft: string;
  labourCostPerSqft: string;
  equipmentCostPerSqft: string;
}) {
  return calculateRatePerSqft(row) * parseOptionalNumber(row.quantity);
}

function buildStatusLabel(row: {
  confidence: GfaFixtureReviewRow["confidence"];
  status: string;
}) {
  if (row.confidence === "pending") {
    return row.status;
  }

  return `${row.status} - ${row.confidence} confidence`;
}

function buildStatusClassName(confidence: GfaFixtureReviewRow["confidence"]) {
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
  savedEstimate: Awaited<ReturnType<typeof getJobEstimateDetailedItem>> | null,
  config: GfaFixtureBranchConfig,
  grossFloorArea: number
): GfaFixtureReviewRow {
  const savedRow = savedEstimate?.rows[0];

  if (!savedRow) {
    return {
      item: config.itemName,
      quantity: grossFloorArea > 0 ? formatQuantityValue(grossFloorArea) : "",
      unit: "sq.ft",
      assumedSystem: "Pending AI",
      materialCostPerSqft: "",
      labourCostPerSqft: "",
      equipmentCostPerSqft: "",
      assumptions: "Awaiting AI draft",
      confidence: "pending",
      status: "Awaiting draft",
    };
  }

  return {
    item: savedEstimate?.item.itemName ?? config.itemName,
    quantity: formatQuantityValue(savedRow.quantity),
    unit: "sq.ft",
    assumedSystem: savedRow.assumedSystem || "Pending AI",
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

function createSignature(row: GfaFixtureReviewRow) {
  return JSON.stringify({
    item: row.item,
    quantity: row.quantity,
    unit: row.unit,
    assumedSystem: row.assumedSystem,
    materialCostPerSqft: row.materialCostPerSqft,
    labourCostPerSqft: row.labourCostPerSqft,
    equipmentCostPerSqft: row.equipmentCostPerSqft,
    assumptions: row.assumptions,
    confidence: row.confidence,
    status: row.status,
  });
}




