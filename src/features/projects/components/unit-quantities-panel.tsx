"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { createUnitQuantityEntry } from "@/features/projects/services/create-unit-quantity-entry";
import { deleteUnitQuantityEntry } from "@/features/projects/services/delete-unit-quantity-entry";
import {
  getUnitQuantityEntries,
} from "@/features/projects/services/get-unit-quantity-entries";
import {
  getUnitQuantityElements,
  type UnitQuantityElementOption,
} from "@/features/projects/services/get-unit-quantity-elements";
import { updateUnitQuantityEntry } from "@/features/projects/services/update-unit-quantity-entry";
import type { ProjectRecord } from "@/features/projects/types/project";
import type { UnitQuantityEntry } from "@/features/projects/types/unit-quantity";
import { formatDisplayDateTime } from "@/lib/date-format";

type EntryFormState = {
  selectedElementKey: string;
  floor: string;
  zone: string;
  formwork: string;
  formworkUnitCost: string;
  concrete: string;
  concreteUnitCost: string;
  reinforcement: string;
  reinforcementUnitCost: string;
  primer: string;
  primerUnitCost: string;
  puttyLayer1: string;
  puttyLayer1UnitCost: string;
  puttyLayer2: string;
  puttyLayer2UnitCost: string;
  paintLayer1: string;
  paintLayer1UnitCost: string;
  paintLayer2: string;
  paintLayer2UnitCost: string;
};

const initialFormState: EntryFormState = {
  selectedElementKey: "",
  floor: "",
  zone: "",
  formwork: "",
  formworkUnitCost: "",
  concrete: "",
  concreteUnitCost: "",
  reinforcement: "",
  reinforcementUnitCost: "",
  primer: "",
  primerUnitCost: "",
  puttyLayer1: "",
  puttyLayer1UnitCost: "",
  puttyLayer2: "",
  puttyLayer2UnitCost: "",
  paintLayer1: "",
  paintLayer1UnitCost: "",
  paintLayer2: "",
  paintLayer2UnitCost: "",
};

type QuantityFieldKey =
  | "formwork"
  | "formworkUnitCost"
  | "concrete"
  | "concreteUnitCost"
  | "reinforcement"
  | "reinforcementUnitCost"
  | "primer"
  | "primerUnitCost"
  | "puttyLayer1"
  | "puttyLayer1UnitCost"
  | "puttyLayer2"
  | "puttyLayer2UnitCost"
  | "paintLayer1"
  | "paintLayer1UnitCost"
  | "paintLayer2"
  | "paintLayer2UnitCost";

type UnitQuantityFormConfig = {
  detailsDescription: string;
  quantityDescription: string;
  fields: Array<{
    key: QuantityFieldKey;
    unitCostKey: QuantityFieldKey;
    label: string;
    unit: string;
  }>;
};

const structuralQuantityFields: UnitQuantityFormConfig["fields"] = [
  {
    key: "formwork",
    unitCostKey: "formworkUnitCost",
    label: "Formwork",
    unit: "sq.ft",
  },
  {
    key: "concrete",
    unitCostKey: "concreteUnitCost",
    label: "Concrete",
    unit: "cu.m",
  },
  {
    key: "reinforcement",
    unitCostKey: "reinforcementUnitCost",
    label: "Reinforcement",
    unit: "kg",
  },
];

const paintQuantityFields: UnitQuantityFormConfig["fields"] = [
  {
    key: "primer",
    unitCostKey: "primerUnitCost",
    label: "Primer",
    unit: "sq.ft",
  },
  {
    key: "puttyLayer1",
    unitCostKey: "puttyLayer1UnitCost",
    label: "Putty (Layer 1)",
    unit: "sq.ft",
  },
  {
    key: "puttyLayer2",
    unitCostKey: "puttyLayer2UnitCost",
    label: "Putty (Layer 2)",
    unit: "sq.ft",
  },
  {
    key: "paintLayer1",
    unitCostKey: "paintLayer1UnitCost",
    label: "Paint (Layer 1)",
    unit: "sq.ft",
  },
  {
    key: "paintLayer2",
    unitCostKey: "paintLayer2UnitCost",
    label: "Paint (Layer 2)",
    unit: "sq.ft",
  },
];

