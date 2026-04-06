"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import type { BulkGenerateDraftHandler } from "@/features/dashboard/components/job-estimate-bulk-draft";
import {
  formatAreaNumber,
  formatCurrencyNumber,
} from "@/features/dashboard/components/job-estimate-branch-metrics";
import { JobEstimateBrickWorkEstimateBranch } from "@/features/dashboard/components/job-estimate-brick-work-estimate-branch";
import { JobEstimateColumnFoundationsFootingsEstimateBranch } from "@/features/dashboard/components/job-estimate-column-foundations-footings-estimate-branch";
import { JobEstimateElectricalCondutingEstimateBranch } from "@/features/dashboard/components/job-estimate-electrical-conduting-estimate-branch";
import { JobEstimateRegularStairEstimateBranch } from "@/features/dashboard/components/job-estimate-regular-stair-estimate-branch";
import { JobEstimatePlumbingPipeEstimateBranch } from "@/features/dashboard/components/job-estimate-plumbing-pipe-estimate-branch";
import { JobEstimateExteriorPaintEstimateBranch } from "@/features/dashboard/components/job-estimate-exterior-paint-estimate-branch";
import { JobEstimateExteriorPlasterEstimateBranch } from "@/features/dashboard/components/job-estimate-exterior-plaster-estimate-branch";
import { JobEstimateFlooringEstimateBranch } from "@/features/dashboard/components/job-estimate-flooring-estimate-branch";
import { JobEstimateInteriorPaintEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-paint-estimate-branch";
import { JobEstimateInteriorDoorsEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-doors-estimate-branch";
import { JobEstimateInteriorPlasterEstimateBranch } from "@/features/dashboard/components/job-estimate-interior-plaster-estimate-branch";
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
  brickWork: 0,
  regularStair: 0,
  interiorDoors: 0,
  interiorPlaster: 0,
  interiorPaint: 0,
  flooring: 0,
  plumbingPipe: 0,
  electricalConduting: 0,
};

type DetailedEstimateBranchKey = keyof typeof initialBranchTotals;

const detailedEstimateBranchOrder: DetailedEstimateBranchKey[] = [
  "columnFoundationsFootings",
  "upperFloorsConstruction",
  "verticalStructuralElements",
  "exteriorPlaster",
  "exteriorPaint",
  "brickWork",
  "regularStair",
  "interiorDoors",
  "interiorPlaster",
  "interiorPaint",
  "flooring",
  "plumbingPipe",
  "electricalConduting",
];

export function JobEstimateDetailedEstimatePanel({
  estimate,
  currentUser,
}: JobEstimateDetailedEstimatePanelProps) {
  const [grossFloorArea, setGrossFloorArea] = useState(0);
  const [areItemsExpanded, setAreItemsExpanded] = useState(true);
  const [isGeneratingAllDrafts, setIsGeneratingAllDrafts] = useState(false);
  const [itemViewVersion, setItemViewVersion] = useState(0);
  const [branchTotals, setBranchTotals] = useState(initialBranchTotals);
  const bulkGenerateHandlersRef = useRef<
    Partial<Record<DetailedEstimateBranchKey, BulkGenerateDraftHandler>>
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

  async function handleGenerateAllDrafts() {
    if (isGeneratingAllDrafts) {
      return;
    }

    setIsGeneratingAllDrafts(true);

    try {
      for (const key of detailedEstimateBranchOrder) {
        const handler = bulkGenerateHandlersRef.current[key];

        if (!handler) {
          continue;
        }

        await handler();
      }
    } finally {
      setIsGeneratingAllDrafts(false);
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
              Brick Work, Regular Stair, Interior Doors, Interior Plaster, Interior Paint, Flooring, Plumbing Pipe, and Electrical Conduting, and the
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
                Superstructure Footprint × (Stilt Floor Count + Floor Count)
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
                Estimated Project Cost ÷ Gross Floor Area
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
              disabled={isGeneratingAllDrafts}
              className="rounded-2xl border border-[var(--border)] bg-[var(--inverse-bg)] px-4 py-2.5 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingAllDrafts
                ? "Generating AI Draft..."
                : "Generate AI Draft"}
            </button>
          </div>
        </div>

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
            onTotalChange={(value) =>
              handleBranchTotalChange("exteriorPaint", value)
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
            onTotalChange={(value) => handleBranchTotalChange("flooring", value)}
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
            onTotalChange={(value) =>
              handleBranchTotalChange("electricalConduting", value)
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
















