"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { createProductionLogEntry } from "@/features/projects/services/create-production-log-entry";
import { createSubContractor } from "@/features/projects/services/create-sub-contractor";
import { deleteProductionLogEntry } from "@/features/projects/services/delete-production-log-entry";
import { deleteSubContractor } from "@/features/projects/services/delete-sub-contractor";
import { getLabourItemOptions } from "@/features/projects/services/get-labour-item-options";
import { getProductionLogEntries } from "@/features/projects/services/get-production-log-entries";
import { getSubContractors } from "@/features/projects/services/get-sub-contractors";
import { updateProductionLogEntry } from "@/features/projects/services/update-production-log-entry";
import { updateSubContractor } from "@/features/projects/services/update-sub-contractor";
import type { LabourItemOption } from "@/features/projects/types/labour-sheet";
import type { ProjectRecord } from "@/features/projects/types/project";
import type {
  ProductionLogEntry,
  SubContractorRecord,
} from "@/features/projects/types/production-log";

type ProductionLogPanelProps = {
  project: ProjectRecord;
  currentUser: UserProfile | null;
};

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
};

const tradeOptions = [
  "Exterior Paint",
  "Interior Paint",
  "Exterior Plaster",
  "Interior Plaster",
  "Brickwork",
  "Bar Binder",
  "Electrician",
  "Shuttering",
];

const rateUnitOptions = ["INR/sq.ft", "INR/cu.m", "INR/ton"];

const compactInputClassName =
  "h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";

