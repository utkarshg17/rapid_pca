"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  getUnitQuantityElements,
  type UnitQuantityElementOption,
} from "@/features/projects/services/get-unit-quantity-elements";

type UnitQuantityEntry = {
  id: string;
  costCode: string;
  item: string;
  floor: string;
  zone: string;
  formwork: string;
  concrete: string;
  reinforcement: string;
  createdAt: string;
};

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

export function UnitQuantitiesPanel() {
  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<UnitQuantityEntry[]>([]);
  const [elementOptions, setElementOptions] = useState<
    UnitQuantityElementOption[]
  >([]);
  const [isLoadingElements, setIsLoadingElements] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<EntryFormState>(initialFormState);

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

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return entries;
    }

    return entries.filter((entry) =>
      entry.item.toLowerCase().includes(normalizedSearch)
    );
  }, [entries, searchValue]);

  const selectedElement = elementOptions.find(
    (option) => `${option.cost_code}::${option.item}` === form.selectedElementKey
  );

  function handleOpenModal() {
    setForm(initialFormState);
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setForm(initialFormState);
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedElement) {
      return;
    }

    const nextEntry: UnitQuantityEntry = {
      id: `${Date.now()}`,
      costCode: selectedElement.cost_code,
      item: selectedElement.item,
      floor: form.floor,
      zone: form.zone,
      formwork: form.formwork,
      concrete: form.concrete,
      reinforcement: form.reinforcement,
      createdAt: new Date().toLocaleString(),
    };

    setEntries((prev) => [nextEntry, ...prev]);
    handleCloseModal();
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
        {filteredEntries.length === 0 ? (
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
                    "Formwork",
                    "Concrete",
                    "Reinforcement",
                    "Created",
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
                  <tr key={entry.id}>
                    <td className="px-4 py-4 font-medium">{entry.item}</td>
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
                      {entry.formwork} sq.ft
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.concrete} cu.m
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.reinforcement} kg
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.createdAt}
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
                          type="text"
                          value={form.floor}
                          onChange={(event) =>
                            updateField("floor", event.target.value)
                          }
                          className={inputClassName}
                          placeholder="Enter floor"
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

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!selectedElement}
                  className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  Save Entry
                </button>
              </div>
            </form>
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