const unitQuantityFormConfigByCostCode: Record<string, UnitQuantityFormConfig> =
  {
    B1017: {
      detailsDescription:
        "This shared detail form applies to the currently supported structural elements.",
      quantityDescription:
        "Enter the tracked quantities for the selected structural element.",
      fields: structuralQuantityFields,
    },
    B1012: {
      detailsDescription:
        "This shared detail form applies to the currently supported structural elements.",
      quantityDescription:
        "Enter the tracked quantities for the selected structural element.",
      fields: structuralQuantityFields,
    },
    A1032: {
      detailsDescription:
        "This shared detail form applies to the currently supported structural elements.",
      quantityDescription:
        "Enter the tracked quantities for the selected structural element.",
      fields: structuralQuantityFields,
    },
    A1012: {
      detailsDescription:
        "This shared detail form applies to the currently supported structural elements.",
      quantityDescription:
        "Enter the tracked quantities for the selected structural element.",
      fields: structuralQuantityFields,
    },
    C2011: {
      detailsDescription:
        "This shared detail form applies to the currently supported structural elements.",
      quantityDescription:
        "Enter the tracked quantities for the selected structural element.",
      fields: structuralQuantityFields,
    },
    B2068: {
      detailsDescription:
        "Capture the floor and zone first, then enter the paint system coverage quantities.",
      quantityDescription:
        "Enter the tracked paint area quantities for the selected element.",
      fields: paintQuantityFields,
    },
    C3015: {
      detailsDescription:
        "Capture the floor and zone first, then enter the paint system coverage quantities.",
      quantityDescription:
        "Enter the tracked paint area quantities for the selected element.",
      fields: paintQuantityFields,
    },
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
  const [editingEntry, setEditingEntry] = useState<UnitQuantityEntry | null>(
    null
  );
  const [deleteEntryCandidate, setDeleteEntryCandidate] =
    useState<UnitQuantityEntry | null>(null);
  const [editRows, setEditRows] = useState<
    Array<{
      rowId: number;
      parameter: string;
      quantity: string;
      unitCost: number;
      unit: string;
    }>
  >([]);
  const [editErrorMessage, setEditErrorMessage] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  const refreshEntries = useCallback(async () => {
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
  }, [project.id]);

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
    refreshEntries();
  }, [refreshEntries]);

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
  const selectedFormConfig = selectedElement
    ? unitQuantityFormConfigByCostCode[selectedElement.cost_code]
    : null;

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

  function handleOpenEditModal(entry: UnitQuantityEntry) {
    setEditingEntry(entry);
    setEditRows(
      entry.quantities.map((quantityRow) => ({
        rowId: quantityRow.rowId,
        parameter: quantityRow.parameter,
        quantity: String(quantityRow.quantity),
        unitCost: quantityRow.unitCost,
        unit: quantityRow.unit,
      }))
    );
    setEditErrorMessage("");
  }

  function handleCloseEditModal() {
    setEditingEntry(null);
    setEditRows([]);
    setEditErrorMessage("");
  }

  function handleOpenDeleteModal(entry: UnitQuantityEntry) {
    setDeleteEntryCandidate(entry);
    setDeleteErrorMessage("");
  }

  function handleCloseDeleteModal() {
    setDeleteEntryCandidate(null);
    setDeleteErrorMessage("");
    setIsDeletingEntry(false);
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
      const quantities =
        selectedFormConfig?.fields.map((field) => ({
          parameter: field.label,
          quantity: Number(form[field.key]),
          unitCost: Number(form[field.unitCostKey]),
          unit: field.unit,
        })) ?? [];

      if (
        quantities.some(
          (quantityRow) =>
            !Number.isFinite(quantityRow.quantity) ||
            !Number.isFinite(quantityRow.unitCost)
        )
      ) {
        setErrorMessage("All quantity and unit cost values must be valid numbers.");
        setIsSubmitting(false);
        return;
      }

      await createUnitQuantityEntry({
        projectId: project.id,
        projectName: project.project_name,
        costCode: selectedElement.cost_code,
        item: selectedElement.item,
        floor: floorValue,
        zone: form.zone,
        createdByUserId,
        createdByUserName,
        quantities,
      });

      await refreshEntries();
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

  function updateEditRow(rowId: number, quantity: string) {
    setEditRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, quantity } : row))
    );
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedRows = editRows.map((row) => ({
      rowId: row.rowId,
      quantity: Number(row.quantity),
    }));

    if (parsedRows.some((row) => !Number.isFinite(row.quantity))) {
      setEditErrorMessage("All quantity values must be valid numbers.");
      return;
    }

    setIsSavingEdit(true);
    setEditErrorMessage("");

    try {
      await updateUnitQuantityEntry(parsedRows);
      await refreshEntries();
      handleCloseEditModal();
    } catch (error) {
      console.error(error);
      setEditErrorMessage(
        error instanceof Error ? error.message : "Failed to update entry."
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteEntry() {
    if (!deleteEntryCandidate) {
      return;
    }

    setIsDeletingEntry(true);
    setDeleteErrorMessage("");

    try {
      await deleteUnitQuantityEntry(
        deleteEntryCandidate.quantities.map((row) => row.rowId)
      );
      await refreshEntries();

      if (
        expandedEntry?.entryGroupId === deleteEntryCandidate.entryGroupId
      ) {
        setExpandedEntry(null);
      }

      if (
        editingEntry?.entryGroupId === deleteEntryCandidate.entryGroupId
      ) {
        handleCloseEditModal();
      }

      handleCloseDeleteModal();
    } catch (error) {
      console.error(error);
      setDeleteErrorMessage(
        error instanceof Error ? error.message : "Failed to delete entry."
      );
    } finally {
      setIsDeletingEntry(false);
    }
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by item"
              className="min-w-[240px]"
            />

            <button
              type="button"
              onClick={handleOpenModal}
              className="shrink-0 whitespace-nowrap rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
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
                    "Total Cost",
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
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {formatCurrencyInr(entry.totalCost)}
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
                          onClick={() => handleOpenEditModal(entry)}
                          aria-label={`Edit ${entry.element}`}
                          title="Edit entry"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                        >
                          <EditIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(entry)}
                          aria-label={`Delete ${entry.element}`}
                          title="Delete entry"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
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
                        {selectedFormConfig?.detailsDescription}
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
                        {selectedFormConfig?.quantityDescription}
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                          <thead className="bg-[var(--surface)]">
                            <tr>
                              {[
                                "Quantity Parameter",
                                "Quantity",
                                "Unit",
                                "Unit Cost",
                                "Cost Unit",
                              ].map(
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
                            {selectedFormConfig?.fields.map((field) => (
                              <QuantityInputRow
                                key={field.key}
                                label={field.label}
                                unit={field.unit}
                                value={form[field.key]}
                                unitCostValue={form[field.unitCostKey]}
                                onChange={(value) => updateField(field.key, value)}
                                onUnitCostChange={(value) =>
                                  updateField(field.unitCostKey, value)
                                }
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                      {[
                        "Quantity Parameter",
                        "Quantity",
                        "Unit",
                        "Unit Cost",
                        "Cost Unit",
                        "Line Total",
                      ].map(
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
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {formatCurrencyInr(quantityRow.unitCost)}
                        </td>
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {formatCostUnit(quantityRow.unit)}
                        </td>
                        <td className="px-4 py-4 text-[var(--muted)]">
                          {formatCurrencyInr(
                            quantityRow.quantity * quantityRow.unitCost
                          )}
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

      {editingEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
          onClick={handleCloseEditModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Edit Unit Quantity Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Update only the quantity values for this saved entry.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseEditModal}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoTile label="Element" value={editingEntry.element} />
              <InfoTile label="Cost Code" value={editingEntry.costCode} />
              <InfoTile label="Floor" value={editingEntry.floor} />
              <InfoTile label="Zone" value={editingEntry.zone} />
              <InfoTile
                label="Created At"
                value={formatCreatedAt(editingEntry.createdAt)}
              />
              <InfoTile label="Created By" value={editingEntry.createdBy} />
            </div>

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-6">
              <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        {[
                          "Quantity Parameter",
                          "Quantity",
                          "Unit",
                          "Unit Cost",
                          "Cost Unit",
                          "Line Total",
                        ].map(
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
                      {editRows.map((row) => (
                        <tr key={row.rowId}>
                          <td className="px-4 py-4 font-medium">
                            {row.parameter}
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.quantity}
                              onChange={(event) =>
                                updateEditRow(row.rowId, event.target.value)
                              }
                              className={inputClassName}
                            />
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {row.unit}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCurrencyInr(row.unitCost)}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCostUnit(row.unit)}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCurrencyInr(
                              Number(row.quantity || 0) * row.unitCost
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {editErrorMessage ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {editErrorMessage}
                </div>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  {isSavingEdit ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteEntryCandidate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
          onClick={handleCloseDeleteModal}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">
                  Delete Unit Quantity Entry
                </h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  This will permanently remove the saved quantity rows for this
                  entry from the database.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseDeleteModal}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InfoTile label="Element" value={deleteEntryCandidate.element} />
              <InfoTile
                label="Cost Code"
                value={deleteEntryCandidate.costCode}
              />
              <InfoTile label="Floor" value={deleteEntryCandidate.floor} />
              <InfoTile label="Zone" value={deleteEntryCandidate.zone} />
              <InfoTile
                label="Created At"
                value={formatCreatedAt(deleteEntryCandidate.createdAt)}
              />
              <InfoTile
                label="Created By"
                value={deleteEntryCandidate.createdBy}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-[var(--foreground)]">
              Deleting this entry will remove all of its saved quantity
              parameters and any grouped quantity rows under this entry.
            </div>

            {deleteErrorMessage ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {deleteErrorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseDeleteModal}
                disabled={isDeletingEntry}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteEntry}
                disabled={isDeletingEntry}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {isDeletingEntry ? "Deleting Entry..." : "Delete Entry"}
              </button>
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
  return formatDisplayDateTime(dateValue, dateValue);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatCurrencyInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCostUnit(unit: string) {
  return `INR/${unit}`;
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

type QuantityInputRowProps = {
  label: string;
  value: string;
  unitCostValue: string;
  unit: string;
  onChange: (value: string) => void;
  onUnitCostChange: (value: string) => void;
};

function QuantityInputRow({
  label,
  value,
  unitCostValue,
  unit,
  onChange,
  onUnitCostChange,
}: QuantityInputRowProps) {
  return (
    <tr>
      <td className="px-4 py-4 font-medium">{label}</td>
      <td className="px-4 py-4">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
          placeholder="0.00"
          required
        />
      </td>
      <td className="px-4 py-4 text-[var(--muted)]">{unit}</td>
      <td className="px-4 py-4">
        <input
          type="number"
          min="0"
          step="0.01"
          value={unitCostValue}
          onChange={(event) => onUnitCostChange(event.target.value)}
          className={inputClassName}
          placeholder="0.00"
          required
        />
      </td>
      <td className="px-4 py-4 text-[var(--muted)]">
        {formatCostUnit(unit)}
      </td>
    </tr>
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
