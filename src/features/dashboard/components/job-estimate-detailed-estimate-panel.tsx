"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import type {
  BulkGenerateDraftHandler,
  BulkSaveDraftHandler,
} from "@/features/dashboard/components/job-estimate-bulk-draft";
import {
  formatAreaNumber,
  formatCurrencyNumber,
} from "@/features/dashboard/components/job-estimate-branch-metrics";
import { JobEstimateBrickWorkEstimateBranch } from "@/features/dashboard/components/job-estimate-brick-work-estimate-branch";
import { JobEstimateColumnFoundationsFootingsEstimateBranch } from "@/features/dashboard/components/job-estimate-column-foundations-footings-estimate-branch";
import {
  JobEstimateArchitecturalDesignEstimateBranch,
  JobEstimateFireProtectionDesignEstimateBranch,
  JobEstimateInteriorDesignServicesEstimateBranch,
  JobEstimateMepEngineeringEstimateBranch,
  JobEstimateStructuralEngineeringEstimateBranch,
} from "@/features/dashboard/components/job-estimate-design-service-estimate-branch";
import { JobEstimateElectricalCondutingEstimateBranch } from "@/features/dashboard/components/job-estimate-electrical-conduting-estimate-branch";
import {
  JobEstimateElectricalFixturesEstimateBranch,
  JobEstimateFireProtectionDistributionAndStorageEstimateBranch,
  JobEstimatePlumbingFixturesEstimateBranch,
} from "@/features/dashboard/components/job-estimate-gfa-fixture-estimate-branch";
import { JobEstimateRegularStairEstimateBranch } from "@/features/dashboard/components/job-estimate-regular-stair-estimate-branch";
import { JobEstimatePlumbingPipeEstimateBranch } from "@/features/dashboard/components/job-estimate-plumbing-pipe-estimate-branch";
import { JobEstimateExteriorPaintEstimateBranch } from "@/features/dashboard/components/job-estimate-exterior-paint-estimate-branch";
import { JobEstimateExteriorPlasterEstimateBranch } from "@/features/dashboard/components/job-estimate-exterior-plaster-estimate-branch";
import { JobEstimateFlooringEstimateBranch } from "@/features/dashboard/components/job-estimate-flooring-estimate-branch";
import { JobEstimateInteriorPaintEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-paint-estimate-branch";
import { JobEstimateInteriorDoorsEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-doors-estimate-branch";
import { JobEstimateInteriorWindowsEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-windows-estimate-branch";
import { JobEstimateInteriorPlasterEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-plaster-estimate-branch";
import { JobEstimateClearingAndGrubbingEstimateBranch } from "@/features/dashboard/components/job-estimate-clearing-and-grubbing-estimate-branch";
import { JobEstimateRoofWaterproofingEstimateBranch } from "@/features/dashboard/components/job-estimate-roof-waterproofing-estimate-branch";
import { JobEstimateUpperFloorsConstructionEstimateBranch } from "@/features/dashboard/components/job-estimate-upper-floors-construction-estimate-branch";
import { JobEstimateVerticalStructuralElementsEstimateBranch } from "@/features/dashboard/components/job-estimate-vertical-structural-elements-estimate-branch";
import { getJobEstimateProjectDetails } from "@/features/dashboard/services/get-job-estimate-project-details";
import type { JobEstimate } from "@/features/dashboard/types/job-estimate";

type JobEstimateDetailedEstimatePanelProps = {
  estimate: JobEstimate;
  currentUser: UserProfile | null;
};

const initialBranchTotals = {
  columnFoundationsFootings: 0,
  upperFloorsConstruction: 0,
  verticalStructuralElements: 0,
  exteriorPlaster: 0,
  exteriorPaint: 0,
  roofWaterproofing: 0,
  interiorWindows: 0,
  brickWork: 0,
  regularStair: 0,
  interiorDoors: 0,
  interiorPlaster: 0,
  interiorPaint: 0,
  flooring: 0,
  plumbingFixtures: 0,
  plumbingPipe: 0,
  electricalConduting: 0,
  electricalFixtures: 0,
  clearingAndGrubbing: 0,
  fireProtectionDistributionAndStorage: 0,
  architecturalDesign: 0,
  interiorDesignServices: 0,
  structuralEngineering: 0,
  mepEngineering: 0,
  fireProtectionDesign: 0,
};

type DetailedEstimateBranchKey = keyof typeof initialBranchTotals;

const detailedEstimateBranchOrder: DetailedEstimateBranchKey[] = [
  "columnFoundationsFootings",
  "upperFloorsConstruction",
  "verticalStructuralElements",
  "exteriorPlaster",
  "exteriorPaint",
  "roofWaterproofing",
  "interiorWindows",
  "brickWork",
  "regularStair",
  "interiorDoors",
  "interiorPlaster",
  "interiorPaint",
  "flooring",
  "plumbingFixtures",
  "plumbingPipe",
  "electricalConduting",
  "electricalFixtures",
  "clearingAndGrubbing",
  "fireProtectionDistributionAndStorage",
  "architecturalDesign",
  "interiorDesignServices",
  "structuralEngineering",
  "mepEngineering",
  "fireProtectionDesign",
];

const detailedEstimateBranchLabels: Record<DetailedEstimateBranchKey, string> = {
  columnFoundationsFootings: "Column Foundations + Footings",
  upperFloorsConstruction: "Upper Floors Construction (Slab + Beam)",
  verticalStructuralElements: "Vertical Structural Elements",
  exteriorPlaster: "Exterior Plaster",
  exteriorPaint: "Exterior Paint",
  roofWaterproofing: "Roof Waterproofing",
  interiorWindows: "Interior Windows",
  brickWork: "Brick Work",
  regularStair: "Regular Stair",
  interiorDoors: "Interior Doors",
  interiorPlaster: "Interior Plaster",
  interiorPaint: "Interior Paint",
  flooring: "Flooring",
  plumbingFixtures: "Plumbing Fixtures",
  plumbingPipe: "Plumbing Pipe",
  electricalConduting: "Electrical Conduting",
  electricalFixtures: "Electrical Fixtures",
  clearingAndGrubbing: "Clearing and Grubbing",
  fireProtectionDistributionAndStorage:
    "Fire Protection Distribution and Storage",
  architecturalDesign: "Architectural Design",
  interiorDesignServices: "Interior Design Services",
  structuralEngineering: "Structural Engineering",
  mepEngineering: "MEP Engineering",
  fireProtectionDesign: "Fire Protection Design",
};

export function JobEstimateDetailedEstimatePanel({
  estimate,
  currentUser,
}: JobEstimateDetailedEstimatePanelProps) {
  const [grossFloorArea, setGrossFloorArea] = useState(0);
  const [areItemsExpanded, setAreItemsExpanded] = useState(true);
  const [isGeneratingAllDrafts, setIsGeneratingAllDrafts] = useState(false);
  const [bulkGenerateProgress, setBulkGenerateProgress] = useState({
    current: 0,
    total: 0,
    label: "",
  });
  const [isSavingAllChanges, setIsSavingAllChanges] = useState(false);
  const [bulkSaveProgress, setBulkSaveProgress] = useState({
    current: 0,
    total: 0,
    label: "",
  });
  const [saveableBranchCount, setSaveableBranchCount] = useState(0);
  const [itemViewVersion, setItemViewVersion] = useState(0);
  const [branchTotals, setBranchTotals] = useState(initialBranchTotals);
  const bulkGenerateHandlersRef = useRef<
    Partial<Record<DetailedEstimateBranchKey, BulkGenerateDraftHandler>>
  >({});
  const bulkSaveHandlersRef = useRef<
    Partial<Record<DetailedEstimateBranchKey, BulkSaveDraftHandler>>
  >({});

  const estimatedProjectCost = useMemo(
    () =>
      Object.values(branchTotals).reduce(
        (runningTotal, value) => runningTotal + value,
        0
      ),
    [branchTotals]
  );
  const estimatedUnitCost = useMemo(
    () => (grossFloorArea > 0 ? estimatedProjectCost / grossFloorArea : 0),
    [estimatedProjectCost, grossFloorArea]
  );

  const savedById = currentUser?.auth_user_id ?? null;
  const savedByName = buildSavedByName(currentUser);

  useEffect(() => {
    let isMounted = true;

    async function loadGrossFloorArea() {
      try {
        const projectDetails = await getJobEstimateProjectDetails(estimate);

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
      } catch (error) {
        console.error("Failed to load gross floor area:", error);

        if (isMounted) {
          setGrossFloorArea(0);
        }
      }
    }

    loadGrossFloorArea();

    return () => {
      isMounted = false;
    };
  }, [estimate]);

  function handleSetAllItemsExpanded(nextValue: boolean) {
    setAreItemsExpanded(nextValue);
    setItemViewVersion((previous) => previous + 1);
  }

  function handleBranchTotalChange(
    key: keyof typeof branchTotals,
    value: number
  ) {
    setBranchTotals((previous) =>
      previous[key] === value ? previous : { ...previous, [key]: value }
    );
  }

  function handleRegisterBulkGenerate(
    key: DetailedEstimateBranchKey,
    handler: BulkGenerateDraftHandler | null
  ) {
    if (handler) {
      bulkGenerateHandlersRef.current[key] = handler;
      return;
    }

    delete bulkGenerateHandlersRef.current[key];
  }

  function handleRegisterBulkSave(
    key: DetailedEstimateBranchKey,
    handler: BulkSaveDraftHandler | null
  ) {
    if (handler) {
      bulkSaveHandlersRef.current[key] = handler;
    } else {
      delete bulkSaveHandlersRef.current[key];
    }

    setSaveableBranchCount(Object.keys(bulkSaveHandlersRef.current).length);
  }

  async function handleGenerateAllDrafts() {
    if (isGeneratingAllDrafts) {
      return;
    }

    const availableDrafts = detailedEstimateBranchOrder.flatMap((key) => {
      const handler = bulkGenerateHandlersRef.current[key];

      if (!handler) {
        return [];
      }

      return [{ key, handler }];
    });

    if (availableDrafts.length === 0) {
      return;
    }

    setIsGeneratingAllDrafts(true);
    setBulkGenerateProgress({
      current: 0,
      total: availableDrafts.length,
      label: "Preparing estimate packages...",
    });

    try {
      for (const [index, draft] of availableDrafts.entries()) {
        setBulkGenerateProgress({
          current: index + 1,
          total: availableDrafts.length,
          label: detailedEstimateBranchLabels[draft.key],
        });
        await draft.handler();
      }
    } finally {
      setIsGeneratingAllDrafts(false);
      setBulkGenerateProgress({
        current: 0,
        total: 0,
        label: "",
      });
    }
  }

  async function handleSaveAllChanges() {
    if (isSavingAllChanges) {
      return;
    }

    const availableSaves = detailedEstimateBranchOrder.flatMap((key) => {
      const handler = bulkSaveHandlersRef.current[key];

      if (!handler) {
        return [];
      }

      return [{ key, handler }];
    });

    if (availableSaves.length === 0) {
      return;
    }

    setIsSavingAllChanges(true);
    setBulkSaveProgress({
      current: 0,
      total: availableSaves.length,
      label: "Preparing estimate saves...",
    });

    try {
      for (const [index, draft] of availableSaves.entries()) {
        setBulkSaveProgress({
          current: index + 1,
          total: availableSaves.length,
          label: detailedEstimateBranchLabels[draft.key],
        });
        await draft.handler();
      }
    } finally {
      setIsSavingAllChanges(false);
      setBulkSaveProgress({
        current: 0,
        total: 0,
        label: "",
      });
    }
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Detailed Job Estimate
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Detailed Job Estimate</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              This is where each AI-generated estimate package will live for
              review. Right now the workspace includes separate draft branches
              for Column Foundations + Footings, Upper Floors Construction (Slab + Beam),
              Vertical Structural Elements, Exterior Plaster, Exterior Paint,
              Roof Waterproofing, Interior Windows, Brick Work, Regular Stair,
              Interior Doors, Interior Plaster, Interior Paint, Flooring,
              Plumbing Fixtures, Plumbing Pipe, Electrical Conduting,
              Electrical Fixtures, Clearing and Grubbing, Fire Protection Distribution and Storage, and design-service branches, and the
              returned values remain editable for the estimator.
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
                Live total from the estimate items shown below.
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
                Superstructure Footprint Ã— (Stilt Floor Count + Floor Count)
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
                Estimated Project Cost Ã· Gross Floor Area
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Cost Code Breakdown
            </p>
            <h3 className="text-xl font-semibold">Estimate Items</h3>
            <p className="max-w-3xl text-sm text-[var(--muted)]">
              Each AI-generated estimate package is shown directly at the item level
              and ordered by cost code so estimators can get to the useful rows faster.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSetAllItemsExpanded(true)}
              disabled={areItemsExpanded}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => handleSetAllItemsExpanded(false)}
              disabled={!areItemsExpanded}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Collapse All
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateAllDrafts()}
              disabled={isGeneratingAllDrafts || isSavingAllChanges}
              className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingAllDrafts
                ? "Generating AI Draft..."
                : "Generate AI Draft"}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAllChanges()}
              disabled={
                isSavingAllChanges ||
                isGeneratingAllDrafts ||
                saveableBranchCount === 0
              }
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingAllChanges
                ? "Saving All Changes..."
                : "Save All Changes"}
            </button>
          </div>
        </div>

        {isGeneratingAllDrafts ? (
          <div className="mt-5 rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-4 text-[var(--status-info-fg)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--status-info-border)] border-t-transparent"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold">Preparing AI estimates</p>
                  <p className="text-sm">
                    {bulkGenerateProgress.current > 0 &&
                    bulkGenerateProgress.total > 0
                      ? `Generating ${bulkGenerateProgress.current} of ${bulkGenerateProgress.total}: ${bulkGenerateProgress.label}`
                      : "Preparing estimate packages..."}
                  </p>
                </div>
              </div>

              <div className="w-full max-w-xs">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]">
                  <div
                    className="h-full rounded-full bg-[var(--status-info-fg)] transition-all duration-300"
                    style={{
                      width:
                        bulkGenerateProgress.total > 0
                          ? `${(bulkGenerateProgress.current / bulkGenerateProgress.total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isSavingAllChanges ? (
          <div className="mt-5 rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-4 text-[var(--status-success-fg)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--status-success-border)] border-t-transparent"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold">Saving estimate changes</p>
                  <p className="text-sm">
                    {bulkSaveProgress.current > 0 && bulkSaveProgress.total > 0
                      ? `Saving ${bulkSaveProgress.current} of ${bulkSaveProgress.total}: ${bulkSaveProgress.label}`
                      : "Saving changed estimate items..."}
                  </p>
                </div>
              </div>

              <div className="w-full max-w-xs">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]">
                  <div
                    className="h-full rounded-full bg-[var(--status-success-fg)] transition-all duration-300"
                    style={{
                      width:
                        bulkSaveProgress.total > 0
                          ? `${(bulkSaveProgress.current / bulkSaveProgress.total) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-6">
          <JobEstimateColumnFoundationsFootingsEstimateBranch
            key={`column-foundations-footings-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("columnFoundationsFootings", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("columnFoundationsFootings", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("columnFoundationsFootings", value)
            }
          />
          <JobEstimateUpperFloorsConstructionEstimateBranch
            key={`upper-floors-construction-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("upperFloorsConstruction", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("upperFloorsConstruction", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("upperFloorsConstruction", value)
            }
          />
          <JobEstimateVerticalStructuralElementsEstimateBranch
            key={`vertical-structural-elements-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("verticalStructuralElements", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("verticalStructuralElements", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("verticalStructuralElements", value)
            }
          />
          <JobEstimateExteriorPlasterEstimateBranch
            key={`exterior-plaster-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("exteriorPlaster", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("exteriorPlaster", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("exteriorPlaster", value)
            }
          />
          <JobEstimateExteriorPaintEstimateBranch
            key={`exterior-paint-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("exteriorPaint", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("exteriorPaint", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("exteriorPaint", value)
            }
          />
          <JobEstimateRoofWaterproofingEstimateBranch
            key={`roof-waterproofing-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("roofWaterproofing", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("roofWaterproofing", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("roofWaterproofing", value)
            }
          />
          <JobEstimateInteriorWindowsEstimateBranch
            key={`interior-windows-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("interiorWindows", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("interiorWindows", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("interiorWindows", value)
            }
          />
          <JobEstimateBrickWorkEstimateBranch
            key={`brick-work-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("brickWork", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("brickWork", handler)
            }
            onTotalChange={(value) => handleBranchTotalChange("brickWork", value)}
          />
          <JobEstimateRegularStairEstimateBranch
            key={`regular-stair-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("regularStair", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("regularStair", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("regularStair", value)
            }
          />
          <JobEstimateInteriorDoorsEstimateBranch
            key={`interior-doors-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("interiorDoors", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("interiorDoors", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("interiorDoors", value)
            }
          />
          <JobEstimateInteriorPlasterEstimateBranch
            key={`interior-plaster-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("interiorPlaster", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("interiorPlaster", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("interiorPlaster", value)
            }
          />
          <JobEstimateInteriorPaintEstimateBranch
            key={`interior-paint-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("interiorPaint", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("interiorPaint", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("interiorPaint", value)
            }
          />
          <JobEstimateFlooringEstimateBranch
            key={`flooring-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("flooring", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("flooring", handler)
            }
            onTotalChange={(value) => handleBranchTotalChange("flooring", value)}
          />
          <JobEstimatePlumbingFixturesEstimateBranch
            key={`plumbing-fixtures-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("plumbingFixtures", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("plumbingFixtures", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("plumbingFixtures", value)
            }
          />
          <JobEstimatePlumbingPipeEstimateBranch
            key={`plumbing-pipe-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("plumbingPipe", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("plumbingPipe", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("plumbingPipe", value)
            }
          />
          <JobEstimateElectricalCondutingEstimateBranch
            key={`electrical-conduting-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("electricalConduting", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("electricalConduting", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("electricalConduting", value)
            }
          />
          <JobEstimateElectricalFixturesEstimateBranch
            key={`electrical-fixtures-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("electricalFixtures", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("electricalFixtures", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("electricalFixtures", value)
            }
          />
          <JobEstimateClearingAndGrubbingEstimateBranch
            key={`clearing-and-grubbing-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("clearingAndGrubbing", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("clearingAndGrubbing", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("clearingAndGrubbing", value)
            }
          />
          <JobEstimateFireProtectionDistributionAndStorageEstimateBranch
            key={`fire-protection-distribution-and-storage-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("fireProtectionDistributionAndStorage", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("fireProtectionDistributionAndStorage", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("fireProtectionDistributionAndStorage", value)
            }
          />
          <JobEstimateArchitecturalDesignEstimateBranch
            key={`architectural-design-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("architecturalDesign", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("architecturalDesign", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("architecturalDesign", value)
            }
          />
          <JobEstimateInteriorDesignServicesEstimateBranch
            key={`interior-design-services-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("interiorDesignServices", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("interiorDesignServices", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("interiorDesignServices", value)
            }
          />
          <JobEstimateStructuralEngineeringEstimateBranch
            key={`structural-engineering-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("structuralEngineering", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("structuralEngineering", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("structuralEngineering", value)
            }
          />
          <JobEstimateMepEngineeringEstimateBranch
            key={`mep-engineering-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("mepEngineering", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("mepEngineering", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("mepEngineering", value)
            }
          />
          <JobEstimateFireProtectionDesignEstimateBranch
            key={`fire-protection-design-${itemViewVersion}-${areItemsExpanded ? "open" : "closed"}`}
            estimate={estimate}
            itemOnly
            grossFloorArea={grossFloorArea}
            defaultItemOpen={areItemsExpanded}
            savedById={savedById}
            savedByName={savedByName}
            registerBulkGenerate={(handler) =>
              handleRegisterBulkGenerate("fireProtectionDesign", handler)
            }
            registerBulkSave={(handler) =>
              handleRegisterBulkSave("fireProtectionDesign", handler)
            }
            onTotalChange={(value) =>
              handleBranchTotalChange("fireProtectionDesign", value)
            }
          />
        </div>
      </section>
    </section>
  );
}

function buildSavedByName(currentUser: UserProfile | null) {
  if (!currentUser) {
    return "";
  }

  return (
    [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
    currentUser.email_id ||
    ""
  );
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim();
  const parsed = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

































