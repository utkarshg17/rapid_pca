"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { createJobEstimate } from "@/features/dashboard/services/create-job-estimate";
import { getJobEstimates } from "@/features/dashboard/services/get-job-estimates";
import type { JobEstimate } from "@/features/dashboard/types/job-estimate";
import { getProjectTypeOptions } from "@/features/projects/services/get-project-type-options";
import type { ProjectTypeOption } from "@/features/projects/types/project";
import { formatDisplayDateTime } from "@/lib/date-format";

const selectClassName =
  "h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]";

export function DashboardJobEstimatorPanel() {
  const [estimates, setEstimates] = useState<JobEstimate[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>([]);
  const [isLoadingEstimates, setIsLoadingEstimates] = useState(true);
  const [isLoadingProjectTypes, setIsLoadingProjectTypes] = useState(false);
  const [isCreatingEstimate, setIsCreatingEstimate] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshEstimates = useCallback(async () => {
    setIsLoadingEstimates(true);

    try {
      const rows = await getJobEstimates();
      setEstimates(rows);
    } catch (error) {
      console.error("Failed to load job estimates:", error);
      setEstimates([]);
    } finally {
      setIsLoadingEstimates(false);
    }
  }, []);

  useEffect(() => {
    refreshEstimates();
  }, [refreshEstimates]);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    async function loadProjectTypes() {
      setIsLoadingProjectTypes(true);

      try {
        const options = await getProjectTypeOptions();
        setProjectTypes(options);

        if (options.length > 0) {
          setProjectTypeId((prev) => prev || String(options[0].id));
        }
      } finally {
        setIsLoadingProjectTypes(false);
      }
    }

    loadProjectTypes();
  }, [isDialogOpen]);

  function handleOpenDialog() {
    setProjectName("");
    setProjectTypeId("");
    setErrorMessage("");
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isCreatingEstimate) {
      return;
    }

    setProjectName("");
    setProjectTypeId("");
    setErrorMessage("");
    setIsDialogOpen(false);
  }

  async function handleCreateEstimate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedProjectName = projectName.trim();
    const selectedType =
      projectTypes.find((option) => String(option.id) === projectTypeId) ?? null;

    if (!normalizedProjectName) {
      setErrorMessage("Enter the job estimate project name first.");
      return;
    }

    if (!selectedType) {
      setErrorMessage("Choose a valid project type first.");
      return;
    }

    setIsCreatingEstimate(true);
    setErrorMessage("");

    try {
      const createdEstimate = await createJobEstimate({
        projectName: normalizedProjectName,
        projectType: selectedType.type_name,
      });

      setEstimates((prev) => [createdEstimate, ...prev]);
      handleCloseDialog();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create job estimate."
      );
    } finally {
      setIsCreatingEstimate(false);
    }
  }

  return (
    <>
      <section className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                Job Estimator
              </p>
              <h1 className="mt-2 text-2xl font-semibold">
                Job Estimator Workspace
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Build bidding estimates for new jobs from one dedicated
                workspace, separate from active project execution.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenDialog}
              className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
            >
              Create New Job Estimate
            </button>
          </div>
        </div>

        {isLoadingEstimates ? (
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-10 text-center shadow-[var(--shadow-lg)]">
            <p className="text-sm text-[var(--muted)]">Loading job estimates...</p>
          </div>
        ) : estimates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center shadow-[var(--shadow-lg)]">
            <h2 className="text-lg font-semibold">No job estimates yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Create your first job estimate shell to start designing the AI
              assisted bidding workflow.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {estimates.map((estimate) => (
              <Link
                key={estimate.id}
                href={`/dashboard/job-estimates/${estimate.id}`}
                className="block rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)] transition duration-200 hover:scale-[1.01] hover:border-[var(--border-strong)]"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                  Draft Estimate
                </p>
                <h2 className="mt-3 text-xl font-semibold">
                  {estimate.projectName}
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <InfoTile label="Project Type" value={estimate.projectType} />
                  <InfoTile
                    label="Created"
                    value={formatCreatedAt(estimate.createdAt)}
                  />
                </div>
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Open this estimate to continue building its project inputs and
                  AI-ready estimator context.
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateJobEstimateDialog
        isOpen={isDialogOpen}
        projectName={projectName}
        projectTypeId={projectTypeId}
        projectTypes={projectTypes}
        isLoadingProjectTypes={isLoadingProjectTypes}
        isCreatingEstimate={isCreatingEstimate}
        errorMessage={errorMessage}
        onClose={handleCloseDialog}
        onSubmit={handleCreateEstimate}
        onProjectNameChange={setProjectName}
        onProjectTypeIdChange={setProjectTypeId}
      />
    </>
  );
}

type CreateJobEstimateDialogProps = {
  isOpen: boolean;
  projectName: string;
  projectTypeId: string;
  projectTypes: ProjectTypeOption[];
  isLoadingProjectTypes: boolean;
  isCreatingEstimate: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onProjectNameChange: (value: string) => void;
  onProjectTypeIdChange: (value: string) => void;
};

function CreateJobEstimateDialog({
  isOpen,
  projectName,
  projectTypeId,
  projectTypes,
  isLoadingProjectTypes,
  isCreatingEstimate,
  errorMessage,
  onClose,
  onSubmit,
  onProjectNameChange,
  onProjectTypeIdChange,
}: CreateJobEstimateDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Create New Job Estimate</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Start a new estimate shell by naming the job and choosing the
              project type.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Job Estimate Project Name" required>
            <Input
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              placeholder="Enter the new estimate name"
            />
          </Field>

          <Field label="Type Of Project" required>
            <select
              value={projectTypeId}
              onChange={(event) => onProjectTypeIdChange(event.target.value)}
              className={selectClassName}
            >
              <option value="">
                {isLoadingProjectTypes
                  ? "Loading project types..."
                  : projectTypes.length === 0
                    ? "No project types available"
                    : "Select project type"}
              </option>
              {projectTypes.map((option) => (
                <option key={option.id} value={String(option.id)}>
                  {option.type_name}
                </option>
              ))}
            </select>
          </Field>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCreatingEstimate}
              className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
            >
              {isCreatingEstimate
                ? "Creating Estimate..."
                : "Create Estimate Shell"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
};

function Field({ label, children, required = false }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function formatCreatedAt(dateValue: string) {
  return formatDisplayDateTime(dateValue, dateValue);
}
