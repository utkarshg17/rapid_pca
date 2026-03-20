"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { createProject } from "@/features/projects/services/create-project";
import { getProjectTypeOptions } from "@/features/projects/services/get-project-type-options";
import type {
  CreateProjectInput,
  ProjectTypeOption,
} from "@/features/projects/types/project";

type AddProjectDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => Promise<void> | void;
  profile: UserProfile;
};

type FormState = {
  project_name: string;
  expected_start_date: string;
  city: string;
  state: string;
  country: string;
  site_address: string;
  client_name: string;
  architect: string;
  project_manager: string;
  site_incharge: string;
  project_type_id: string;
};

const initialFormState: FormState = {
  project_name: "",
  expected_start_date: "",
  city: "",
  state: "",
  country: "",
  site_address: "",
  client_name: "",
  architect: "",
  project_manager: "",
  site_incharge: "",
  project_type_id: "",
};

function getPreviewProjectCode(dateString: string) {
  const year = dateString
    ? new Date(dateString).getFullYear()
    : new Date().getFullYear();

  return `P${year}001`;
}

export function AddProjectDialog({
  isOpen,
  onClose,
  onProjectCreated,
  profile,
}: AddProjectDialogProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeOption[]>([]);
  const [isLoadingProjectTypes, setIsLoadingProjectTypes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const projectCodePreview = useMemo(
    () => getPreviewProjectCode(form.expected_start_date),
    [form.expected_start_date]
  );

  useEffect(() => {
    if (!isOpen) return;

    async function loadProjectTypes() {
      setIsLoadingProjectTypes(true);
      try {
        const options = await getProjectTypeOptions();
        setProjectTypes(options);

        if (options.length > 0) {
          setForm((prev) => ({
            ...prev,
            project_type_id: prev.project_type_id || String(options[0].id),
          }));
        }
      } finally {
        setIsLoadingProjectTypes(false);
      }
    }

    loadProjectTypes();
  }, [isOpen]);

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

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetDialog() {
    setForm(initialFormState);
    setErrorMessage("");
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
      await createProject(payload, profile);
      await onProjectCreated();
      resetDialog();
      onClose();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to add project."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (isSubmitting) return;
    resetDialog();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={handleClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Add New Project</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Create a new project and make it available in the Projects tab.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Project Identity</h3>
              <p className="text-sm text-[var(--subtle)]">
                Basic identifying information for the project.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Project Name" required>
                <input
                  type="text"
                  value={form.project_name}
                  onChange={(e) => updateField("project_name", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter project name"
                />
              </Field>

              <Field label="Project Code">
                <input
                  type="text"
                  value={projectCodePreview}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed bg-[var(--input-readonly)] text-[var(--muted)]`}
                />
              </Field>

              <Field label="Project Type" required>
                <select
                  value={form.project_type_id}
                  onChange={(e) => updateField("project_type_id", e.target.value)}
                  className={inputClassName}
                  disabled={isLoadingProjectTypes}
                >
                  {projectTypes.length === 0 ? (
                    <option value="">
                      {isLoadingProjectTypes
                        ? "Loading project types..."
                        : "No project types found"}
                    </option>
                  ) : (
                    projectTypes.map((option) => (
                      <option key={option.id} value={String(option.id)}>
                        {option.type_name}
                      </option>
                    ))
                  )}
                </select>
              </Field>

              <Field label="Expected Start Date">
                <input
                  type="date"
                  value={form.expected_start_date}
                  onChange={(e) =>
                    updateField("expected_start_date", e.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Project Location</h3>
              <p className="text-sm text-[var(--subtle)]">
                Where the project is located.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="City">
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter city"
                />
              </Field>

              <Field label="State">
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter state"
                />
              </Field>

              <Field label="Country">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter country"
                />
              </Field>

              <Field label="Site Address">
                <input
                  type="text"
                  value={form.site_address}
                  onChange={(e) => updateField("site_address", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter site address"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Stakeholders</h3>
              <p className="text-sm text-[var(--subtle)]">
                Core project stakeholders and team members.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client Name">
                <input
                  type="text"
                  value={form.client_name}
                  onChange={(e) => updateField("client_name", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter client name"
                />
              </Field>

              <Field label="Architect">
                <input
                  type="text"
                  value={form.architect}
                  onChange={(e) => updateField("architect", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter architect"
                />
              </Field>

              <Field label="Project Manager">
                <input
                  type="text"
                  value={form.project_manager}
                  onChange={(e) =>
                    updateField("project_manager", e.target.value)
                  }
                  className={inputClassName}
                  placeholder="Enter project manager"
                />
              </Field>

              <Field label="Site In-Charge">
                <input
                  type="text"
                  value={form.site_incharge}
                  onChange={(e) => updateField("site_incharge", e.target.value)}
                  className={inputClassName}
                  placeholder="Enter site in-charge"
                />
              </Field>
            </div>
          </section>

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
              {isSubmitting ? "Adding Project..." : "Add Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";

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
