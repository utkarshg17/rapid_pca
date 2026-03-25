"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { createLabourSheetEntry } from "@/features/projects/services/create-labour-sheet-entry";
import { deleteLabourSheetEntry } from "@/features/projects/services/delete-labour-sheet-entry";
import { getCrewOptions } from "@/features/projects/services/get-crew-options";
import { getLabourItemOptions } from "@/features/projects/services/get-labour-item-options";
import { getLabourSheetEntries } from "@/features/projects/services/get-labour-sheet-entries";
import { updateLabourSheetEntry } from "@/features/projects/services/update-labour-sheet-entry";
import type { ProjectRecord } from "@/features/projects/types/project";
import type {
  CrewOption,
  LabourItemOption,
  LabourSheetEntry,
} from "@/features/projects/types/labour-sheet";

type LabourSheetPanelProps = {
  project: ProjectRecord;
  currentUser: UserProfile | null;
};

type LabourSheetDraftRow = {
  id: number;
  crewRole: string;
  crewCode: string;
  crewName: string;
  item: string;
  costCode: string;
  floor: string;
  zone: string;
  description: string;
};

const defaultRowCount = 10;

function createEmptyDraftRow(): LabourSheetDraftRow {
  const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  return {
    id: uniqueId,
    crewRole: "",
    crewCode: "",
    crewName: "",
    item: "",
    costCode: "",
    floor: "",
    zone: "",
    description: "",
  };
}

