"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { saveJobEstimateProjectDetails } from "@/features/dashboard/services/save-job-estimate-project-details";
import {
  createDefaultJobEstimateProjectDetails,
  getJobEstimateProjectDetails,
} from "@/features/dashboard/services/get-job-estimate-project-details";
import type {
  JobEstimate,
  JobEstimateProjectDetails,
} from "@/features/dashboard/types/job-estimate";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";

const contractTypeOptions = ["Lump Sum", "EPC"];
const boundaryWallOptions = ["Yes", "No"];
const foundationTypeOptions = [
  "Isolated Footing",
  "Raft",
  "Raft + Isolated Footing",
  "Isolated Footing + Combined Footing",
  "Raft + Pile",
];
const superstructureTypeOptions = [
  "RCC Moment Frame",
  "RCC Shear Wall",
  "Steel",
];
const selectClassName =
  "h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]";

type JobEstimateProjectDetailsPanelProps = {
  estimate: JobEstimate;
  currentUser: UserProfile | null;
  onEstimateUpdated: (estimate: JobEstimate) => void;
};

export function JobEstimateProjectDetailsPanel({
  estimate,
  currentUser,
  onEstimateUpdated,
}: JobEstimateProjectDetailsPanelProps) {
  const [form, setForm] = useState<JobEstimateProjectDetails | null>(null);
  const [persistedSignature, setPersistedSignature] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [saveStatusMessage, setSaveStatusMessage] = useState("");

  const loadDetails = useCallback(async () => {
    setIsLoading(true);

    try {
      const details = await getJobEstimateProjectDetails(estimate);
      setForm(details);
      setPersistedSignature(createFormSignature(details));
      setSaveStatusMessage("");
      setSaveErrorMessage("");
    } catch (error) {
      console.error("Failed to load job estimate project details:", error);
      const fallbackDetails = createDefaultJobEstimateProjectDetails(estimate);
      setForm(fallbackDetails);
      setPersistedSignature(createFormSignature(fallbackDetails));
      setSaveErrorMessage("");
    } finally {
      setIsLoading(false);
    }
  }, [estimate]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const sectionCount = useMemo(() => {
    if (!form) {
      return 0;
    }

    return countCompletedFields(form);
  }, [form]);

  function updateField<K extends keyof JobEstimateProjectDetails>(
    key: K,
    value: JobEstimateProjectDetails[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function persistForm(nextForm: JobEstimateProjectDetails) {
    const nextSignature = createFormSignature(nextForm);

    if (nextSignature === persistedSignature) {
      return;
    }

    if (!currentUser?.id) {
      setSaveErrorMessage("You must be logged in to save job estimate project details.");
      return;
    }

    const createdById = Number(currentUser.id);

    if (!Number.isFinite(createdById)) {
      setSaveErrorMessage("The current user id is not in a numeric format.");
      return;
    }

    const createdByName =
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
      currentUser.email_id ||
      "Unknown User";

    const payload: JobEstimateProjectDetails = {
      ...nextForm,
      createdById,
      createdByName,
      jobEstimateProjectId: estimate.id,
    };

    setIsSaving(true);
    setSaveErrorMessage("");
    setSaveStatusMessage("Saving changes...");

    try {
      await saveJobEstimateProjectDetails(payload);
      setPersistedSignature(createFormSignature(payload));
      setSaveStatusMessage(`Saved at ${new Date().toLocaleTimeString()}`);

      if (
        payload.projectName !== estimate.projectName ||
        payload.projectType !== estimate.projectType
      ) {
        onEstimateUpdated({
          ...estimate,
          projectName: payload.projectName,
          projectType: payload.projectType,
        });
      }
    } catch (error) {
      console.error(error);
      setSaveErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save project details."
      );
      setSaveStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  function handleBlurSave() {
    if (!form) {
      return;
    }

    void persistForm(form);
  }

  function handleImmediateSave<K extends keyof JobEstimateProjectDetails>(
    key: K,
    value: JobEstimateProjectDetails[K]
  ) {
    if (!form) {
      return;
    }

    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    void persistForm(nextForm);
  }

  if (isLoading || !form) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
        Loading project details...
      </section>
    );
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Project Details
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Job Estimate Project Details
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Fill in as much project information as possible. The richer this
              document is, the better the AI can understand the building and
              prepare a reliable estimate draft.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Fields Filled" value={`${sectionCount}/19`} />
            <InfoTile
              label="Status"
              value={isSaving ? "Saving..." : saveStatusMessage || "Ready"}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <FormSection
          title="Project Details"
          description="Core bid and stakeholder information for this job estimate."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Project Name" required>
              <Input
                value={form.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter project name"
              />
            </Field>

            <Field label="Project Type" required>
              <Input
                value={form.projectType}
                onChange={(event) => updateField("projectType", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter project type"
              />
            </Field>

            <Field label="Client">
              <Input
                value={form.client}
                onChange={(event) => updateField("client", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter client name"
              />
            </Field>

            <Field label="Architect">
              <Input
                value={form.architect}
                onChange={(event) => updateField("architect", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter architect name"
              />
            </Field>

            <Field label="Contract Type">
              <select
                value={form.contractType}
                onChange={(event) =>
                  handleImmediateSave("contractType", event.target.value)
                }
                className={selectClassName}
              >
                <option value="">Select contract type</option>
                {contractTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Submission Deadline">
              <Input
                type="date"
                value={form.submissionDeadline}
                onChange={(event) =>
                  updateField("submissionDeadline", event.target.value)
                }
                onBlur={handleBlurSave}
              />
            </Field>

            <Field label="Tender Estimate Amount">
              <InputWithSuffix suffix="INR">
                <Input
                  value={form.tenderEstimatedAmount}
                  onChange={(event) =>
                    updateField("tenderEstimatedAmount", event.target.value)
                  }
                  onBlur={handleBlurSave}
                  inputMode="decimal"
                  placeholder="Enter tender estimate"
                  className="pr-16"
                />
              </InputWithSuffix>
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Project Location"
          description="Location information that helps frame logistics and market assumptions."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="City">
              <Input
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter city"
              />
            </Field>

            <Field label="State">
              <Input
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter state"
              />
            </Field>

            <Field label="Country">
              <Input
                value={form.country}
                onChange={(event) => updateField("country", event.target.value)}
                onBlur={handleBlurSave}
                placeholder="Enter country"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Project Footprint"
          description="High-level footprint and vertical stacking information for the building."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Total Plot Area">
              <InputWithSuffix suffix="sq.ft">
                <Input
                  value={form.totalPlotArea}
                  onChange={(event) =>
                    updateField("totalPlotArea", event.target.value)
                  }
                  onBlur={handleBlurSave}
                  inputMode="decimal"
                  placeholder="Enter plot area"
                  className="pr-20"
                />
              </InputWithSuffix>
            </Field>

            <Field label="Boundary Wall">
              <select
                value={form.boundaryWall}
                onChange={(event) =>
                  handleImmediateSave("boundaryWall", event.target.value)
                }
                className={selectClassName}
              >
                <option value="">Select option</option>
                {boundaryWallOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Basement Count">
              <Input
                value={form.basementCount}
                onChange={(event) =>
                  updateField("basementCount", event.target.value)
                }
                onBlur={handleBlurSave}
                inputMode="numeric"
                placeholder="Enter basement count"
              />
            </Field>

            <Field label="Basement Area">
              <InputWithSuffix suffix="sq.ft">
                <Input
                  value={form.basementArea}
                  onChange={(event) =>
                    updateField("basementArea", event.target.value)
                  }
                  onBlur={handleBlurSave}
                  inputMode="decimal"
                  placeholder="Enter basement area"
                  className="pr-20"
                />
              </InputWithSuffix>
            </Field>

            <Field label="Superstructure Footprint">
              <InputWithSuffix suffix="sq.ft">
                <Input
                  value={form.superstructureFootprint}
                  onChange={(event) =>
                    updateField("superstructureFootprint", event.target.value)
                  }
                  onBlur={handleBlurSave}
                  inputMode="decimal"
                  placeholder="Enter footprint"
                  className="pr-20"
                />
              </InputWithSuffix>
            </Field>

            <Field label="Stilt Floor Count">
              <Input
                value={form.stiltFloorCount}
                onChange={(event) =>
                  updateField("stiltFloorCount", event.target.value)
                }
                onBlur={handleBlurSave}
                inputMode="numeric"
                placeholder="Enter stilt count"
              />
            </Field>

            <Field label="Floor Count">
              <Input
                value={form.floorCount}
                onChange={(event) => updateField("floorCount", event.target.value)}
                onBlur={handleBlurSave}
                inputMode="numeric"
                placeholder="Enter floor count"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Structural Details"
          description="Structural system inputs that strongly influence cost and construction methodology."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Foundation Type">
              <select
                value={form.foundationType}
                onChange={(event) =>
                  handleImmediateSave("foundationType", event.target.value)
                }
                className={selectClassName}
              >
                <option value="">Select foundation type</option>
                {foundationTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Superstructure Type">
              <select
                value={form.superstructureType}
                onChange={(event) =>
                  handleImmediateSave("superstructureType", event.target.value)
                }
                className={selectClassName}
              >
                <option value="">Select superstructure type</option>
                {superstructureTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </FormSection>
      </div>

      {saveErrorMessage ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {saveErrorMessage}
        </div>
      ) : null}
    </section>
  );
}

type FormSectionProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
          {title}
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          {description}
        </p>
      </div>
      {children}
    </section>
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

function InputWithSuffix({
  children,
  suffix,
}: {
  children: React.ReactNode;
  suffix: string;
}) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
        {suffix}
      </span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function createFormSignature(details: JobEstimateProjectDetails) {
  return JSON.stringify({
    ...details,
    createdAt: undefined,
  });
}

function countCompletedFields(details: JobEstimateProjectDetails) {
  const values = [
    details.projectName,
    details.projectType,
    details.client,
    details.architect,
    details.contractType,
    details.submissionDeadline,
    details.tenderEstimatedAmount,
    details.city,
    details.state,
    details.country,
    details.totalPlotArea,
    details.boundaryWall,
    details.basementCount,
    details.basementArea,
    details.superstructureFootprint,
    details.stiltFloorCount,
    details.floorCount,
    details.foundationType,
    details.superstructureType,
  ];

  return values.filter((value) => value.trim()).length;
}

