"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { createUnitQuantityEntry } from "@/features/projects/services/create-unit-quantity-entry";
import {
  getUnitQuantityEntries,
} from "@/features/projects/services/get-unit-quantity-entries";
import {
  getUnitQuantityElements,
  type UnitQuantityElementOption,
} from "@/features/projects/services/get-unit-quantity-elements";
import type { ProjectRecord } from "@/features/projects/types/project";
import type { UnitQuantityEntry } from "@/features/projects/types/unit-quantity";

type EntryFormState = {
  selectedElementKey: string;
  floor: string;
  zone: string;
  formwork: string;
  concrete: string;
  reinforcement: string;
};

const initialFormState: EntryFormState = {
  selectedElementKey: "",
  floor: "",
  zone: "",
  formwork: "",
  concrete: "",
  reinforcement: "",
};

type UnitQuantitiesPanelProps = {
  project: ProjectRecord;
  currentUser: UserProfile | null;
};

export function UnitQuantitiesPanel({
  project,
  currentUser,
}: UnitQuantitiesPanelProps) {
  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<UnitQuantityEntry[]>([]);
  const [elementOptions, setElementOptions] = useState<
    UnitQuantityElementOption[]
  >([]);
  const [isLoadingElements, setIsLoadingElements] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<UnitQuantityEntry | null>(
    null
  );

  useEffect(() => {
    async function loadElementOptions() {
      setIsLoadingElements(true);
      try {
        const options = await getUnitQuantityElements();
        setElementOptions(options);
      } catch (error) {
        console.error("Failed to load unit quantity elements:", error);
        setElementOptions([]);
      } finally {
        setIsLoadingElements(false);
      }
    }

    loadElementOptions();
  }, []);

  useEffect(() => {
    async function loadEntries() {
      setIsLoadingEntries(true);
      try {
        const unitQuantityEntries = await getUnitQuantityEntries(project.id);
        setEntries(unitQuantityEntries);
      } catch (error) {
        console.error("Failed to load unit quantity entries:", error);
        setEntries([]);
      } finally {
        setIsLoadingEntries(false);
      }
    }

    loadEntries();
  }, [project.id]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return entries;
    }

    return entries.filter((entry) =>
      entry.element.toLowerCase().includes(normalizedSearch)
    );
  }, [entries, searchValue]);

  const selectedElement = elementOptions.find(
    (option) => `${option.cost_code}::${option.item}` === form.selectedElementKey
  );

  function handleOpenModal() {
    setForm(initialFormState);
    setErrorMessage("");
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setForm(initialFormState);
    setErrorMessage("");
    setIsModalOpen(false);
  }

  function updateField<K extends keyof EntryFormState>(
    key: K,
    value: EntryFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedElement || !currentUser?.id) {
      setErrorMessage("You must be logged in to save a quantity entry.");
      return;
    }

    const createdByUserId = Number(currentUser.id);
    const floorValue = Number.parseInt(form.floor, 10);

    if (!Number.isFinite(createdByUserId)) {
      setErrorMessage("The current user id is not in a numeric format.");
      return;
    }

    if (!Number.isFinite(floorValue)) {
      setErrorMessage("Floor must be entered as a whole number.");
      return;
    }

    const createdByUserName =
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
      currentUser.email_id ||
      "Unknown User";

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createUnitQuantityEntry({
        projectId: project.id,
        projectName: project.project_name,
        costCode: selectedElement.cost_code,
        item: selectedElement.item,
        floor: floorValue,
        zone: form.zone,
        createdByUserId,
        createdByUserName,
        quantities: [
          {
            parameter: "Formwork",
            quantity: Number(form.formwork),
            unit: "sq.ft",
          },
          {
            parameter: "Concrete",
            quantity: Number(form.concrete),
            unit: "cu.m",
          },
          {
            parameter: "Reinforcement",
            quantity: Number(form.reinforcement),
            unit: "kg",
          },
        ],
      });

      const refreshedEntries = await getUnitQuantityEntries(project.id);
      setEntries(refreshedEntries);
      handleCloseModal();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save entry."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Unit Quantities
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Quantity Entries</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Search existing quantity entries by item and add new ones from the
              supported cost code elements below.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by item"
              className="min-w-[240px]"
            />

            <button
              type="button"
              onClick={handleOpenModal}
              className="rounded-full border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-5 py-3 text-sm font-medium text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer"
            >
              Add New Entry
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] shadow-[var(--shadow-md)]">
        {isLoadingEntries ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            Loading entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-lg font-semibold">No entries yet</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add your first unit quantity entry to start tracking these
              quantities for the project.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {[
                    "Element",
                    "Cost Code",
                    "Floor",
                    "Zone",
                    "Created",
                    "Created By",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border)]">
                {filteredEntries.map((entry) => (
                  <tr key={entry.entryGroupId}>
                    <td className="px-4 py-4 font-medium">{entry.element}</td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.costCode}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.floor}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.zone}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {formatCreatedAt(entry.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.createdBy}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedEntry(entry)}
                          aria-label={`Expand ${entry.element}`}
                          title="Expand entry"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                        >
                          <ExpandIcon />
                        </button>

                        <button
                          type="button"
                          aria-label="Edit entry"
                          title="Edit entry coming next"
                          disabled
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] opacity-60"
                        >
                          <EditIcon />
                        </button>

                        <button
                          type="button"
                          aria-label="Delete entry"
                          title="Delete entry coming next"
                          disabled
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] opacity-60"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
          onClick={handleCloseModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Add New Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Set up a unit quantity entry for one of the supported cost
                  code elements.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <section className="space-y-4">
                <div>
                  <h4 className="text-lg font-semibold">Element</h4>
                  <p className="text-sm text-[var(--subtle)]">
                    Select the supported item you want to add quantities for.
                  </p>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
                    Element
                  </span>
                  <select
                    value={form.selectedElementKey}
                    onChange={(event) =>
                      updateField("selectedElementKey", event.target.value)
                    }
                    className={inputClassName}
                    disabled={isLoadingElements}
                    required
                  >
                    <option value="">
                      {isLoadingElements
                        ? "Loading elements..."
                        : "Select an element"}
                    </option>
                    {elementOptions.map((option) => (
                      <option
                        key={`${option.cost_code}-${option.item}`}
                        value={`${option.cost_code}::${option.item}`}
                      >
                        {option.item} ({option.cost_code})
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              {selectedElement ? (
                <>
                  <section className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold">Element Details</h4>
                      <p className="text-sm text-[var(--subtle)]">
                        This shared detail form applies to the currently
                        supported structural elements.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Floor" required>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={form.floor}
                          onChange={(event) =>
                            updateField("floor", event.target.value)
                          }
                          className={inputClassName}
                          placeholder="Enter floor number"
                          required
                        />
                      </Field>

                      <Field label="Zone" required>
                        <input
                          type="text"
                          value={form.zone}
                          onChange={(event) =>
                            updateField("zone", event.target.value)
                          }
                          className={inputClassName}
                          placeholder="Enter zone"
                          required
                        />
                      </Field>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold">Quantity</h4>
                      <p className="text-sm text-[var(--subtle)]">
                        Enter the tracked quantities for the selected element.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Formwork" required helper="sq.ft">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.formwork}
                          onChange={(event) =>
                            updateField("formwork", event.target.value)
                          }
                          className={inputClassName}
                          placeholder="0.00"
                          required
                        />
                      </Field>

                      <Field label="Concrete" required helper="cu.m">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.concrete}
                          onChange={(event) =>
                            updateField("concrete", event.target.value)
                          }
                          className={inputClassName}
                          placeholder="0.00"
                          required
                        />
                      </Field>

                      <Field label="Reinforcement" required helper="kg">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.reinforcement}
                          onChange={(event) =>
                            updateField("reinforcement", event.target.value)
                          }
                          className={inputClassName}
                          placeholder="0.00"
                          required
                        />
                      </Field>
                    </div>
                  </section>
                </>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!selectedElement || isSubmitting}
                  className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSubmitting ? "Saving Entry..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {expandedEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
          onClick={() => setExpandedEntry(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Unit Quantity Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Review the saved quantity details for this entry.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExpandedEntry(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoTile label="Element" value={expandedEntry.element} />
              <InfoTile label="Cost Code" value={expandedEntry.costCode} />
              <InfoTile label="Floor" value={expandedEntry.floor} />
              <InfoTile label="Zone" value={expandedEntry.zone} />
              <InfoTile
                label="Created At"
                value={formatCreatedAt(expandedEntry.createdAt)}
              />
              <InfoTile label="Created By" value={expandedEntry.createdBy} />
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                  <thead className="bg-[var(--surface)]">
                    <tr>
                      {["Quantity Parameter", "Quantity", "Unit"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]"
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--border)]">
                    {expandedEntry.quantities.map((quantityRow) => (
                      <tr
                        key={`${expandedEntry.entryGroupId}-${quantityRow.parameter}`}
                      >
                        <td className="px-4 py-4 font-medium">
                          {quantityRow.parameter}
                        </td>
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {formatQuantity(quantityRow.quantity)}
                        </td>
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {quantityRow.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
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
        {helper ? <span className="text-xs text-[var(--subtle)]">{helper}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";

function formatCreatedAt(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

function ExpandIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H5v4M15 5h4v4M19 15v4h-4M5 15v4h4" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 20 4.5-1 9-9a2.12 2.12 0 1 0-3-3l-9 9L4 20Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
    </svg>
  );
}