export function ProductionLogPanel({
  project,
  currentUser,
}: ProductionLogPanelProps) {
  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<ProductionLogEntry[]>([]);
  const [subContractors, setSubContractors] = useState<SubContractorRecord[]>(
    []
  );
  const [itemOptions, setItemOptions] = useState<LabourItemOption[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isLoadingSubContractors, setIsLoadingSubContractors] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionLogEntry | null>(
    null
  );
  const [expandedEntry, setExpandedEntry] = useState<ProductionLogEntry | null>(
    null
  );
  const [entryRecordDate, setEntryRecordDate] = useState(getTodayDateValue());
  const [entrySubContractorId, setEntrySubContractorId] = useState("");
  const [entryItem, setEntryItem] = useState("");
  const [entryCostCode, setEntryCostCode] = useState("");
  const [entryManHours, setEntryManHours] = useState("");
  const [entryQuantity, setEntryQuantity] = useState("");
  const [entryErrorMessage, setEntryErrorMessage] = useState("");
  const [isSubContractorDialogOpen, setIsSubContractorDialogOpen] =
    useState(false);
  const [subContractorSearchValue, setSubContractorSearchValue] = useState("");
  const [newSubContractorName, setNewSubContractorName] = useState("");
  const [newSubContractorTrade, setNewSubContractorTrade] = useState(
    tradeOptions[0]
  );
  const [newSubContractorRate, setNewSubContractorRate] = useState("");
  const [newSubContractorUnit, setNewSubContractorUnit] = useState(
    rateUnitOptions[0]
  );
  const [subContractorErrorMessage, setSubContractorErrorMessage] =
    useState("");
  const [subContractorSuccessMessage, setSubContractorSuccessMessage] =
    useState("");
  const [isCreatingSubContractor, setIsCreatingSubContractor] =
    useState(false);
  const [editingSubContractor, setEditingSubContractor] =
    useState<SubContractorRecord | null>(null);
  const [editSubContractorName, setEditSubContractorName] = useState("");
  const [editSubContractorTrade, setEditSubContractorTrade] = useState(
    tradeOptions[0]
  );
  const [editSubContractorRate, setEditSubContractorRate] = useState("");
  const [editSubContractorUnit, setEditSubContractorUnit] = useState(
    rateUnitOptions[0]
  );
  const [editSubContractorErrorMessage, setEditSubContractorErrorMessage] =
    useState("");
  const [isSavingSubContractor, setIsSavingSubContractor] = useState(false);
  const [deleteSubContractorCandidate, setDeleteSubContractorCandidate] =
    useState<SubContractorRecord | null>(null);
  const [deleteSubContractorErrorMessage, setDeleteSubContractorErrorMessage] =
    useState("");
  const [isDeletingSubContractor, setIsDeletingSubContractor] =
    useState(false);

  const refreshEntries = useCallback(async () => {
    setIsLoadingEntries(true);

    try {
      const rows = await getProductionLogEntries(project.id);
      setEntries((prev) => reconcileSubContractors(rows, subContractors, prev));
    } catch (error) {
      console.error("Failed to load production log entries:", error);
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [project.id, subContractors]);

  const refreshSubContractors = useCallback(async () => {
    setIsLoadingSubContractors(true);

    try {
      const rows = await getSubContractors();
      setSubContractors(rows);
    } catch (error) {
      console.error("Failed to load sub-contractors:", error);
      setSubContractors([]);
    } finally {
      setIsLoadingSubContractors(false);
    }
  }, []);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    refreshSubContractors();
  }, [refreshSubContractors]);

  useEffect(() => {
    setEntries((prev) => reconcileSubContractors(prev, subContractors, prev));
  }, [subContractors]);

  useEffect(() => {
    let isMounted = true;

    async function loadItemOptions() {
      setIsLoadingItems(true);

      try {
        const rows = await getLabourItemOptions();

        if (!isMounted) {
          return;
        }

        const uniqueItems = new Map<string, LabourItemOption>();

        rows.forEach((row) => {
          if (!uniqueItems.has(row.item)) {
            uniqueItems.set(row.item, row);
          }
        });

        setItemOptions(Array.from(uniqueItems.values()));
      } catch (error) {
        console.error("Failed to load cost code items:", error);

        if (isMounted) {
          setItemOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingItems(false);
        }
      }
    }

    loadItemOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return entries;
    }

    return entries.filter((entry) =>
      [
        formatDate(entry.recordDate),
        toInputDate(entry.recordDate),
        entry.subContractorName,
        entry.item,
        entry.costCode,
        entry.trade,
        entry.unit,
        entry.createdBy,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [entries, searchValue]);

  const filteredSubContractors = useMemo(() => {
    const normalizedSearch = subContractorSearchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return subContractors;
    }

    return subContractors.filter((subContractor) =>
      [
        subContractor.sub_contractor_name,
        subContractor.trade,
        subContractor.unit,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [subContractorSearchValue, subContractors]);

  const selectedEntrySubContractor = useMemo(
    () => getSubContractorById(subContractors, entrySubContractorId),
    [entrySubContractorId, subContractors]
  );

  const selectedEntryItemOption = useMemo(
    () => itemOptions.find((option) => option.item === entryItem) ?? null,
    [entryItem, itemOptions]
  );

  function handleOpenEntryModal() {
    setEditingEntry(null);
    setEntryRecordDate(getTodayDateValue());
    setEntrySubContractorId("");
    setEntryItem("");
    setEntryCostCode("");
    setEntryManHours("");
    setEntryQuantity("");
    setEntryErrorMessage("");
    setIsEntryModalOpen(true);
  }

  function handleOpenEditEntryModal(entry: ProductionLogEntry) {
    setEditingEntry(entry);
    setEntryRecordDate(toInputDate(entry.recordDate));
    setEntrySubContractorId(
      entry.subContractorId === null ? "" : String(entry.subContractorId)
    );
    setEntryItem(entry.item);
    setEntryCostCode(entry.costCode);
    setEntryManHours(String(entry.manHours));
    setEntryQuantity(String(entry.quantity));
    setEntryErrorMessage("");
    setIsEntryModalOpen(true);
  }

  function handleOpenExpandedEntryDialog(entry: ProductionLogEntry) {
    setExpandedEntry(entry);
  }

  function handleCloseExpandedEntryDialog() {
    setExpandedEntry(null);
  }

  function handleCloseEntryModal() {
    setEditingEntry(null);
    setEntryRecordDate(getTodayDateValue());
    setEntrySubContractorId("");
    setEntryItem("");
    setEntryCostCode("");
    setEntryManHours("");
    setEntryQuantity("");
    setEntryErrorMessage("");
    setIsEntryModalOpen(false);
  }

  function handleEntryItemChange(value: string) {
    const normalizedValue = normalizeName(value).toLowerCase();
    const selectedItem =
      itemOptions.find(
        (option) =>
          normalizeName(option.item).toLowerCase() === normalizedValue
      ) ?? null;

    setEntryItem(value);
    setEntryCostCode(selectedItem?.cost_code ?? "");
  }

  async function handleDeleteEntry(entryId: number) {
    try {
      await deleteProductionLogEntry(entryId);
      await refreshEntries();
    } catch (error) {
      console.error(error);
    }
  }

  function handleOpenSubContractorDialog() {
    setSubContractorSearchValue("");
    setNewSubContractorName("");
    setNewSubContractorTrade(tradeOptions[0]);
    setNewSubContractorRate("");
    setNewSubContractorUnit(rateUnitOptions[0]);
    setSubContractorErrorMessage("");
    setSubContractorSuccessMessage("");
    setIsSubContractorDialogOpen(true);
  }

  function handleCloseSubContractorDialog() {
    setSubContractorSearchValue("");
    setNewSubContractorName("");
    setNewSubContractorTrade(tradeOptions[0]);
    setNewSubContractorRate("");
    setNewSubContractorUnit(rateUnitOptions[0]);
    setSubContractorErrorMessage("");
    setSubContractorSuccessMessage("");
    setIsSubContractorDialogOpen(false);
  }

  function handleOpenEditSubContractorModal(
    subContractor: SubContractorRecord
  ) {
    setEditingSubContractor(subContractor);
    setEditSubContractorName(subContractor.sub_contractor_name);
    setEditSubContractorTrade(subContractor.trade);
    setEditSubContractorRate(
      subContractor.rate === null ? "" : String(subContractor.rate)
    );
    setEditSubContractorUnit(subContractor.unit);
    setEditSubContractorErrorMessage("");
  }

  function handleCloseEditSubContractorModal() {
    setEditingSubContractor(null);
    setEditSubContractorName("");
    setEditSubContractorTrade(tradeOptions[0]);
    setEditSubContractorRate("");
    setEditSubContractorUnit(rateUnitOptions[0]);
    setEditSubContractorErrorMessage("");
    setIsSavingSubContractor(false);
  }

  function handleOpenDeleteSubContractorModal(
    subContractor: SubContractorRecord
  ) {
    setDeleteSubContractorCandidate(subContractor);
    setDeleteSubContractorErrorMessage("");
  }

  function handleCloseDeleteSubContractorModal() {
    setDeleteSubContractorCandidate(null);
    setDeleteSubContractorErrorMessage("");
    setIsDeletingSubContractor(false);
  }
  async function handleCreateSubContractor(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedName = normalizeName(newSubContractorName);
    const parsedRate = Number.parseFloat(newSubContractorRate);

    if (!normalizedName) {
      setSubContractorErrorMessage("Enter the sub-contractor name first.");
      setSubContractorSuccessMessage("");
      return;
    }

    if (!newSubContractorTrade) {
      setSubContractorErrorMessage("Select a trade first.");
      setSubContractorSuccessMessage("");
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setSubContractorErrorMessage("Enter a valid non-negative rate.");
      setSubContractorSuccessMessage("");
      return;
    }

    if (!newSubContractorUnit) {
      setSubContractorErrorMessage("Select a unit first.");
      setSubContractorSuccessMessage("");
      return;
    }

    const isDuplicate = subContractors.some(
      (subContractor) =>
        normalizeName(subContractor.sub_contractor_name).toLowerCase() ===
          normalizedName.toLowerCase() &&
        subContractor.trade === newSubContractorTrade
    );

    if (isDuplicate) {
      setSubContractorErrorMessage(
        "That sub-contractor already exists for this trade."
      );
      setSubContractorSuccessMessage("");
      return;
    }

    setIsCreatingSubContractor(true);
    setSubContractorErrorMessage("");
    setSubContractorSuccessMessage("");

    try {
      const createdSubContractor = await createSubContractor({
        name: normalizedName,
        trade: newSubContractorTrade,
        rate: parsedRate,
        unit: newSubContractorUnit,
      });

      setSubContractors((prev) =>
        [...prev, createdSubContractor].sort((left, right) =>
          left.sub_contractor_name.localeCompare(right.sub_contractor_name)
        )
      );
      setNewSubContractorName("");
      setNewSubContractorTrade(tradeOptions[0]);
      setNewSubContractorRate("");
      setNewSubContractorUnit(rateUnitOptions[0]);
      setSubContractorSearchValue(createdSubContractor.sub_contractor_name);
      setSubContractorSuccessMessage(
        `${createdSubContractor.sub_contractor_name} is now available in Production Log.`
      );
    } catch (error) {
      console.error(error);
      setSubContractorErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create sub-contractor."
      );
      setSubContractorSuccessMessage("");
    } finally {
      setIsCreatingSubContractor(false);
    }
  }

  async function handleSaveSubContractor(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingSubContractor) {
      return;
    }

    const normalizedName = normalizeName(editSubContractorName);
    const parsedRate = Number.parseFloat(editSubContractorRate);

    if (!normalizedName) {
      setEditSubContractorErrorMessage(
        "Enter the sub-contractor name first."
      );
      return;
    }

    if (!editSubContractorTrade) {
      setEditSubContractorErrorMessage("Select a trade first.");
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setEditSubContractorErrorMessage("Enter a valid non-negative rate.");
      return;
    }

    if (!editSubContractorUnit) {
      setEditSubContractorErrorMessage("Select a unit first.");
      return;
    }

    const isDuplicate = subContractors.some(
      (subContractor) =>
        subContractor.id !== editingSubContractor.id &&
        normalizeName(subContractor.sub_contractor_name).toLowerCase() ===
          normalizedName.toLowerCase() &&
        subContractor.trade === editSubContractorTrade
    );

    if (isDuplicate) {
      setEditSubContractorErrorMessage(
        "That sub-contractor already exists for this trade."
      );
      return;
    }

    setIsSavingSubContractor(true);
    setEditSubContractorErrorMessage("");

    try {
      const updatedSubContractor = await updateSubContractor({
        id: editingSubContractor.id,
        name: normalizedName,
        trade: editSubContractorTrade,
        rate: parsedRate,
        unit: editSubContractorUnit,
      });

      setSubContractors((prev) =>
        prev
          .map((subContractor) =>
            subContractor.id === updatedSubContractor.id
              ? updatedSubContractor
              : subContractor
          )
          .sort((left, right) =>
            left.sub_contractor_name.localeCompare(right.sub_contractor_name)
          )
      );

      handleCloseEditSubContractorModal();
    } catch (error) {
      console.error(error);
      setEditSubContractorErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update sub-contractor."
      );
    } finally {
      setIsSavingSubContractor(false);
    }
  }

  async function handleDeleteSubContractor() {
    if (!deleteSubContractorCandidate) {
      return;
    }

    setIsDeletingSubContractor(true);
    setDeleteSubContractorErrorMessage("");

    try {
      await deleteSubContractor(deleteSubContractorCandidate.id);

      setSubContractors((prev) =>
        prev.filter(
          (subContractor) => subContractor.id !== deleteSubContractorCandidate.id
        )
      );

      if (editingSubContractor?.id === deleteSubContractorCandidate.id) {
        handleCloseEditSubContractorModal();
      }

      handleCloseDeleteSubContractorModal();
    } catch (error) {
      console.error(error);
      setDeleteSubContractorErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete sub-contractor."
      );
    } finally {
      setIsDeletingSubContractor(false);
    }
  }

  async function handleSaveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedSubContractor = getSubContractorById(
      subContractors,
      entrySubContractorId
    );
    const selectedItem =
      itemOptions.find((option) => option.item === entryItem) ?? null;
    const parsedManHours = Number.parseFloat(entryManHours);
    const parsedQuantity = Number.parseFloat(entryQuantity);

    if (!entryRecordDate) {
      setEntryErrorMessage("Select a record date first.");
      return;
    }

    if (!selectedSubContractor) {
      setEntryErrorMessage("Choose a valid sub-contractor from the list.");
      return;
    }

    if (!selectedItem || !entryCostCode) {
      setEntryErrorMessage("Choose a valid item so the cost code can load.");
      return;
    }

    if (!Number.isFinite(parsedManHours) || parsedManHours < 0) {
      setEntryErrorMessage("Enter a valid non-negative man hours value.");
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setEntryErrorMessage("Enter a valid non-negative quantity value.");
      return;
    }

    const createdBy =
      [currentUser?.first_name, currentUser?.last_name]
        .filter(Boolean)
        .join(" ") ||
      currentUser?.email_id ||
      "Unknown User";

    if (!currentUser?.id) {
      setEntryErrorMessage("You must be logged in to save production log entries.");
      return;
    }

    const createdById = Number(currentUser.id);

    if (!Number.isFinite(createdById)) {
      setEntryErrorMessage("The current user id is not in a numeric format.");
      return;
    }

    const unit = deriveWorkUnit(selectedSubContractor.unit);
    const rate = selectedSubContractor.rate ?? 0;
    const amount = parsedQuantity * rate;

    setIsSavingEntry(true);
    setEntryErrorMessage("");

    try {
      if (editingEntry) {
        await updateProductionLogEntry({
          id: editingEntry.id,
          recordDate: entryRecordDate,
          subContractorName: selectedSubContractor.sub_contractor_name,
          trade: selectedSubContractor.trade,
          manHours: parsedManHours,
          quantity: parsedQuantity,
          unit,
          rate,
          amount,
          item: selectedItem.item,
          costCode: entryCostCode,
          createdById,
          createdByName: createdBy,
        });
      } else {
        await createProductionLogEntry({
          projectId: project.id,
          recordDate: entryRecordDate,
          subContractorName: selectedSubContractor.sub_contractor_name,
          trade: selectedSubContractor.trade,
          manHours: parsedManHours,
          quantity: parsedQuantity,
          unit,
          rate,
          amount,
          item: selectedItem.item,
          costCode: entryCostCode,
          createdById,
          createdByName: createdBy,
        });
      }

      await refreshEntries();
      handleCloseEntryModal();
    } catch (error) {
      console.error(error);
      setEntryErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save production log entry."
      );
    } finally {
      setIsSavingEntry(false);
    }
  }

  return (
    <>
      <section className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                Production Log
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Daily Work Progress Workspace
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Capture daily quantity progress, deployed man-hours, and
                sub-contractor production rates for {project.project_name}.
              </p>
            </div>

            <div className="w-full max-w-md">
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search dates like 2026-03-31, 31/03/2026, or March 2026"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={handleOpenEntryModal}
                className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
              >
                Add New Entry
              </button>

              <button
                type="button"
                onClick={handleOpenSubContractorDialog}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Add New Sub-Contractor
              </button>
            </div>
          </div>
        </div>

        <ProductionLogEntriesTable
          entries={filteredEntries}
          isLoadingEntries={isLoadingEntries}
          onViewEntry={handleOpenExpandedEntryDialog}
          onEditEntry={handleOpenEditEntryModal}
          onDeleteEntry={handleDeleteEntry}
        />
      </section>

      <ExpandedProductionLogEntryDialog
        entry={expandedEntry}
        onClose={handleCloseExpandedEntryDialog}
      />

      <ProductionLogEntryModal
        isOpen={isEntryModalOpen}
        title={editingEntry ? "Edit Production Entry" : "Add New Production Entry"}
        description={
          editingEntry
            ? "Update the date, item, cost code, sub-contractor, man-hours, and quantity for this saved production entry."
            : "Capture the day's work completed, cost code item, and manpower deployed for a selected sub-contractor."
        }
        subContractors={subContractors}
        isLoadingSubContractors={isLoadingSubContractors}
        itemOptions={itemOptions}
        isLoadingItems={isLoadingItems}
        recordDate={entryRecordDate}
        subContractorId={entrySubContractorId}
        item={entryItem}
        costCode={entryCostCode}
        manHours={entryManHours}
        quantity={entryQuantity}
        selectedSubContractor={selectedEntrySubContractor}
        selectedItemOption={selectedEntryItemOption}
        errorMessage={entryErrorMessage}
        isSaving={isSavingEntry}
        onClose={handleCloseEntryModal}
        onSubmit={handleSaveEntry}
        onRecordDateChange={setEntryRecordDate}
        onSubContractorIdChange={setEntrySubContractorId}
        onItemChange={handleEntryItemChange}
        onManHoursChange={setEntryManHours}
        onQuantityChange={setEntryQuantity}
      />

      <SubContractorDialog
        isOpen={isSubContractorDialogOpen}
        isLoadingSubContractors={isLoadingSubContractors}
        filteredSubContractors={filteredSubContractors}
        searchValue={subContractorSearchValue}
        newName={newSubContractorName}
        newTrade={newSubContractorTrade}
        newRate={newSubContractorRate}
        newUnit={newSubContractorUnit}
        errorMessage={subContractorErrorMessage}
        successMessage={subContractorSuccessMessage}
        isCreating={isCreatingSubContractor}
        onClose={handleCloseSubContractorDialog}
        onSearchChange={setSubContractorSearchValue}
        onNewNameChange={setNewSubContractorName}
        onNewTradeChange={setNewSubContractorTrade}
        onNewRateChange={setNewSubContractorRate}
        onNewUnitChange={setNewSubContractorUnit}
        onEditSubContractor={handleOpenEditSubContractorModal}
        onDeleteSubContractor={handleOpenDeleteSubContractorModal}
        onSubmit={handleCreateSubContractor}
      />

      <EditSubContractorModal
        subContractor={editingSubContractor}
        name={editSubContractorName}
        trade={editSubContractorTrade}
        rate={editSubContractorRate}
        unit={editSubContractorUnit}
        errorMessage={editSubContractorErrorMessage}
        isSaving={isSavingSubContractor}
        onClose={handleCloseEditSubContractorModal}
        onSubmit={handleSaveSubContractor}
        onNameChange={setEditSubContractorName}
        onTradeChange={setEditSubContractorTrade}
        onRateChange={setEditSubContractorRate}
        onUnitChange={setEditSubContractorUnit}
      />

      <DeleteSubContractorDialog
        subContractor={deleteSubContractorCandidate}
        errorMessage={deleteSubContractorErrorMessage}
        isDeleting={isDeletingSubContractor}
        onClose={handleCloseDeleteSubContractorModal}
        onDelete={handleDeleteSubContractor}
      />
    </>
  );
}
type ProductionLogEntriesTableProps = {
  entries: ProductionLogEntry[];
  isLoadingEntries: boolean;
  onViewEntry: (entry: ProductionLogEntry) => void;
  onEditEntry: (entry: ProductionLogEntry) => void;
  onDeleteEntry: (entryId: number) => void;
};