function createDefaultDraftRows() {
  return Array.from({ length: defaultRowCount }, () => createEmptyDraftRow());
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function LabourSheetPanel({
  project,
  currentUser,
}: LabourSheetPanelProps) {
  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<LabourSheetEntry[]>([]);
  const [crewOptions, setCrewOptions] = useState<CrewOption[]>([]);
  const [itemOptions, setItemOptions] = useState<LabourItemOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [labourDate, setLabourDate] = useState(getTodayDateValue());
  const [draftRows, setDraftRows] = useState<LabourSheetDraftRow[]>(
    createDefaultDraftRows()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [optionsErrorMessage, setOptionsErrorMessage] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<LabourSheetEntry | null>(
    null
  );
  const [editingEntry, setEditingEntry] = useState<LabourSheetEntry | null>(null);
  const [editRows, setEditRows] = useState<LabourSheetDraftRow[]>([]);
  const [editErrorMessage, setEditErrorMessage] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteEntryCandidate, setDeleteEntryCandidate] =
    useState<LabourSheetEntry | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);

  const refreshEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const labourSheetEntries = await getLabourSheetEntries(project.id);
      setEntries(labourSheetEntries);
    } catch (error) {
      console.error("Failed to load labour sheet entries:", error);
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [project.id]);

  useEffect(() => {
    async function loadOptions() {
      setIsLoadingOptions(true);
      try {
        const [crewRows, itemRows] = await Promise.all([
          getCrewOptions(),
          getLabourItemOptions(),
        ]);
        setCrewOptions(crewRows);
        setItemOptions(itemRows);
        setOptionsErrorMessage(
          itemRows.length === 0
            ? "No cost code items could be loaded. This usually means cost_code_database is empty or not readable under RLS."
            : ""
        );
      } catch (error) {
        console.error("Failed to load labour sheet options:", error);
        setCrewOptions([]);
        setItemOptions([]);
        setOptionsErrorMessage(
          "Labour Sheet options could not be loaded. Please check Supabase read access for crew_database and cost_code_database."
        );
      } finally {
        setIsLoadingOptions(false);
      }
    }

    loadOptions();
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
      [
        entry.createdBy,
        ...entry.rows.flatMap((row) => [
          row.crewRole,
          row.crewCode,
          row.crewName,
          row.item,
          row.costCode,
          row.zone,
          row.description,
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [entries, searchValue]);

  function handleOpenModal() {
    setLabourDate(getTodayDateValue());
    setDraftRows(createDefaultDraftRows());
    setErrorMessage("");
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setLabourDate(getTodayDateValue());
    setDraftRows(createDefaultDraftRows());
    setErrorMessage("");
    setIsModalOpen(false);
  }

  function handleOpenEditModal(entry: LabourSheetEntry) {
    setEditingEntry(entry);
    setEditRows(
      entry.rows.map((row) => ({
        id: row.rowId,
        crewRole: row.crewRole,
        crewCode: row.crewCode,
        crewName: row.crewName,
        item: row.item,
        costCode: row.costCode,
        floor: row.floor,
        zone: row.zone,
        description: row.description,
      }))
    );
    setEditErrorMessage("");
  }

  function handleCloseEditModal() {
    setEditingEntry(null);
    setEditRows([]);
    setEditErrorMessage("");
  }

  function handleOpenDeleteModal(entry: LabourSheetEntry) {
    setDeleteEntryCandidate(entry);
    setDeleteErrorMessage("");
  }

  function handleCloseDeleteModal() {
    setDeleteEntryCandidate(null);
    setDeleteErrorMessage("");
    setIsDeletingEntry(false);
  }

  function updateDraftRow(
    rowId: number,
    updater: (row: LabourSheetDraftRow) => LabourSheetDraftRow
  ) {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === rowId ? updater(row) : row))
    );
  }

  function handleCrewRoleChange(rowId: number, crewRole: string) {
    const selectedCrew = crewOptions.find(
      (option) => option.crew_role_name === crewRole
    );

    updateDraftRow(rowId, (row) => ({
      ...row,
      crewRole,
      crewCode: selectedCrew?.crew_code ?? "",
    }));
  }

  function handleItemChange(rowId: number, item: string) {
    const selectedItem = itemOptions.find((option) => option.item === item);

    updateDraftRow(rowId, (row) => ({
      ...row,
      item,
      costCode: selectedItem?.cost_code ?? "",
    }));
  }

  function handleFieldChange(
    rowId: number,
    key:
      | "crewName"
      | "floor"
      | "zone"
      | "description",
    value: string
  ) {
    updateDraftRow(rowId, (row) => ({
      ...row,
      [key]: value,
    }));
  }

  function handleAddRow() {
    setDraftRows((prev) => [...prev, createEmptyDraftRow()]);
  }

  function handleEditCrewRoleChange(rowId: number, crewRole: string) {
    const selectedCrew = crewOptions.find(
      (option) => option.crew_role_name === crewRole
    );

    setEditRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              crewRole,
              crewCode: selectedCrew?.crew_code ?? "",
            }
          : row
      )
    );
  }

  function handleEditItemChange(rowId: number, item: string) {
    const selectedItem = itemOptions.find((option) => option.item === item);

    setEditRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              item,
              costCode: selectedItem?.cost_code ?? "",
            }
          : row
      )
    );
  }

  function handleEditFieldChange(
    rowId: number,
    key:
      | "crewName"
      | "floor"
      | "zone"
      | "description",
    value: string
  ) {
    setEditRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [key]: value,
            }
          : row
      )
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser?.id) {
      setErrorMessage("You must be logged in to save labour sheet entries.");
      return;
    }

    const createdByUserId = Number(currentUser.id);

    if (!Number.isFinite(createdByUserId)) {
      setErrorMessage("The current user id is not in a numeric format.");
      return;
    }

    const createdByUserName =
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
      currentUser.email_id ||
      "Unknown User";

    const activeRows = draftRows.filter((row) => !isDraftRowEmpty(row));

    if (activeRows.length === 0) {
      setErrorMessage("Add at least one labour row before saving.");
      return;
    }

    for (const [index, row] of activeRows.entries()) {
      const hasMissingFields =
        !row.crewRole ||
        !row.crewCode ||
        !row.crewName.trim() ||
        !row.item ||
        !row.costCode ||
        !row.floor.trim() ||
        !row.zone.trim() ||
        !row.description.trim();

      if (hasMissingFields) {
        setErrorMessage(
          `Row ${index + 1} is incomplete. Please fill all required fields.`
        );
        return;
      }

      const floorValue = Number.parseInt(row.floor, 10);

      if (!Number.isFinite(floorValue)) {
        setErrorMessage(`Row ${index + 1} must have a valid whole-number floor.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await createLabourSheetEntry({
        projectId: project.id,
        labourDate,
        createdByUserId,
        createdByUserName,
        rows: activeRows.map((row) => ({
          crewRole: row.crewRole,
          crewCode: row.crewCode,
          crewName: row.crewName,
          item: row.item,
          costCode: row.costCode,
          floor: Number.parseInt(row.floor, 10),
          zone: row.zone,
          description: row.description,
        })),
      });

      await refreshEntries();
      handleCloseModal();
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save labour sheet."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEntry) {
      return;
    }

    for (const [index, row] of editRows.entries()) {
      const hasMissingFields =
        !row.crewRole ||
        !row.crewCode ||
        !row.crewName.trim() ||
        !row.item ||
        !row.costCode ||
        !row.floor.trim() ||
        !row.zone.trim() ||
        !row.description.trim();

      if (hasMissingFields) {
        setEditErrorMessage(
          `Row ${index + 1} is incomplete. Please fill all required fields.`
        );
        return;
      }

      const floorValue = Number.parseInt(row.floor, 10);

      if (!Number.isFinite(floorValue)) {
        setEditErrorMessage(`Row ${index + 1} must have a valid whole-number floor.`);
        return;
      }
    }

    setIsSavingEdit(true);
    setEditErrorMessage("");

    try {
      await updateLabourSheetEntry(
        editRows.map((row) => ({
          rowId: row.id,
          crewRole: row.crewRole,
          crewCode: row.crewCode,
          crewName: row.crewName,
          item: row.item,
          costCode: row.costCode,
          floor: Number.parseInt(row.floor, 10),
          zone: row.zone,
          description: row.description,
        }))
      );

      await refreshEntries();
      handleCloseEditModal();
    } catch (error) {
      console.error(error);
      setEditErrorMessage(
        error instanceof Error ? error.message : "Failed to update labour sheet."
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
      await deleteLabourSheetEntry(
        deleteEntryCandidate.rows.map((row) => row.rowId)
      );
      await refreshEntries();

      if (expandedEntry?.entryGroupId === deleteEntryCandidate.entryGroupId) {
        setExpandedEntry(null);
      }

      if (editingEntry?.entryGroupId === deleteEntryCandidate.entryGroupId) {
        handleCloseEditModal();
      }

      handleCloseDeleteModal();
    } catch (error) {
      console.error(error);
      setDeleteErrorMessage(
        error instanceof Error ? error.message : "Failed to delete labour sheet entry."
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
              Labour Sheet
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Labour Entries</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Track deployed crew against cost code items and keep a searchable
              attendance record for this project.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
            <Input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search by crew, item, or description"
              className="min-w-[280px]"
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

      {optionsErrorMessage ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {optionsErrorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] shadow-[var(--shadow-md)]">
        {isLoadingEntries ? (
          <div className="p-10 text-center text-sm text-[var(--muted)]">
            Loading labour sheet...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="text-lg font-semibold">No labour entries yet</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add your first labour sheet entry to start tracking daily crew
              deployment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {["Labour Date", "Created By", "Actions"].map((heading) => (
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
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {formatDate(entry.labourDate)}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted)]">
                      {entry.createdBy}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedEntry(entry)}
                          aria-label={`Expand labour entry for ${entry.createdBy}`}
                          title="Expand entry"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                        >
                          <ExpandIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(entry)}
                          aria-label={`Edit labour entry for ${entry.createdBy}`}
                          title="Edit entry"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                        >
                          <EditIcon />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(entry)}
                          aria-label={`Delete labour entry for ${entry.createdBy}`}
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
            className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-semibold">Add Labour Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Add daily crew deployment rows for this project. Ten rows are
                  ready by default, and you can add more as needed.
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

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <Field label="Labour Date" required>
                  <input
                    type="date"
                    value={labourDate}
                    onChange={(event) => setLabourDate(event.target.value)}
                    className={inputClassName}
                    required
                  />
                </Field>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="shrink-0 whitespace-nowrap rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                >
                  Add Row
                </button>
              </div>

              <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
                <div className="overflow-x-auto">
                  <table className="min-w-[1500px] border-collapse text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        {[
                          "Crew Role",
                          "Crew Code",
                          "Crew Name",
                          "Item",
                          "Cost Code",
                          "Floor",
                          "Zone",
                          "Description",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="border border-[var(--border)] px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[var(--border)]">
                      {draftRows.map((row) => (
                        <tr key={row.id}>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <select
                              value={row.crewRole}
                              onChange={(event) =>
                                handleCrewRoleChange(row.id, event.target.value)
                              }
                              className={compactInputClassName}
                              disabled={isLoadingOptions}
                            >
                              <option value="">
                                {isLoadingOptions
                                  ? "Loading crew roles..."
                                  : "Select crew role"}
                              </option>
                              {crewOptions.map((option) => (
                                <option
                                  key={`${option.crew_role_name}-${option.crew_code}`}
                                  value={option.crew_role_name}
                                >
                                  {option.crew_role_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.crewCode}
                              readOnly
                              className={`${compactInputClassName} cursor-not-allowed opacity-80`}
                              placeholder="Auto-filled"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.crewName}
                              onChange={(event) =>
                                handleFieldChange(
                                  row.id,
                                  "crewName",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                              placeholder="Enter crew name"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <select
                              value={row.item}
                              onChange={(event) =>
                                handleItemChange(row.id, event.target.value)
                              }
                              className={compactInputClassName}
                              disabled={isLoadingOptions}
                            >
                              <option value="">
                                {isLoadingOptions
                                  ? "Loading items..."
                                  : "Select item"}
                              </option>
                              {itemOptions.map((option) => (
                                <option
                                  key={`${option.item}-${option.cost_code}`}
                                  value={option.item}
                                >
                                  {option.item}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.costCode}
                              readOnly
                              className={`${compactInputClassName} cursor-not-allowed opacity-80`}
                              placeholder="Auto-filled"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.floor}
                              onChange={(event) =>
                                handleFieldChange(
                                  row.id,
                                  "floor",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                              placeholder="Floor"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.zone}
                              onChange={(event) =>
                                handleFieldChange(
                                  row.id,
                                  "zone",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                              placeholder="Zone"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(event) =>
                                handleFieldChange(
                                  row.id,
                                  "description",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                              placeholder="Describe the work in more detail"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

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
                  {isSubmitting ? "Saving Entries..." : "Save Entries"}
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
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Labour Sheet Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Review the saved labour deployment rows for this entry.
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

            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile label="Labour Date" value={formatDate(expandedEntry.labourDate)} />
              <InfoTile label="Created At" value={formatCreatedAt(expandedEntry.createdAt)} />
              <InfoTile label="Created By" value={expandedEntry.createdBy} />
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                  <thead className="bg-[var(--surface)]">
                    <tr>
                      {[
                        "Crew Role",
                        "Crew Code",
                        "Crew Name",
                        "Item",
                        "Cost Code",
                        "Floor",
                        "Zone",
                        "Description",
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
                    {expandedEntry.rows.map((row) => (
                      <tr key={row.rowId}>
                        <td className="px-4 py-4 font-medium">{row.crewRole}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.crewCode}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.crewName}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.item}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.costCode}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.floor}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.zone}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{row.description}</td>
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
            className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold">Edit Labour Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Update the saved labour deployment rows for this entry.
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

            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile label="Labour Date" value={formatDate(editingEntry.labourDate)} />
              <InfoTile label="Created At" value={formatCreatedAt(editingEntry.createdAt)} />
              <InfoTile label="Created By" value={editingEntry.createdBy} />
            </div>

            <form onSubmit={handleSaveEdit} className="mt-6 space-y-6">
              <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
                <div className="overflow-x-auto">
                  <table className="min-w-[1500px] border-collapse text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        {[
                          "Crew Role",
                          "Crew Code",
                          "Crew Name",
                          "Item",
                          "Cost Code",
                          "Floor",
                          "Zone",
                          "Description",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="border border-[var(--border)] px-2 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[var(--border)]">
                      {editRows.map((row) => (
                        <tr key={row.id}>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <select
                              value={row.crewRole}
                              onChange={(event) =>
                                handleEditCrewRoleChange(row.id, event.target.value)
                              }
                              className={compactInputClassName}
                              disabled={isLoadingOptions}
                            >
                              <option value="">
                                {isLoadingOptions
                                  ? "Loading crew roles..."
                                  : "Select crew role"}
                              </option>
                              {crewOptions.map((option) => (
                                <option
                                  key={`${option.crew_role_name}-${option.crew_code}`}
                                  value={option.crew_role_name}
                                >
                                  {option.crew_role_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.crewCode}
                              readOnly
                              className={`${compactInputClassName} cursor-not-allowed opacity-80`}
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.crewName}
                              onChange={(event) =>
                                handleEditFieldChange(
                                  row.id,
                                  "crewName",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <select
                              value={row.item}
                              onChange={(event) =>
                                handleEditItemChange(row.id, event.target.value)
                              }
                              className={compactInputClassName}
                              disabled={isLoadingOptions}
                            >
                              <option value="">
                                {isLoadingOptions
                                  ? "Loading items..."
                                  : "Select item"}
                              </option>
                              {itemOptions.map((option) => (
                                <option
                                  key={`${option.item}-${option.cost_code}`}
                                  value={option.item}
                                >
                                  {option.item}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.costCode}
                              readOnly
                              className={`${compactInputClassName} cursor-not-allowed opacity-80`}
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={row.floor}
                              onChange={(event) =>
                                handleEditFieldChange(
                                  row.id,
                                  "floor",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.zone}
                              onChange={(event) =>
                                handleEditFieldChange(
                                  row.id,
                                  "zone",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1 align-top">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(event) =>
                                handleEditFieldChange(
                                  row.id,
                                  "description",
                                  event.target.value
                                )
                              }
                              className={compactInputClassName}
                            />
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
                <h3 className="text-2xl font-semibold">Delete Labour Entry</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  This will permanently remove all labour rows saved under this entry.
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

            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile label="Labour Date" value={formatDate(deleteEntryCandidate.labourDate)} />
              <InfoTile label="Created At" value={formatCreatedAt(deleteEntryCandidate.createdAt)} />
              <InfoTile label="Created By" value={deleteEntryCandidate.createdBy} />
            </div>

            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-[var(--foreground)]">
              Deleting this entry will remove every labour row grouped under this saved submission.
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

function isDraftRowEmpty(row: LabourSheetDraftRow) {
  return (
    !row.crewRole &&
    !row.crewCode &&
    !row.crewName.trim() &&
    !row.item &&
    !row.costCode &&
    !row.floor.trim() &&
    !row.zone.trim() &&
    !row.description.trim()
  );
}

const inputClassName =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";

const compactInputClassName =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";

function formatCreatedAt(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString();
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
