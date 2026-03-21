import type { ProjectTypeOption } from "@/features/projects/types/project";

export type ProjectFormState = {
  project_name: string;
  expected_start_date: string;
  plot_area: string;
  project_footprint: string;
  basement_count: string;
  stilt_count: string;
  podium_count: string;
  floor_count: string;
  foundation_type: string;
  super_structure_type: string;
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

type ProjectFormFieldsProps = {
  form: ProjectFormState;
  updateField: <K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K]
  ) => void;
  projectTypes: ProjectTypeOption[];
  isLoadingProjectTypes: boolean;
  projectCodeValue: string;
};

export const initialProjectFormState: ProjectFormState = {
  project_name: "",
  expected_start_date: "",
  plot_area: "",
  project_footprint: "",
  basement_count: "0",
  stilt_count: "0",
  podium_count: "0",
  floor_count: "1",
  foundation_type: "",
  super_structure_type: "",
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

const countOptions = ["0", "1", "2", "3", "4", "5"];
const floorOptions = Array.from({ length: 100 }, (_, index) => String(index + 1));
const foundationTypeOptions = ["Isolated Footing", "Raft", "Raft + Pile"];
const superStructureTypeOptions = [
  "RCC Moment Frame",
  "RCC Shear Wall",
  "Steel",
];

export function ProjectFormFields({
  form,
  updateField,
  projectTypes,
  isLoadingProjectTypes,
  projectCodeValue,
}: ProjectFormFieldsProps) {
  return (
    <>
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
              onChange={(event) => updateField("project_name", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter project name"
              required
            />
          </Field>

          <Field label="Project Code">
            <input
              type="text"
              value={projectCodeValue}
              readOnly
              className={`${projectFormInputClassName} cursor-not-allowed bg-[var(--input-readonly)] text-[var(--muted)]`}
            />
          </Field>

          <Field label="Project Type" required>
            <select
              value={form.project_type_id}
              onChange={(event) => updateField("project_type_id", event.target.value)}
              className={projectFormInputClassName}
              disabled={isLoadingProjectTypes}
              required
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
              onChange={(event) =>
                updateField("expected_start_date", event.target.value)
              }
              className={projectFormInputClassName}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Project Specification</h3>
          <p className="text-sm text-[var(--subtle)]">
            Size and level configuration details for the project.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Plot Area" helper="sq.ft">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.plot_area}
              onChange={(event) => updateField("plot_area", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter plot area"
            />
          </Field>

          <Field label="Project Footprint" helper="sq.ft">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.project_footprint}
              onChange={(event) =>
                updateField("project_footprint", event.target.value)
              }
              className={projectFormInputClassName}
              placeholder="Enter project footprint"
            />
          </Field>

          <Field label="Basements">
            <select
              value={form.basement_count}
              onChange={(event) => updateField("basement_count", event.target.value)}
              className={projectFormInputClassName}
            >
              {countOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "0" ? "None" : option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Stilt">
            <select
              value={form.stilt_count}
              onChange={(event) => updateField("stilt_count", event.target.value)}
              className={projectFormInputClassName}
            >
              {countOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "0" ? "None" : option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Podium">
            <select
              value={form.podium_count}
              onChange={(event) => updateField("podium_count", event.target.value)}
              className={projectFormInputClassName}
            >
              {countOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "0" ? "None" : option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Floors">
            <select
              value={form.floor_count}
              onChange={(event) => updateField("floor_count", event.target.value)}
              className={projectFormInputClassName}
            >
              {floorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Structural Details</h3>
          <p className="text-sm text-[var(--subtle)]">
            Core structural system information for the project.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Foundation Type">
            <select
              value={form.foundation_type}
              onChange={(event) =>
                updateField("foundation_type", event.target.value)
              }
              className={projectFormInputClassName}
            >
              <option value="">Select foundation type</option>
              {foundationTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Super-structure Type">
            <select
              value={form.super_structure_type}
              onChange={(event) =>
                updateField("super_structure_type", event.target.value)
              }
              className={projectFormInputClassName}
            >
              <option value="">Select super-structure type</option>
              {superStructureTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
              onChange={(event) => updateField("city", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter city"
            />
          </Field>

          <Field label="State">
            <input
              type="text"
              value={form.state}
              onChange={(event) => updateField("state", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter state"
            />
          </Field>

          <Field label="Country">
            <input
              type="text"
              value={form.country}
              onChange={(event) => updateField("country", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter country"
            />
          </Field>

          <Field label="Site Address">
            <input
              type="text"
              value={form.site_address}
              onChange={(event) => updateField("site_address", event.target.value)}
              className={projectFormInputClassName}
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
              onChange={(event) => updateField("client_name", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter client name"
            />
          </Field>

          <Field label="Architect">
            <input
              type="text"
              value={form.architect}
              onChange={(event) => updateField("architect", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter architect"
            />
          </Field>

          <Field label="Project Manager">
            <input
              type="text"
              value={form.project_manager}
              onChange={(event) => updateField("project_manager", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter project manager"
            />
          </Field>

          <Field label="Site In-Charge">
            <input
              type="text"
              value={form.site_incharge}
              onChange={(event) => updateField("site_incharge", event.target.value)}
              className={projectFormInputClassName}
              placeholder="Enter site in-charge"
            />
          </Field>
        </div>
      </section>
    </>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  helper?: string;
};

function Field({ label, children, required = false, helper }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-medium text-[var(--muted)]">
        <span>
          {label}
          {required ? <span className="ml-1 text-red-300">*</span> : null}
        </span>
        {helper ? (
          <span className="text-xs text-[var(--subtle)]">{helper}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export const projectFormInputClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";