function ProductionLogEntriesTable({
  entries,
  isLoadingEntries,
  onViewEntry,
  onEditEntry,
  onDeleteEntry,
}: ProductionLogEntriesTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] shadow-[var(--shadow-md)]">
      {isLoadingEntries ? (
        <div className="p-10 text-center text-sm text-[var(--muted)]">
          Loading production log entries...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-10 text-center">
          <h3 className="text-lg font-semibold">No production log entries yet</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Add sub-contractors first, then capture daily progress entries from
            the Production Log form.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-[var(--surface)]">
              <tr>
                {[
                  "Record Date",
                  "Sub-Contractor",
                  "Trade",
                  "Man Hours",
                  "Quantity",
                  "Unit",
                  "Rate",
                  "Amount",
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
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatDate(entry.recordDate)}
                  </td>
                  <td className="px-4 py-4 font-medium">
                    {entry.subContractorName}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.trade}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatNumber(entry.manHours)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatNumber(entry.quantity)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">{entry.unit}</td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatRate(entry.rate, entry.rateUnit)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatCurrencyInr(entry.amount)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.createdBy}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewEntry(entry)}
                        aria-label={`View production log entry for ${entry.subContractorName}`}
                        title="View entry"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                      >
                        <ExpandIcon />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditEntry(entry)}
                        aria-label={`Edit production log entry for ${entry.subContractorName}`}
                        title="Edit entry"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                      >
                        <EditIcon />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        aria-label={`Delete production log entry for ${entry.subContractorName}`}
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
  );
}

