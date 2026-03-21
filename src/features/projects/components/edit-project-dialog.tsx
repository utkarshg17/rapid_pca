"use client";

import { useEffect, useState } from "react";
import {
  initialProjectFormState,
  ProjectFormFields,
  type ProjectFormState,
} from "@/features/projects/components/project-form-fields";
import { getProjectTypeOptions } from "@/features/projects/services/get-project-type-options";
import { updateProject } from "@/features/projects/services/update-project";
import type {
  CreateProjectInput,
  ProjectRecord,
  ProjectTypeOption,
} from "@/features/projects/types/project";

type EditProjectDialogProps = {
  isOpen: boolean;
  project: ProjectRecord;
  onClose: () => void;
  onProjectUpdated: (project: ProjectRecord) => void;
};

function parseNullableNumber(value: string) {
  if (!value.trim()) return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseNullableInteger(value: string) {
  if (!value.trim()) return null;

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toCountValue(value: number | null, fallback: string) {
  return value === null ? fallback : String(value);
}

function buildInitialFormState(project: ProjectRecord): ProjectFormState {
  return {
    ...initialProjectFormState,
    project_name: project.project_name,
    expected_start_date: project.expected_start_date ?? "",
    plot_area: project.plot_area === null ? "" : String(project.plot_area),
    project_footprint:
      project.project_footprint === null
        ? ""
        : String(project.project_footprint),
    basement_count: toCountValue(project.basement_count, "0"),
    stilt_count: toCountValue(project.stilt_count, "0"),
    podium_count: toCountValue(project.podium_count, "0"),
    floor_count: toCountValue(project.floor_count, "1"),
    foundation_type: project.foundation_type ?? "",
    super_structure_type: project.super_structure_type ?? "",
    city: project.city ?? "",
    state: project.state ?? "",
    country: project.country ?? "",
    site_address: project.site_address ?? "",
    client_name: project.client_name ?? "",
    architect: project.architect ?? "",
    project_manager: project.project_manager ?? "",
    site_incharge: project.site_incharge ?? "",
    project_type_id: project.project_type_options
      ? String(project.project_type_options.id)
      : "",
  };
}

export function EditProjectDialog({
  isOpen,
  project,
  onClose,
  onProjectUpdated,
}: EditProjectDialogProps) {
  const [form, setForm] = useState<ProjectFormState>(() =>
    buildInitialFormState(project)
  );
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>([]);
  const [isLoadingProjectTypes, setIsLoadingProjectTypes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setForm(buildInitialFormState(project));
    setErrorMessage("");

    async function loadProjectTypes() {
      setIsLoadingProjectTypes(true);
      try {
        const options = await getProjectTypeOptions();
        setProjectTypes(options);

        if (options.length > 0) {
          setForm((prev) => ({
            ...prev,
            project_type_id:
              prev.project_type_id ||
              (project.project_type_options
                ? String(project.project_type_options.id)
                : String(options[0].id)),
          }));
        }
      } finally {
        setIsLoadingProjectTypes(false);
      }
    }

    loadProjectTypes();
  }, [isOpen, project]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  function updateField<K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.project_name.trim()) {
      setErrorMessage("Project Name is required.");
      return;
    }

    if (!form.project_type_id) {
      setErrorMessage("Project Type is required.");
      return;
    }

    const payload: CreateProjectInput = {
      project_name: form.project_name,
      project_type_id: Number(form.project_type_id),
      expected_start_date: form.expected_start_date || null,
      plot_area: parseNullableNumber(form.plot_area),
      project_footprint: parseNullableNumber(form.project_footprint),
      basement_count: parseNullableInteger(form.basement_count),
      stilt_count: parseNullableInteger(form.stilt_count),
      podium_count: parseNullableInteger(form.podium_count),
      floor_count: parseNullableInteger(form.floor_count),
      foundation_type: form.foundation_type || null,
      super_structure_type: form.super_structure_type || null,
      city: form.city,
      state: form.state,
      country: form.country,
      site_address: form.site_address,
      client_name: form.client_name,
      architect: form.architect,
      project_manager: form.project_manager,
      site_incharge: form.site_incharge,
    };

    setIsSubmitting(true);
    try {
      const updatedProject = await updateProject(project.id, payload);
      onProjectUpdated(updatedProject);
      onClose();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update project."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Edit Project</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Update the project details shown in the overview and setup fields.
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

        <form onSubmit={handleSubmit} className="space-y-8">
          <ProjectFormFields
            form={form}
            updateField={updateField}
            projectTypes={projectTypes}
            isLoadingProjectTypes={isLoadingProjectTypes}
            projectCodeValue={project.project_code}
          />

          {errorMessage ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSubmitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