type ExpandedProductionLogEntryDialogProps = {
  entry: ProductionLogEntry | null;
  onClose: () => void;
};

function ExpandedProductionLogEntryDialog({
  entry,
  onClose,
}: ExpandedProductionLogEntryDialogProps) {
  if (!entry) {
    return null;
  }

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
            <h3 className="text-2xl font-semibold">Production Log Entry</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Review the saved production details for this sub-contractor entry.
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Record Date" value={formatDate(entry.recordDate)} />
          <InfoTile label="Sub-Contractor" value={entry.subContractorName} />
          <InfoTile label="Trade" value={entry.trade} />
          <InfoTile label="Amount" value={formatCurrencyInr(entry.amount)} />
          <InfoTile label="Item" value={entry.item} />
          <InfoTile label="Cost Code" value={entry.costCode || "N/A"} />
          <InfoTile label="Man Hours" value={formatNumber(entry.manHours)} />
          <InfoTile
            label="Quantity"
            value={`${formatNumber(entry.quantity)} ${entry.unit}`}
          />
          <InfoTile
            label="Rate"
            value={formatRate(entry.rate, entry.rateUnit)}
          />
          <InfoTile label="Created By" value={entry.createdBy || "Unknown"} />
          <InfoTile label="Created At" value={formatCreatedAt(entry.createdAt)} />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {[
                    "Item",
                    "Cost Code",
                    "Sub-Contractor",
                    "Trade",
                    "Man Hours",
                    "Quantity",
                    "Rate",
                    "Amount",
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
              <tbody>
                <tr>
                  <td className="px-4 py-4 font-medium">{entry.item}</td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.costCode || "N/A"}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.subContractorName}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.trade}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatNumber(entry.manHours)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatNumber(entry.quantity)} {entry.unit}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatRate(entry.rate, entry.rateUnit)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatCurrencyInr(entry.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

type ProductionLogEntryModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  subContractors: SubContractorRecord[];
  isLoadingSubContractors: boolean;
  itemOptions: LabourItemOption[];
  isLoadingItems: boolean;
  recordDate: string;
  subContractorId: string;
  item: string;
  costCode: string;
  manHours: string;
  quantity: string;
  selectedSubContractor: SubContractorRecord | null;
  selectedItemOption: LabourItemOption | null;
  errorMessage: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRecordDateChange: (value: string) => void;
  onSubContractorIdChange: (value: string) => void;
  onItemChange: (value: string) => void;
  onManHoursChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
};

function ProductionLogEntryModal({
  isOpen,
  title,
  description,
  subContractors,
  isLoadingSubContractors,
  itemOptions,
  isLoadingItems,
  recordDate,
  subContractorId,
  item,
  costCode,
  manHours,
  quantity,
  selectedSubContractor,
  selectedItemOption,
  errorMessage,
  isSaving,
  onClose,
  onSubmit,
  onRecordDateChange,
  onSubContractorIdChange,
  onItemChange,
  onManHoursChange,
  onQuantityChange,
}: ProductionLogEntryModalProps) {
  if (!isOpen) {
    return null;
  }

  const derivedUnit = selectedSubContractor
    ? deriveWorkUnit(selectedSubContractor.unit)
    : "";
  const parsedQuantity = Number.parseFloat(quantity || "0");
  const rate = selectedSubContractor?.rate ?? 0;
  const estimatedAmount =
    (Number.isFinite(parsedQuantity) ? parsedQuantity : 0) * rate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">{title}</h3>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              {description}
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

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Record Date" required>
              <Input
                className="h-12"
                type="date"
                value={recordDate}
                onChange={(event) => onRecordDateChange(event.target.value)}
              />
            </Field>

            <Field label="Sub-Contractor" required>
              <select
                value={subContractorId}
                onChange={(event) => onSubContractorIdChange(event.target.value)}
                className={compactInputClassName}
              >
                <option value="">
                  {isLoadingSubContractors
                    ? "Loading sub-contractors..."
                    : subContractors.length === 0
                      ? "No sub-contractors yet"
                      : "Select sub-contractor"}
                </option>
                {subContractors.map((subContractor) => (
                  <option key={subContractor.id} value={String(subContractor.id)}>
                    {subContractor.sub_contractor_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Item" required>
              <SearchableItemInput
                value={item}
                itemOptions={itemOptions}
                isLoadingItems={isLoadingItems}
                onChange={onItemChange}
              />
            </Field>

            <Field label="Cost Code">
              <Input className="h-12" value={costCode} readOnly />
            </Field>

            <Field label="Trade">
              <Input
                className="h-12"
                value={selectedSubContractor?.trade ?? ""}
                readOnly
              />
            </Field>

            <Field label="Rate">
              <Input
                className="h-12"
                value={
                  selectedSubContractor
                    ? formatRate(
                        selectedSubContractor.rate ?? 0,
                        selectedSubContractor.unit
                      )
                    : ""
                }
                readOnly
              />
            </Field>

            <Field label="Man Hours" required>
              <Input
                className="h-12"
                type="number"
                min="0"
                step="0.5"
                value={manHours}
                onChange={(event) => onManHoursChange(event.target.value)}
                placeholder="Enter man hours"
              />
            </Field>

            <Field label="Quantity" required>
              <Input
                className="h-12"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) => onQuantityChange(event.target.value)}
                placeholder="Enter completed quantity"
              />
            </Field>

            <Field label="Unit">
              <Input className="h-12" value={derivedUnit} readOnly />
            </Field>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">
                Estimated Amount
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatCurrencyInr(estimatedAmount)}
              </p>
              {selectedItemOption ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Tagged to {selectedItemOption.item} ({selectedItemOption.cost_code})
                </p>
              ) : null}
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
              disabled={isSaving}
              className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
            >
              {isSaving
                ? title.startsWith("Edit")
                  ? "Saving Changes..."
                  : "Saving Entry..."
                : editingLabel(title)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SearchableItemInputProps = {
  value: string;
  itemOptions: LabourItemOption[];
  isLoadingItems: boolean;
  onChange: (value: string) => void;
};

function SearchableItemInput({
  value,
  itemOptions,
  isLoadingItems,
  onChange,
}: SearchableItemInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const normalizedValue = normalizeName(value).toLowerCase();
    const matches = itemOptions.filter((option) => {
      if (!normalizedValue) {
        return true;
      }

      return option.item.toLowerCase().includes(normalizedValue);
    });

    return matches
      .sort((left, right) => {
        const leftStartsWith = normalizedValue
          ? left.item.toLowerCase().startsWith(normalizedValue)
          : false;
        const rightStartsWith = normalizedValue
          ? right.item.toLowerCase().startsWith(normalizedValue)
          : false;

        return (
          Number(rightStartsWith) - Number(leftStartsWith) ||
          left.item.localeCompare(right.item)
        );
      })
      .slice(0, 8);
  }, [itemOptions, value]);
  const activeHighlightedIndex =
    visibleOptions.length === 0
      ? 0
      : Math.min(highlightedIndex, visibleOptions.length - 1);

  function handleSelectItem(option: LabourItemOption) {
    onChange(option.item);
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  return (
    <div className="relative">
      <Input
        className="h-12"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        onKeyDown={(event) => {
          if (visibleOptions.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((prev) =>
              Math.min(prev + 1, visibleOptions.length - 1)
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
            return;
          }

          if (event.key === "Tab" || event.key === "Enter") {
            if (isOpen) {
              event.preventDefault();
              handleSelectItem(
                visibleOptions[activeHighlightedIndex] ?? visibleOptions[0]
              );
            }
          }
        }}
        placeholder={
          isLoadingItems
            ? "Loading items..."
            : itemOptions.length === 0
              ? "No items available"
              : "Type to search items"
        }
      />

      {isOpen && !isLoadingItems && visibleOptions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
          <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
            {visibleOptions.map((option, index) => (
              <li key={`${option.item}-${option.cost_code}`}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectItem(option)}
                  className={[
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition duration-150",
                    activeHighlightedIndex === index
                      ? "bg-[var(--surface)] text-[var(--foreground)]"
                      : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  <span className="font-medium">{option.item}</span>
                  <span className="text-[10px] text-[var(--subtle)]">
                    {option.cost_code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type SubContractorDialogProps = {
  isOpen: boolean;
  isLoadingSubContractors: boolean;
  filteredSubContractors: SubContractorRecord[];
  searchValue: string;
  newName: string;
  newTrade: string;
  newRate: string;
  newUnit: string;
  errorMessage: string;
  successMessage: string;
  isCreating: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onNewNameChange: (value: string) => void;
  onNewTradeChange: (value: string) => void;
  onNewRateChange: (value: string) => void;
  onNewUnitChange: (value: string) => void;
  onEditSubContractor: (subContractor: SubContractorRecord) => void;
  onDeleteSubContractor: (subContractor: SubContractorRecord) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function SubContractorDialog({
  isOpen,
  isLoadingSubContractors,
  filteredSubContractors,
  searchValue,
  newName,
  newTrade,
  newRate,
  newUnit,
  errorMessage,
  successMessage,
  isCreating,
  onClose,
  onSearchChange,
  onNewNameChange,
  onNewTradeChange,
  onNewRateChange,
  onNewUnitChange,
  onEditSubContractor,
  onDeleteSubContractor,
  onSubmit,
}: SubContractorDialogProps) {
  if (!isOpen) {
    return null;
  }

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
            <h3 className="text-2xl font-semibold">Add New Sub-Contractor</h3>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Search the current list first, then add a new sub-contractor with
              their trade, rate, and billing unit.
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search existing sub-contractors"
              />
            </div>

            <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
              <div className="border-b border-[var(--border)] px-4 py-4">
                <h4 className="text-lg font-semibold">Current Sub-Contractors</h4>
                <p className="text-sm text-[var(--muted)]">
                  {isLoadingSubContractors
                    ? "Loading the current sub-contractor database..."
                    : `${filteredSubContractors.length} sub-contractor(s) found.`}
                </p>
              </div>

              {isLoadingSubContractors ? (
                <div className="p-6 text-sm text-[var(--muted)]">
                  Loading sub-contractors...
                </div>
              ) : filteredSubContractors.length === 0 ? (
                <div className="p-6 text-sm text-[var(--muted)]">
                  No sub-contractors matched that search.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        {["Name", "Trade", "Rate", "Unit", "Added", "Action"].map(
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
                      {filteredSubContractors.map((subContractor) => (
                        <tr key={subContractor.id}>
                          <td className="px-4 py-4 font-medium">
                            {subContractor.sub_contractor_name}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {subContractor.trade}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCurrencyInr(subContractor.rate ?? 0)}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {subContractor.unit}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCreatedAt(subContractor.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditSubContractor(subContractor)}
                                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteSubContractor(subContractor)}
                                className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-red-500/20"
                              >
                                Delete
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
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-5">
            <h4 className="text-lg font-semibold">Create New One</h4>
            <p className="mt-2 text-sm text-[var(--muted)]">
              New names are checked against the same trade before insertion.
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <Field label="Name" required>
                <Input
                  value={newName}
                  onChange={(event) => onNewNameChange(event.target.value)}
                  placeholder="Enter sub-contractor name"
                />
              </Field>

              <Field label="Trade" required>
                <select
                  value={newTrade}
                  onChange={(event) => onNewTradeChange(event.target.value)}
                  className={compactInputClassName}
                >
                  {tradeOptions.map((trade) => (
                    <option key={trade} value={trade}>
                      {trade}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Rate" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newRate}
                  onChange={(event) => onNewRateChange(event.target.value)}
                  placeholder="Enter rate"
                />
              </Field>

              <Field label="Unit" required>
                <select
                  value={newUnit}
                  onChange={(event) => onNewUnitChange(event.target.value)}
                  className={compactInputClassName}
                >
                  {rateUnitOptions.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </Field>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-white">
                  {successMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {isCreating ? "Adding Sub-Contractor..." : "Add Sub-Contractor"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

type EditSubContractorModalProps = {
  subContractor: SubContractorRecord | null;
  name: string;
  trade: string;
  rate: string;
  unit: string;
  errorMessage: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onTradeChange: (value: string) => void;
  onRateChange: (value: string) => void;
  onUnitChange: (value: string) => void;
};

function EditSubContractorModal({
  subContractor,
  name,
  trade,
  rate,
  unit,
  errorMessage,
  isSaving,
  onClose,
  onSubmit,
  onNameChange,
  onTradeChange,
  onRateChange,
  onUnitChange,
}: EditSubContractorModalProps) {
  if (!subContractor) {
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
            <h3 className="text-2xl font-semibold">Edit Sub-Contractor</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Update the sub-contractor name, trade, rate, and unit.
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

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Name" required>
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Enter sub-contractor name"
            />
          </Field>

          <Field label="Trade" required>
            <select
              value={trade}
              onChange={(event) => onTradeChange(event.target.value)}
              className={compactInputClassName}
            >
              {tradeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Rate" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(event) => onRateChange(event.target.value)}
              placeholder="Enter rate"
            />
          </Field>

          <Field label="Unit" required>
            <select
              value={unit}
              onChange={(event) => onUnitChange(event.target.value)}
              className={compactInputClassName}
            >
              {rateUnitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
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
              disabled={isSaving}
              className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {isSaving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
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

type DeleteSubContractorDialogProps = {
  subContractor: SubContractorRecord | null;
  errorMessage: string;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function DeleteSubContractorDialog({
  subContractor,
  errorMessage,
  isDeleting,
  onClose,
  onDelete,
}: DeleteSubContractorDialogProps) {
  if (!subContractor) {
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
            <h3 className="text-2xl font-semibold">Delete Sub-Contractor</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              This will remove the sub-contractor from the saved list for future
              Production Log entries.
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

        <div className="grid gap-4 md:grid-cols-2">
          <InfoTile label="Name" value={subContractor.sub_contractor_name} />
          <InfoTile label="Trade" value={subContractor.trade} />
          <InfoTile
            label="Rate"
            value={formatCurrencyInr(subContractor.rate ?? 0)}
          />
          <InfoTile label="Unit" value={subContractor.unit} />
        </div>

        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-[var(--foreground)]">
          Saved Production Log rows will remain in place as historical records.
          This only removes the sub-contractor from the master list for future
          entries.
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {isDeleting ? "Deleting Sub-Contractor..." : "Delete Sub-Contractor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getSubContractorById(
  subContractors: SubContractorRecord[],
  subContractorId: string
) {
  const parsedId = Number.parseInt(subContractorId, 10);

  if (!Number.isFinite(parsedId)) {
    return null;
  }

  return (
    subContractors.find((subContractor) => subContractor.id === parsedId) ?? null
  );
}

function reconcileSubContractors(
  nextEntries: ProductionLogEntry[],
  subContractors: SubContractorRecord[],
  previousEntries: ProductionLogEntry[]
) {
  return nextEntries.map((entry) => {
    const matchedSubContractor = subContractors.find(
      (subContractor) =>
        normalizeName(subContractor.sub_contractor_name).toLowerCase() ===
          normalizeName(entry.subContractorName).toLowerCase() &&
        subContractor.trade === entry.trade
    );
    const previousEntry =
      previousEntries.find((candidate) => candidate.id === entry.id) ?? null;

    return {
      ...entry,
      subContractorId:
        matchedSubContractor?.id ?? previousEntry?.subContractorId ?? null,
    };
  });
}

function deriveWorkUnit(rateUnit: string) {
  return rateUnit.replace(/^INR\//i, "").trim();
}

function toInputDate(dateValue: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toISOString().slice(0, 10);
}

function parseDateValue(dateValue: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date(dateValue);
}

function formatDate(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString();
}

function formatCreatedAt(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatCurrencyInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(rate: number, rateUnit: string) {
  return `${formatCurrencyInr(rate)} ${rateUnit.replace(/^INR/i, "").trim()}`;
}

function editingLabel(title: string) {
  return title.startsWith("Edit") ? "Save Changes" : "Save Entry";
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 4 4 9M15 4l5 5M9 20l-5-5M15 20l5-5"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 20 4.5-1 9-9a2.12 2.12 0 1 0-3-3l-9 9L4 20Z"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"
      />
    </svg>
  );
}
