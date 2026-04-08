"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { createAdvancePayment } from "@/features/projects/services/create-advance-payment";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import { createMusterRollEntry } from "@/features/projects/services/create-muster-roll-entry";
import { createPettyContractor } from "@/features/projects/services/create-petty-contractor";
import { deletePettyContractor } from "@/features/projects/services/delete-petty-contractor";
import { deleteMusterRollEntry } from "@/features/projects/services/delete-muster-roll-entry";
import { getMusterRollEntries } from "@/features/projects/services/get-muster-roll-entries";
import { getPettyContractors } from "@/features/projects/services/get-petty-contractors";
import { updateAdvancePayment } from "@/features/projects/services/update-advance-payment";
import { updateMusterRollEntry } from "@/features/projects/services/update-muster-roll-entry";
import { updatePettyContractor } from "@/features/projects/services/update-petty-contractor";
import type { ProjectRecord } from "@/features/projects/types/project";
import type {
  MusterRollEntry,
  PettyContractorRecord,
} from "@/features/projects/types/muster-roll";

type MusterRollPanelProps = {
  project: ProjectRecord;
  currentUser: UserProfile | null;
};

type MusterRollDraftRow = {
  id: number;
  pettyContractorId: string;
  crewName: string;
  crewType: string;
  regularHours: string;
  overtimeHours: string;
  rate: string;
};

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
};

type CrewNameSuggestion = {
  name: string;
  normalizedName: string;
  useCount: number;
  lastUsedAt: string;
  crewTypes: string[];
};

const defaultDraftRowCount = 5;

const compactInputClassName =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]";

function createEmptyDraftRow(): MusterRollDraftRow {
  const uniqueId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  return {
    id: uniqueId,
    pettyContractorId: "",
    crewName: "",
    crewType: "",
    regularHours: "",
    overtimeHours: "",
    rate: "",
  };
}

function createEmptyEditDraftRow(): MusterRollDraftRow {
  return {
    ...createEmptyDraftRow(),
    id: -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000)),
  };
}

function createDefaultDraftRows() {
  return Array.from({ length: defaultDraftRowCount }, () => createEmptyDraftRow());
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthValue() {
  const currentDate = new Date();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");

  return `${currentDate.getFullYear()}-${month}`;
}

function normalizePettyContractorName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCrewName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isDraftRowEmpty(row: MusterRollDraftRow) {
  return (
    !row.pettyContractorId.trim() &&
    !row.crewName.trim() &&
    !row.crewType.trim() &&
    !row.regularHours.trim() &&
    !row.overtimeHours.trim() &&
    !row.rate.trim()
  );
}

function createDraftRowsFromEntry(entry: MusterRollEntry): MusterRollDraftRow[] {
  return entry.rows.map((row) => ({
    id: row.rowId,
    pettyContractorId: row.pettyContractorId ? String(row.pettyContractorId) : "",
    crewName: row.crewName,
    crewType: row.crewType,
    regularHours: String(row.regularHours),
    overtimeHours: String(row.overtimeHours),
    rate: String(row.rate),
  }));
}

function createDuplicateDraftRowsFromEntry(
  entry: MusterRollEntry
): MusterRollDraftRow[] {
  return entry.rows.map((row) => ({
    id: createEmptyDraftRow().id,
    pettyContractorId: row.pettyContractorId ? String(row.pettyContractorId) : "",
    crewName: row.crewName,
    crewType: row.crewType,
    regularHours: String(row.regularHours),
    overtimeHours: String(row.overtimeHours),
    rate: String(row.rate),
  }));
}

function summarizeDraftRows(rows: MusterRollDraftRow[]) {
  return rows.reduce(
    (summary, row) => {
      const regularHours = Number.parseFloat(row.regularHours || "0");
      const overtimeHours = Number.parseFloat(row.overtimeHours || "0");
      const rate = Number.parseFloat(row.rate || "0");
      const safeRegularHours = Number.isFinite(regularHours) ? regularHours : 0;
      const safeOvertimeHours = Number.isFinite(overtimeHours) ? overtimeHours : 0;
      const safeRate = Number.isFinite(rate) ? rate : 0;

      summary.totalRegularHours += safeRegularHours;
      summary.totalOvertimeHours += safeOvertimeHours;
      summary.totalAmount += ((safeRegularHours + safeOvertimeHours) * safeRate) / 12;

      return summary;
    },
    {
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalAmount: 0,
    }
  );
}

export function MusterRollPanel({
  project,
  currentUser,
}: MusterRollPanelProps) {
  const [searchValue, setSearchValue] = useState("");
  const [entries, setEntries] = useState<MusterRollEntry[]>([]);
  const [pettyContractors, setPettyContractors] = useState<
    PettyContractorRecord[]
  >([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [isLoadingPettyContractors, setIsLoadingPettyContractors] =
    useState(true);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isPettyContractorDialogOpen, setIsPettyContractorDialogOpen] =
    useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isAdvancePaymentModalOpen, setIsAdvancePaymentModalOpen] =
    useState(false);
  const [entryDate, setEntryDate] = useState(getTodayDateValue());
  const [draftRows, setDraftRows] = useState<MusterRollDraftRow[]>(
    createDefaultDraftRows()
  );
  const [entryErrorMessage, setEntryErrorMessage] = useState("");
  const [entryNoticeMessage, setEntryNoticeMessage] = useState("");
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MusterRollEntry | null>(null);
  const [editRecordDate, setEditRecordDate] = useState(getTodayDateValue());
  const [editRows, setEditRows] = useState<MusterRollDraftRow[]>([]);
  const [editErrorMessage, setEditErrorMessage] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [advancePaymentRecordDate, setAdvancePaymentRecordDate] = useState(
    getTodayDateValue()
  );
  const [advancePaymentPettyContractorId, setAdvancePaymentPettyContractorId] =
    useState("");
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState("");
  const [advancePaymentDescription, setAdvancePaymentDescription] =
    useState("");
  const [advancePaymentErrorMessage, setAdvancePaymentErrorMessage] =
    useState("");
  const [isSavingAdvancePayment, setIsSavingAdvancePayment] = useState(false);
  const [editingAdvancePayment, setEditingAdvancePayment] =
    useState<MusterRollEntry | null>(null);
  const [editAdvancePaymentRecordDate, setEditAdvancePaymentRecordDate] =
    useState(getTodayDateValue());
  const [editAdvancePaymentPettyContractorId, setEditAdvancePaymentPettyContractorId] =
    useState("");
  const [editAdvancePaymentAmount, setEditAdvancePaymentAmount] =
    useState("");
  const [editAdvancePaymentDescription, setEditAdvancePaymentDescription] =
    useState("");
  const [editAdvancePaymentErrorMessage, setEditAdvancePaymentErrorMessage] =
    useState("");
  const [isSavingAdvancePaymentEdit, setIsSavingAdvancePaymentEdit] =
    useState(false);
  const [pettyContractorSearchValue, setPettyContractorSearchValue] =
    useState("");
  const [newPettyContractorName, setNewPettyContractorName] = useState("");
  const [newLabourRate, setNewLabourRate] = useState("");
  const [newMasonRate, setNewMasonRate] = useState("");
  const [editingPettyContractor, setEditingPettyContractor] =
    useState<PettyContractorRecord | null>(null);
  const [editPettyContractorName, setEditPettyContractorName] = useState("");
  const [editPettyContractorLabourRate, setEditPettyContractorLabourRate] =
    useState("");
  const [editPettyContractorMasonRate, setEditPettyContractorMasonRate] =
    useState("");
  const [editPettyContractorErrorMessage, setEditPettyContractorErrorMessage] =
    useState("");
  const [isSavingPettyContractor, setIsSavingPettyContractor] = useState(false);
  const [deletePettyContractorCandidate, setDeletePettyContractorCandidate] =
    useState<PettyContractorRecord | null>(null);
  const [deletePettyContractorErrorMessage, setDeletePettyContractorErrorMessage] =
    useState("");
  const [isDeletingPettyContractor, setIsDeletingPettyContractor] =
    useState(false);
  const [pettyContractorErrorMessage, setPettyContractorErrorMessage] =
    useState("");
  const [pettyContractorSuccessMessage, setPettyContractorSuccessMessage] =
    useState("");
  const [isCreatingPettyContractor, setIsCreatingPettyContractor] =
    useState(false);
  const [expandedEntry, setExpandedEntry] = useState<MusterRollEntry | null>(
    null
  );
  const [deleteEntryCandidate, setDeleteEntryCandidate] =
    useState<MusterRollEntry | null>(null);
  const [duplicateEntryCandidate, setDuplicateEntryCandidate] =
    useState<MusterRollEntry | null>(null);
  const [duplicateRows, setDuplicateRows] = useState<MusterRollDraftRow[]>([]);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [isDeletingEntry, setIsDeletingEntry] = useState(false);
  const [reportMonthValue, setReportMonthValue] = useState(
    getCurrentMonthValue()
  );

  const refreshEntries = useCallback(async () => {
    setIsLoadingEntries(true);

    try {
      const musterRollEntries = await getMusterRollEntries(project.id);
      setEntries(musterRollEntries);
    } catch (error) {
      console.error("Failed to load muster roll entries:", error);
      setEntries([]);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [project.id]);

  const refreshPettyContractors = useCallback(async () => {
    setIsLoadingPettyContractors(true);

    try {
      const contractorRows = await getPettyContractors();
      setPettyContractors(contractorRows);
    } catch (error) {
      console.error("Failed to load petty contractors:", error);
      setPettyContractors([]);
    } finally {
      setIsLoadingPettyContractors(false);
    }
  }, []);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    refreshPettyContractors();
  }, [refreshPettyContractors]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return entries;
    }

    return entries.filter((entry) =>
      [
        toInputDate(entry.recordDate),
        formatDate(entry.recordDate),
        formatMonthYear(entry.recordDate),
        entry.pettyContractorSummary,
        entry.createdBy,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [entries, searchValue]);

  const filteredPettyContractors = useMemo(() => {
    const normalizedSearch = pettyContractorSearchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return pettyContractors;
    }

    return pettyContractors.filter((contractor) =>
      contractor.petty_contractor_name
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [pettyContractors, pettyContractorSearchValue]);

  const crewNameSuggestionsByPettyContractor = useMemo(() => {
    const suggestionsMap = new Map<string, Map<string, CrewNameSuggestion>>();

    entries.forEach((entry) => {
      entry.rows.forEach((row) => {
        if (!row.pettyContractorId || !row.crewName.trim()) {
          return;
        }

        const pettyContractorKey = String(row.pettyContractorId);
        const normalizedName = normalizeCrewName(row.crewName);

        if (!normalizedName) {
          return;
        }

        const contractorSuggestions =
          suggestionsMap.get(pettyContractorKey) ?? new Map<string, CrewNameSuggestion>();
        const existingSuggestion = contractorSuggestions.get(normalizedName);
        const nextLastUsedAt =
          compareDateValues(entry.recordDate, existingSuggestion?.lastUsedAt ?? "") >= 0
            ? entry.recordDate
            : existingSuggestion?.lastUsedAt ?? entry.recordDate;

        contractorSuggestions.set(normalizedName, {
          name:
            compareDateValues(entry.recordDate, existingSuggestion?.lastUsedAt ?? "") >= 0
              ? row.crewName.trim()
              : existingSuggestion?.name ?? row.crewName.trim(),
          normalizedName,
          useCount: (existingSuggestion?.useCount ?? 0) + 1,
          lastUsedAt: nextLastUsedAt,
          crewTypes: Array.from(
            new Set([...(existingSuggestion?.crewTypes ?? []), row.crewType].filter(Boolean))
          ),
        });

        suggestionsMap.set(pettyContractorKey, contractorSuggestions);
      });
    });

    return new Map(
      Array.from(suggestionsMap.entries()).map(([pettyContractorKey, value]) => [
        pettyContractorKey,
        Array.from(value.values()),
      ])
    );
  }, [entries]);

  const entrySummary = useMemo(() => summarizeDraftRows(draftRows), [draftRows]);
  const editSummary = useMemo(() => summarizeDraftRows(editRows), [editRows]);

  function handleOpenEntryModal() {
    setEntryDate(getTodayDateValue());
    setDraftRows(createDefaultDraftRows());
    setEntryErrorMessage("");
    setEntryNoticeMessage("");
    setIsEntryModalOpen(true);
  }

  function handleCloseEntryModal() {
    setEntryDate(getTodayDateValue());
    setDraftRows(createDefaultDraftRows());
    setEntryErrorMessage("");
    setEntryNoticeMessage("");
    setIsEntryModalOpen(false);
  }

  function handleOpenAdvancePaymentModal() {
    setAdvancePaymentRecordDate(getTodayDateValue());
    setAdvancePaymentPettyContractorId("");
    setAdvancePaymentAmount("");
    setAdvancePaymentDescription("");
    setAdvancePaymentErrorMessage("");
    setIsAdvancePaymentModalOpen(true);
  }

  function handleCloseAdvancePaymentModal() {
    setAdvancePaymentRecordDate(getTodayDateValue());
    setAdvancePaymentPettyContractorId("");
    setAdvancePaymentAmount("");
    setAdvancePaymentDescription("");
    setAdvancePaymentErrorMessage("");
    setIsSavingAdvancePayment(false);
    setIsAdvancePaymentModalOpen(false);
  }

  function handleOpenEditModal(entry: MusterRollEntry) {
    if (entry.entryType === "advance-payment") {
      setEditingAdvancePayment(entry);
      setEditAdvancePaymentRecordDate(entry.recordDate);
      setEditAdvancePaymentPettyContractorId(
        entry.rows[0]?.pettyContractorId
          ? String(entry.rows[0].pettyContractorId)
          : ""
      );
      setEditAdvancePaymentAmount(
        entry.advancePaymentAmount > 0 ? String(entry.advancePaymentAmount) : ""
      );
      setEditAdvancePaymentDescription(entry.advancePaymentDescription);
      setEditAdvancePaymentErrorMessage("");
      return;
    }

    setEditingEntry(entry);
    setEditRecordDate(entry.recordDate);
    setEditRows(createDraftRowsFromEntry(entry));
    setEditErrorMessage("");
  }

  function handleCloseEditModal() {
    setEditingEntry(null);
    setEditRecordDate(getTodayDateValue());
    setEditRows([]);
    setEditErrorMessage("");
    setIsSavingEdit(false);
  }

  function handleCloseEditAdvancePaymentModal() {
    setEditingAdvancePayment(null);
    setEditAdvancePaymentRecordDate(getTodayDateValue());
    setEditAdvancePaymentPettyContractorId("");
    setEditAdvancePaymentAmount("");
    setEditAdvancePaymentDescription("");
    setEditAdvancePaymentErrorMessage("");
    setIsSavingAdvancePaymentEdit(false);
  }

  function handleOpenDeleteModal(entry: MusterRollEntry) {
    setDeleteEntryCandidate(entry);
    setDeleteErrorMessage("");
  }

  function handleOpenDuplicateModal(entry: MusterRollEntry) {
    if (entry.entryType !== "hours") {
      return;
    }

    setDuplicateEntryCandidate(entry);
    setDuplicateRows(createDuplicateDraftRowsFromEntry(entry));
  }

  function handleCloseDeleteModal() {
    setDeleteEntryCandidate(null);
    setDeleteErrorMessage("");
    setIsDeletingEntry(false);
  }

  function handleCloseDuplicateModal() {
    setDuplicateEntryCandidate(null);
    setDuplicateRows([]);
  }

  function handleOpenPettyContractorDialog() {
    setPettyContractorSearchValue("");
    setNewPettyContractorName("");
    setNewLabourRate("");
    setNewMasonRate("");
    setPettyContractorErrorMessage("");
    setPettyContractorSuccessMessage("");
    setIsPettyContractorDialogOpen(true);
  }

  function handleClosePettyContractorDialog() {
    setPettyContractorSearchValue("");
    setNewPettyContractorName("");
    setNewLabourRate("");
    setNewMasonRate("");
    setPettyContractorErrorMessage("");
    setPettyContractorSuccessMessage("");
    setIsPettyContractorDialogOpen(false);
  }

  function handleOpenEditPettyContractorModal(
    pettyContractor: PettyContractorRecord
  ) {
    setEditingPettyContractor(pettyContractor);
    setEditPettyContractorName(pettyContractor.petty_contractor_name);
    setEditPettyContractorLabourRate(
      pettyContractor.labour_rate === null ? "" : String(pettyContractor.labour_rate)
    );
    setEditPettyContractorMasonRate(
      pettyContractor.mason_rate === null ? "" : String(pettyContractor.mason_rate)
    );
    setEditPettyContractorErrorMessage("");
  }

  function handleCloseEditPettyContractorModal() {
    setEditingPettyContractor(null);
    setEditPettyContractorName("");
    setEditPettyContractorLabourRate("");
    setEditPettyContractorMasonRate("");
    setEditPettyContractorErrorMessage("");
    setIsSavingPettyContractor(false);
  }

  function handleOpenDeletePettyContractorModal(
    pettyContractor: PettyContractorRecord
  ) {
    setDeletePettyContractorCandidate(pettyContractor);
    setDeletePettyContractorErrorMessage("");
  }

  function handleCloseDeletePettyContractorModal() {
    setDeletePettyContractorCandidate(null);
    setDeletePettyContractorErrorMessage("");
    setIsDeletingPettyContractor(false);
  }

  function handleOpenGenerateDialog() {
    setReportMonthValue(getCurrentMonthValue());
    setIsGenerateDialogOpen(true);
  }

  function handleCloseGenerateDialog() {
    setReportMonthValue(getCurrentMonthValue());
    setIsGenerateDialogOpen(false);
  }

  function updateDraftRow(
    rowId: number,
    updater: (row: MusterRollDraftRow) => MusterRollDraftRow
  ) {
    setDraftRows((prev) =>
      prev.map((row) => (row.id === rowId ? updater(row) : row))
    );
  }

  function handleDraftFieldChange(
    rowId: number,
    key:
      | "pettyContractorId"
      | "crewName"
      | "crewType"
      | "regularHours"
      | "overtimeHours"
      | "rate",
    value: string
  ) {
    updateDraftRow(rowId, (row) => {
      const nextRow = {
        ...row,
        [key]: value,
      };

      if (key === "pettyContractorId" || key === "crewType") {
        const suggestedRate = getSuggestedRate(
          nextRow.pettyContractorId,
          nextRow.crewType
        );

        if (suggestedRate !== "") {
          nextRow.rate = suggestedRate;
        }
      }

      return nextRow;
    });
  }

  function handleAddDraftRow() {
    setDraftRows((prev) => [...prev, createEmptyDraftRow()]);
  }

  function handleDeleteDraftRow(rowId: number) {
    setDraftRows((prev) =>
      prev.length > 1 ? prev.filter((row) => row.id !== rowId) : prev
    );
  }

  function updateEditRow(
    rowId: number,
    updater: (row: MusterRollDraftRow) => MusterRollDraftRow
  ) {
    setEditRows((prev) =>
      prev.map((row) => (row.id === rowId ? updater(row) : row))
    );
  }

  function handleEditFieldChange(
    rowId: number,
    key:
      | "pettyContractorId"
      | "crewName"
      | "crewType"
      | "regularHours"
      | "overtimeHours"
      | "rate",
    value: string
  ) {
    updateEditRow(rowId, (row) => {
      const nextRow = {
        ...row,
        [key]: value,
      };

      if (key === "pettyContractorId" || key === "crewType") {
        const suggestedRate = getSuggestedRate(
          nextRow.pettyContractorId,
          nextRow.crewType
        );

        if (suggestedRate !== "") {
          nextRow.rate = suggestedRate;
        }
      }

      return nextRow;
    });
  }

  function handleAddEditRow() {
    setEditRows((prev) => [...prev, createEmptyEditDraftRow()]);
  }

  function handleDeleteEditRow(rowId: number) {
    setEditRows((prev) =>
      prev.length > 1 ? prev.filter((row) => row.id !== rowId) : prev
    );
  }

  function handleDeleteDuplicateRow(rowId: number) {
    setDuplicateRows((prev) =>
      prev.length > 1 ? prev.filter((row) => row.id !== rowId) : prev
    );
  }

  function getPettyContractorById(pettyContractorId: string) {
    const parsedId = Number.parseInt(pettyContractorId, 10);

    if (!Number.isFinite(parsedId)) {
      return null;
    }

    return (
      pettyContractors.find((contractor) => contractor.id === parsedId) ?? null
    );
  }

  function getSuggestedRate(pettyContractorId: string, crewType: string) {
    const pettyContractor = getPettyContractorById(pettyContractorId);

    if (!pettyContractor) {
      return "";
    }

    if (crewType === "Mason" && pettyContractor.mason_rate !== null) {
      return String(pettyContractor.mason_rate);
    }

    if (crewType === "Labour" && pettyContractor.labour_rate !== null) {
      return String(pettyContractor.labour_rate);
    }

    return "";
  }

  async function handleAdvancePaymentSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!advancePaymentRecordDate) {
      setAdvancePaymentErrorMessage("Select a record date first.");
      return;
    }

    if (!currentUser?.id) {
      setAdvancePaymentErrorMessage(
        "You must be logged in to record advance payments."
      );
      return;
    }

    const pettyContractor = getPettyContractorById(
      advancePaymentPettyContractorId
    );
    const parsedAmount = Number.parseFloat(advancePaymentAmount);

    if (!pettyContractor) {
      setAdvancePaymentErrorMessage(
        "Choose a valid petty contractor from the list."
      );
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAdvancePaymentErrorMessage(
        "Enter a valid advance payment amount greater than zero."
      );
      return;
    }

    const createdByUserId = Number(currentUser.id);

    if (!Number.isFinite(createdByUserId)) {
      setAdvancePaymentErrorMessage(
        "The current user id is not in a numeric format."
      );
      return;
    }

    const createdByUserName =
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
      currentUser.email_id ||
      "Unknown User";

    setIsSavingAdvancePayment(true);
    setAdvancePaymentErrorMessage("");

    try {
      await createAdvancePayment({
        projectId: project.id,
        recordDate: advancePaymentRecordDate,
        pettyContractorId: pettyContractor.id,
        pettyContractorName: pettyContractor.petty_contractor_name,
        advancePaymentAmount: parsedAmount,
        advancePaymentDescription: advancePaymentDescription,
        createdByUserId,
        createdByUserName,
      });

      await refreshEntries();
      handleCloseAdvancePaymentModal();
    } catch (error) {
      console.error(error);
      setAdvancePaymentErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save advance payment."
      );
    } finally {
      setIsSavingAdvancePayment(false);
    }
  }

  async function handleCreatePettyContractor(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const normalizedName = normalizePettyContractorName(newPettyContractorName);
    const labourRate = Number.parseFloat(newLabourRate);
    const masonRate = Number.parseFloat(newMasonRate);

    if (!normalizedName) {
      setPettyContractorErrorMessage("Enter a petty contractor name first.");
      setPettyContractorSuccessMessage("");
      return;
    }

    if (!Number.isFinite(labourRate) || labourRate < 0) {
      setPettyContractorErrorMessage(
        "Enter a valid non-negative labour rate."
      );
      setPettyContractorSuccessMessage("");
      return;
    }

    if (!Number.isFinite(masonRate) || masonRate < 0) {
      setPettyContractorErrorMessage("Enter a valid non-negative mason rate.");
      setPettyContractorSuccessMessage("");
      return;
    }

    const isDuplicate = pettyContractors.some(
      (contractor) =>
        normalizePettyContractorName(contractor.petty_contractor_name).toLowerCase() ===
        normalizedName.toLowerCase()
    );

    if (isDuplicate) {
      setPettyContractorErrorMessage(
        "That petty contractor already exists in the list."
      );
      setPettyContractorSuccessMessage("");
      return;
    }

    setIsCreatingPettyContractor(true);
    setPettyContractorErrorMessage("");
    setPettyContractorSuccessMessage("");

    try {
      const createdContractor = await createPettyContractor({
        pettyContractorName: normalizedName,
        labourRate,
        masonRate,
      });

      setPettyContractors((prev) =>
        [...prev, createdContractor].sort((left, right) =>
          left.petty_contractor_name.localeCompare(
            right.petty_contractor_name
          )
        )
      );
      setNewPettyContractorName("");
      setNewLabourRate("");
      setNewMasonRate("");
      setPettyContractorSearchValue(createdContractor.petty_contractor_name);
      setPettyContractorSuccessMessage(
        `${createdContractor.petty_contractor_name} is now available in Muster Roll.`
      );
    } catch (error) {
      console.error(error);
      setPettyContractorErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create petty contractor."
      );
      setPettyContractorSuccessMessage("");
    } finally {
      setIsCreatingPettyContractor(false);
    }
  }

  async function handleSavePettyContractor(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingPettyContractor) {
      return;
    }

    const normalizedName = normalizePettyContractorName(editPettyContractorName);
    const labourRate = Number.parseFloat(editPettyContractorLabourRate);
    const masonRate = Number.parseFloat(editPettyContractorMasonRate);

    if (!normalizedName) {
      setEditPettyContractorErrorMessage(
        "Enter a petty contractor name first."
      );
      return;
    }

    if (!Number.isFinite(labourRate) || labourRate < 0) {
      setEditPettyContractorErrorMessage(
        "Enter a valid non-negative labour rate."
      );
      return;
    }

    if (!Number.isFinite(masonRate) || masonRate < 0) {
      setEditPettyContractorErrorMessage(
        "Enter a valid non-negative mason rate."
      );
      return;
    }

    setIsSavingPettyContractor(true);
    setEditPettyContractorErrorMessage("");

    try {
      const updatedContractor = await updatePettyContractor({
        id: editingPettyContractor.id,
        pettyContractorName: normalizedName,
        labourRate,
        masonRate,
      });

      setPettyContractors((prev) =>
        prev
          .map((contractor) =>
            contractor.id === updatedContractor.id ? updatedContractor : contractor
          )
          .sort((left, right) =>
            left.petty_contractor_name.localeCompare(right.petty_contractor_name)
          )
      );

      handleCloseEditPettyContractorModal();
    } catch (error) {
      console.error(error);
      setEditPettyContractorErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update petty contractor."
      );
    } finally {
      setIsSavingPettyContractor(false);
    }
  }

  async function handleDeletePettyContractor() {
    if (!deletePettyContractorCandidate) {
      return;
    }

    setIsDeletingPettyContractor(true);
    setDeletePettyContractorErrorMessage("");

    try {
      await deletePettyContractor(deletePettyContractorCandidate.id);

      setPettyContractors((prev) =>
        prev.filter(
          (contractor) => contractor.id !== deletePettyContractorCandidate.id
        )
      );

      if (editingPettyContractor?.id === deletePettyContractorCandidate.id) {
        handleCloseEditPettyContractorModal();
      }

      handleCloseDeletePettyContractorModal();
    } catch (error) {
      console.error(error);
      setDeletePettyContractorErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete petty contractor."
      );
    } finally {
      setIsDeletingPettyContractor(false);
    }
  }

  async function handleEntrySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!entryDate) {
      setEntryErrorMessage("Select a record date for this muster roll entry.");
      setEntryNoticeMessage("");
      return;
    }

    if (!currentUser?.id) {
      setEntryErrorMessage("You must be logged in to save muster roll entries.");
      setEntryNoticeMessage("");
      return;
    }

    const createdByUserId = Number(currentUser.id);

    if (!Number.isFinite(createdByUserId)) {
      setEntryErrorMessage("The current user id is not in a numeric format.");
      setEntryNoticeMessage("");
      return;
    }

    const createdByUserName =
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
      currentUser.email_id ||
      "Unknown User";

    const activeRows = draftRows.filter((row) => !isDraftRowEmpty(row));

    if (activeRows.length === 0) {
      setEntryErrorMessage("Add at least one labour row before saving.");
      setEntryNoticeMessage("");
      return;
    }

    for (const [index, row] of activeRows.entries()) {
      const hasMissingFields =
        !row.pettyContractorId.trim() ||
        !row.crewName.trim() ||
        !row.crewType.trim() ||
        !row.regularHours.trim() ||
        !row.overtimeHours.trim() ||
        !row.rate.trim();

      if (hasMissingFields) {
        setEntryErrorMessage(
          `Row ${index + 1} is incomplete. Fill all fields in each active row.`
        );
        setEntryNoticeMessage("");
        return;
      }

      const pettyContractor = getPettyContractorById(row.pettyContractorId);
      const regularHours = Number.parseFloat(row.regularHours);
      const overtimeHours = Number.parseFloat(row.overtimeHours);
      const rate = Number.parseFloat(row.rate);

      if (!pettyContractor) {
        setEntryErrorMessage(
          `Row ${index + 1} must use a valid petty contractor from the list.`
        );
        setEntryNoticeMessage("");
        return;
      }

      if (
        !Number.isFinite(regularHours) ||
        !Number.isFinite(overtimeHours) ||
        !Number.isFinite(rate)
      ) {
        setEntryErrorMessage(
          `Row ${index + 1} must have valid numeric hours and rate values.`
        );
        setEntryNoticeMessage("");
        return;
      }
    }

    setIsSubmittingEntry(true);
    setEntryErrorMessage("");
    setEntryNoticeMessage("");

    try {
      await createMusterRollEntry({
        projectId: project.id,
        recordDate: entryDate,
        createdByUserId,
        createdByUserName,
        rows: activeRows.map((row) => {
          const pettyContractor = getPettyContractorById(row.pettyContractorId);

          if (!pettyContractor) {
            throw new Error("One or more petty contractors could not be resolved.");
          }

          return {
            pettyContractorId: pettyContractor.id,
            pettyContractorName: pettyContractor.petty_contractor_name,
            crewName: row.crewName,
            crewType: row.crewType,
            regularHours: Number.parseFloat(row.regularHours),
            overtimeHours: Number.parseFloat(row.overtimeHours),
            rate: Number.parseFloat(row.rate),
          };
        }),
      });

      await refreshEntries();
      handleCloseEntryModal();
    } catch (error) {
      console.error(error);
      setEntryErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save muster roll entry."
      );
    } finally {
      setIsSubmittingEntry(false);
    }
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingEntry) {
      return;
    }

    if (!currentUser?.id) {
      setEditErrorMessage("You must be logged in to save muster roll entries.");
      return;
    }

    const createdByUserId = Number(currentUser.id);

    if (!Number.isFinite(createdByUserId)) {
      setEditErrorMessage("The current user id is not in a numeric format.");
      return;
    }

    const createdByUserName =
      [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") ||
      currentUser.email_id ||
      "Unknown User";

    if (!editRecordDate) {
      setEditErrorMessage("Select a record date for this muster roll entry.");
      return;
    }

    for (const [index, row] of editRows.entries()) {
      const hasMissingFields =
        !row.pettyContractorId.trim() ||
        !row.crewName.trim() ||
        !row.crewType.trim() ||
        !row.regularHours.trim() ||
        !row.overtimeHours.trim() ||
        !row.rate.trim();

      if (hasMissingFields) {
        setEditErrorMessage(
          `Row ${index + 1} is incomplete. Fill all fields in each active row.`
        );
        return;
      }

      const pettyContractor = getPettyContractorById(row.pettyContractorId);
      const regularHours = Number.parseFloat(row.regularHours);
      const overtimeHours = Number.parseFloat(row.overtimeHours);
      const rate = Number.parseFloat(row.rate);

      if (!pettyContractor) {
        setEditErrorMessage(
          `Row ${index + 1} must use a valid petty contractor from the list.`
        );
        return;
      }

      if (
        !Number.isFinite(regularHours) ||
        !Number.isFinite(overtimeHours) ||
        !Number.isFinite(rate)
      ) {
        setEditErrorMessage(
          `Row ${index + 1} must have valid numeric hours and rate values.`
        );
        return;
      }
    }

    setIsSavingEdit(true);
    setEditErrorMessage("");

    try {
      await updateMusterRollEntry({
        projectId: project.id,
        entryGroupId: editingEntry.entryGroupId,
        createdByUserId,
        createdByUserName,
        rows: editRows.map((row) => {
          const pettyContractor = getPettyContractorById(row.pettyContractorId);

          if (!pettyContractor) {
            throw new Error("One or more petty contractors could not be resolved.");
          }

          return {
            rowId: row.id,
            recordDate: editRecordDate,
            pettyContractorId: pettyContractor.id,
            pettyContractorName: pettyContractor.petty_contractor_name,
            crewName: row.crewName,
            crewType: row.crewType,
            regularHours: Number.parseFloat(row.regularHours),
            overtimeHours: Number.parseFloat(row.overtimeHours),
            rate: Number.parseFloat(row.rate),
          };
        }),
      });

      await refreshEntries();

      if (expandedEntry?.entryGroupId === editingEntry.entryGroupId) {
        setExpandedEntry(null);
      }

      handleCloseEditModal();
    } catch (error) {
      console.error(error);
      setEditErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update muster roll entry."
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleSaveAdvancePaymentEdit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingAdvancePayment) {
      return;
    }

    if (!editAdvancePaymentRecordDate) {
      setEditAdvancePaymentErrorMessage("Select a record date first.");
      return;
    }

    const pettyContractor = getPettyContractorById(
      editAdvancePaymentPettyContractorId
    );
    const parsedAmount = Number.parseFloat(editAdvancePaymentAmount);

    if (!pettyContractor) {
      setEditAdvancePaymentErrorMessage(
        "Choose a valid petty contractor from the list."
      );
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setEditAdvancePaymentErrorMessage(
        "Enter a valid advance payment amount greater than zero."
      );
      return;
    }

    const rowId = editingAdvancePayment.rows[0]?.rowId;

    if (!rowId) {
      setEditAdvancePaymentErrorMessage(
        "This advance payment entry could not be resolved."
      );
      return;
    }

    setIsSavingAdvancePaymentEdit(true);
    setEditAdvancePaymentErrorMessage("");

    try {
      await updateAdvancePayment({
        rowId,
        recordDate: editAdvancePaymentRecordDate,
        pettyContractorId: pettyContractor.id,
        pettyContractorName: pettyContractor.petty_contractor_name,
        advancePaymentAmount: parsedAmount,
        advancePaymentDescription: editAdvancePaymentDescription,
      });

      await refreshEntries();
      handleCloseEditAdvancePaymentModal();
    } catch (error) {
      console.error(error);
      setEditAdvancePaymentErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update advance payment."
      );
    } finally {
      setIsSavingAdvancePaymentEdit(false);
    }
  }

  async function handleDeleteEntry() {
    if (!deleteEntryCandidate) {
      return;
    }

    setIsDeletingEntry(true);
    setDeleteErrorMessage("");

    try {
      await deleteMusterRollEntry(
        deleteEntryCandidate.rows.map((row) => row.rowId)
      );
      await refreshEntries();

      if (expandedEntry?.entryGroupId === deleteEntryCandidate.entryGroupId) {
        setExpandedEntry(null);
      }

      if (editingEntry?.entryGroupId === deleteEntryCandidate.entryGroupId) {
        handleCloseEditModal();
      }

      if (
        editingAdvancePayment?.entryGroupId === deleteEntryCandidate.entryGroupId
      ) {
        handleCloseEditAdvancePaymentModal();
      }

      handleCloseDeleteModal();
    } catch (error) {
      console.error(error);
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete muster roll entry."
      );
    } finally {
      setIsDeletingEntry(false);
    }
  }

  function handleGenerateMusterRoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reportMonthValue) {
      return;
    }

    const reportUrl = `/dashboard/projects/${project.id}/muster-roll-report?month=${reportMonthValue}`;
    window.location.href = reportUrl;
  }

  function handleConfirmDuplicateEntry() {
    if (
      !duplicateEntryCandidate ||
      duplicateEntryCandidate.entryType !== "hours" ||
      duplicateRows.length === 0
    ) {
      return;
    }

    setEntryDate(getTodayDateValue());
    setDraftRows(duplicateRows);
    setEntryErrorMessage("");
    setEntryNoticeMessage("");
    setIsEntryModalOpen(true);
    handleCloseDuplicateModal();
  }

  return (
    <>
      <section className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                Muster Roll
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Labour Hours Workspace
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Search muster roll activity by date, prepare labour-hour
                entries, and keep petty contractor records ready for monthly
                reporting.
              </p>
            </div>

            <div className="w-full max-w-md">
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search dates like 2026-03-25, 25/03/2026, or March 2026"
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
                onClick={handleOpenAdvancePaymentModal}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Record Advance Payment
              </button>

              <button
                type="button"
                onClick={handleOpenPettyContractorDialog}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Add New Petty Contractor
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenGenerateDialog}
              className="rounded-2xl border border-[var(--inverse-bg)] bg-[var(--inverse-bg)] px-5 py-3 text-sm font-semibold text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer"
            >
              Generate Muster Roll
            </button>
          </div>
        </div>

        <MusterRollEntriesTable
          entries={filteredEntries}
          isLoadingEntries={isLoadingEntries}
          onExpandEntry={setExpandedEntry}
          onDuplicateEntry={handleOpenDuplicateModal}
          onEditEntry={handleOpenEditModal}
          onDeleteEntry={handleOpenDeleteModal}
        />
      </section>

      <MusterRollEntryModal
        isOpen={isEntryModalOpen}
        pettyContractors={pettyContractors}
        crewNameSuggestionsByPettyContractor={crewNameSuggestionsByPettyContractor}
        isLoadingPettyContractors={isLoadingPettyContractors}
        entryDate={entryDate}
        draftRows={draftRows}
        entrySummary={entrySummary}
        entryErrorMessage={entryErrorMessage}
        entryNoticeMessage={entryNoticeMessage}
        isSubmittingEntry={isSubmittingEntry}
        onClose={handleCloseEntryModal}
        onSubmit={handleEntrySubmit}
        onEntryDateChange={setEntryDate}
        onAddRow={handleAddDraftRow}
        onDeleteRow={handleDeleteDraftRow}
        onDraftFieldChange={handleDraftFieldChange}
      />

      <PettyContractorDialog
        isOpen={isPettyContractorDialogOpen}
        isLoadingPettyContractors={isLoadingPettyContractors}
        filteredPettyContractors={filteredPettyContractors}
        pettyContractorSearchValue={pettyContractorSearchValue}
        newPettyContractorName={newPettyContractorName}
        newLabourRate={newLabourRate}
        newMasonRate={newMasonRate}
        pettyContractorErrorMessage={pettyContractorErrorMessage}
        pettyContractorSuccessMessage={pettyContractorSuccessMessage}
        isCreatingPettyContractor={isCreatingPettyContractor}
        onClose={handleClosePettyContractorDialog}
        onSearchChange={setPettyContractorSearchValue}
        onNewNameChange={setNewPettyContractorName}
        onNewLabourRateChange={setNewLabourRate}
        onNewMasonRateChange={setNewMasonRate}
        onEditPettyContractor={handleOpenEditPettyContractorModal}
        onDeletePettyContractor={handleOpenDeletePettyContractorModal}
        onSubmit={handleCreatePettyContractor}
      />

      <AdvancePaymentModal
        isOpen={isAdvancePaymentModalOpen}
        pettyContractors={pettyContractors}
        isLoadingPettyContractors={isLoadingPettyContractors}
        title="Record Advance Payment"
        description="Capture any part-payment or advance paid to a petty contractor before month-end settlement."
        recordDate={advancePaymentRecordDate}
        pettyContractorId={advancePaymentPettyContractorId}
        amount={advancePaymentAmount}
        paymentDescription={advancePaymentDescription}
        errorMessage={advancePaymentErrorMessage}
        isSaving={isSavingAdvancePayment}
        submitLabel="Save Advance Payment"
        savingLabel="Saving Advance..."
        onClose={handleCloseAdvancePaymentModal}
        onSubmit={handleAdvancePaymentSubmit}
        onRecordDateChange={setAdvancePaymentRecordDate}
        onPettyContractorIdChange={setAdvancePaymentPettyContractorId}
        onAmountChange={setAdvancePaymentAmount}
        onDescriptionChange={setAdvancePaymentDescription}
      />

      <GenerateMusterRollDialog
        isOpen={isGenerateDialogOpen}
        projectName={project.project_name}
        entryCount={entries.length}
        pettyContractorCount={pettyContractors.length}
        reportMonthValue={reportMonthValue}
        onClose={handleCloseGenerateDialog}
        onSubmit={handleGenerateMusterRoll}
        onReportMonthChange={(value) => {
          setReportMonthValue(value);
        }}
      />

      <ExpandedMusterRollEntryDialog
        entry={expandedEntry}
        onClose={() => setExpandedEntry(null)}
      />

      <EditMusterRollEntryModal
        isOpen={Boolean(editingEntry)}
        pettyContractors={pettyContractors}
        crewNameSuggestionsByPettyContractor={crewNameSuggestionsByPettyContractor}
        isLoadingPettyContractors={isLoadingPettyContractors}
        recordDate={editRecordDate}
        rows={editRows}
        summary={editSummary}
        errorMessage={editErrorMessage}
        isSaving={isSavingEdit}
        onClose={handleCloseEditModal}
        onSubmit={handleSaveEdit}
        onRecordDateChange={setEditRecordDate}
        onAddRow={handleAddEditRow}
        onDeleteRow={handleDeleteEditRow}
        onFieldChange={handleEditFieldChange}
      />

      <AdvancePaymentModal
        isOpen={Boolean(editingAdvancePayment)}
        pettyContractors={pettyContractors}
        isLoadingPettyContractors={isLoadingPettyContractors}
        title="Edit Advance Payment"
        description="Update the date, petty contractor, amount, or optional description for this recorded advance payment."
        recordDate={editAdvancePaymentRecordDate}
        pettyContractorId={editAdvancePaymentPettyContractorId}
        amount={editAdvancePaymentAmount}
        paymentDescription={editAdvancePaymentDescription}
        errorMessage={editAdvancePaymentErrorMessage}
        isSaving={isSavingAdvancePaymentEdit}
        submitLabel="Save Changes"
        savingLabel="Saving Changes..."
        onClose={handleCloseEditAdvancePaymentModal}
        onSubmit={handleSaveAdvancePaymentEdit}
        onRecordDateChange={setEditAdvancePaymentRecordDate}
        onPettyContractorIdChange={setEditAdvancePaymentPettyContractorId}
        onAmountChange={setEditAdvancePaymentAmount}
        onDescriptionChange={setEditAdvancePaymentDescription}
      />

      <DeleteMusterRollEntryDialog
        entry={deleteEntryCandidate}
        errorMessage={deleteErrorMessage}
        isDeleting={isDeletingEntry}
        onClose={handleCloseDeleteModal}
        onDelete={handleDeleteEntry}
      />

      <DuplicateMusterRollEntryDialog
        entry={duplicateEntryCandidate}
        pettyContractors={pettyContractors}
        rows={duplicateRows}
        onClose={handleCloseDuplicateModal}
        onDeleteRow={handleDeleteDuplicateRow}
        onDuplicate={handleConfirmDuplicateEntry}
      />

      <EditPettyContractorModal
        pettyContractor={editingPettyContractor}
        pettyContractorName={editPettyContractorName}
        labourRate={editPettyContractorLabourRate}
        masonRate={editPettyContractorMasonRate}
        errorMessage={editPettyContractorErrorMessage}
        isSaving={isSavingPettyContractor}
        onClose={handleCloseEditPettyContractorModal}
        onSubmit={handleSavePettyContractor}
        onNameChange={setEditPettyContractorName}
        onLabourRateChange={setEditPettyContractorLabourRate}
        onMasonRateChange={setEditPettyContractorMasonRate}
      />

      <DeletePettyContractorDialog
        pettyContractor={deletePettyContractorCandidate}
        errorMessage={deletePettyContractorErrorMessage}
        isDeleting={isDeletingPettyContractor}
        onClose={handleCloseDeletePettyContractorModal}
        onDelete={handleDeletePettyContractor}
      />
    </>
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

type MusterRollEntriesTableProps = {
  entries: MusterRollEntry[];
  isLoadingEntries: boolean;
  onExpandEntry: (entry: MusterRollEntry) => void;
  onDuplicateEntry: (entry: MusterRollEntry) => void;
  onEditEntry: (entry: MusterRollEntry) => void;
  onDeleteEntry: (entry: MusterRollEntry) => void;
};

function MusterRollEntriesTable({
  entries,
  isLoadingEntries,
  onExpandEntry,
  onDuplicateEntry,
  onEditEntry,
  onDeleteEntry,
}: MusterRollEntriesTableProps) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] shadow-[var(--shadow-md)]">
      {isLoadingEntries ? (
        <div className="p-10 text-center text-sm text-[var(--muted)]">
          Loading muster roll entries...
        </div>
      ) : entries.length === 0 ? (
        <div className="p-10 text-center">
          <h3 className="text-lg font-semibold">No muster roll entries yet</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Start with petty contractors, then use Add New Entry or Record
            Advance Payment to begin tracking this project.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-[var(--surface)]">
              <tr>
                {[
                  "Record Date",
                  "Petty Contractor",
                  "Crew Rows",
                  "Regular Hours",
                  "Overtime Hours",
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
                <tr key={entry.entryGroupId}>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {formatDate(entry.recordDate)}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium">{entry.pettyContractorSummary}</p>
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.entryType === "advance-payment" ? "-" : entry.rows.length}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.entryType === "advance-payment"
                      ? "-"
                      : formatNumber(entry.totalRegularHours)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.entryType === "advance-payment"
                      ? "-"
                      : formatNumber(entry.totalOvertimeHours)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.entryType === "advance-payment"
                      ? formatAccountingCurrencyInr(entry.totalAmount)
                      : formatCurrencyInr(entry.totalAmount)}
                  </td>
                  <td className="px-4 py-4 text-[var(--muted)]">
                    {entry.createdBy}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onExpandEntry(entry)}
                        aria-label={`Expand muster roll entry for ${entry.pettyContractorSummary}`}
                        title="Expand entry"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                      >
                        <ExpandIcon />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditEntry(entry)}
                        aria-label={`Edit muster roll entry for ${entry.pettyContractorSummary}`}
                        title="Edit entry"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                      >
                        <EditIcon />
                      </button>

                      {entry.entryType === "hours" ? (
                        <button
                          type="button"
                          onClick={() => onDuplicateEntry(entry)}
                          aria-label={`Duplicate muster roll entry for ${entry.pettyContractorSummary}`}
                          title="Duplicate entry"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                        >
                          <DuplicateIcon />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry)}
                        aria-label={`Delete muster roll entry for ${entry.pettyContractorSummary}`}
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

type MusterRollEntryModalProps = {
  isOpen: boolean;
  pettyContractors: PettyContractorRecord[];
  crewNameSuggestionsByPettyContractor: Map<string, CrewNameSuggestion[]>;
  isLoadingPettyContractors: boolean;
  entryDate: string;
  draftRows: MusterRollDraftRow[];
  entrySummary: {
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalAmount: number;
  };
  entryErrorMessage: string;
  entryNoticeMessage: string;
  isSubmittingEntry: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEntryDateChange: (value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: number) => void;
  onDraftFieldChange: (
    rowId: number,
    key:
      | "pettyContractorId"
      | "crewName"
      | "crewType"
      | "regularHours"
      | "overtimeHours"
      | "rate",
    value: string
  ) => void;
};

function MusterRollEntryModal({
  isOpen,
  pettyContractors,
  crewNameSuggestionsByPettyContractor,
  isLoadingPettyContractors,
  entryDate,
  draftRows,
  entrySummary,
  entryErrorMessage,
  entryNoticeMessage,
  isSubmittingEntry,
  onClose,
  onSubmit,
  onEntryDateChange,
  onAddRow,
  onDeleteRow,
  onDraftFieldChange,
}: MusterRollEntryModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">Add New Muster Roll Entry</h3>
            <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
              Capture labour hours row by row and save them directly into the
              muster roll for this project.
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
          <div className="max-w-sm">
            <Field label="Record Date" required>
              <Input
                type="date"
                value={entryDate}
                onChange={(event) => onEntryDateChange(event.target.value)}
              />
            </Field>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
              <div>
                <h4 className="text-lg font-semibold">Crew Rows</h4>
                <p className="text-sm text-[var(--muted)]">
                  Choose the petty contractor and crew type first. The 12-hour
                  rate will auto-fill from the saved contractor rates, and you
                  can still override it when needed.
                </p>
              </div>

              <button
                type="button"
                onClick={onAddRow}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {[
                      "Petty Contractor",
                      "Crew Name",
                      "Crew Type",
                      "Regular Hours",
                      "Overtime Hours",
                      "Rate (12h)",
                      "Line Total",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)]">
                  {draftRows.map((row) => {
                    const regularHours = Number.parseFloat(row.regularHours || "0");
                    const overtimeHours = Number.parseFloat(
                      row.overtimeHours || "0"
                    );
                    const rate = Number.parseFloat(row.rate || "0");
                    const lineTotal =
                      ((Number.isFinite(regularHours) ? regularHours : 0) +
                        (Number.isFinite(overtimeHours) ? overtimeHours : 0)) *
                      (Number.isFinite(rate) ? rate : 0) /
                      12;

                    return (
                      <tr key={row.id}>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <select
                            value={row.pettyContractorId}
                            onChange={(event) =>
                              onDraftFieldChange(
                                row.id,
                                "pettyContractorId",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          >
                            <option value="">
                              {isLoadingPettyContractors
                                ? "Loading petty contractors..."
                                : pettyContractors.length === 0
                                  ? "No petty contractors yet"
                                  : "Select petty contractor"}
                            </option>
                            {pettyContractors.map((contractor) => (
                              <option
                                key={contractor.id}
                                value={String(contractor.id)}
                              >
                                {contractor.petty_contractor_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <CrewNameAutocompleteInput
                            value={row.crewName}
                            onChange={(value) =>
                              onDraftFieldChange(row.id, "crewName", value)
                            }
                            crewType={row.crewType}
                            suggestions={
                              crewNameSuggestionsByPettyContractor.get(
                                row.pettyContractorId
                              ) ?? []
                            }
                            placeholder="Crew / team name"
                          />
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <select
                            value={row.crewType}
                            onChange={(event) =>
                              onDraftFieldChange(
                                row.id,
                                "crewType",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          >
                            <option value="">Select crew type</option>
                            <option value="Mason">Mason</option>
                            <option value="Labour">Labour</option>
                          </select>
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.regularHours}
                            onChange={(event) =>
                              onDraftFieldChange(
                                row.id,
                                "regularHours",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.overtimeHours}
                            onChange={(event) =>
                              onDraftFieldChange(
                                row.id,
                                "overtimeHours",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                            placeholder="0"
                          />
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.rate}
                            onChange={(event) =>
                              onDraftFieldChange(
                                row.id,
                                "rate",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="border border-[var(--border)] px-3 py-2 align-top text-[var(--muted)]">
                          {formatCurrencyInr(Number.isFinite(lineTotal) ? lineTotal : 0)}
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => onDeleteRow(row.id)}
                            disabled={draftRows.length <= 1}
                            title={
                              draftRows.length <= 1
                                ? "At least one row is required"
                                : "Delete row"
                            }
                            className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoTile
              label="Regular Hours"
              value={formatNumber(entrySummary.totalRegularHours)}
            />
            <InfoTile
              label="Overtime Hours"
              value={formatNumber(entrySummary.totalOvertimeHours)}
            />
            <InfoTile
              label="Estimated Amount"
              value={formatCurrencyInr(entrySummary.totalAmount)}
            />
          </div>

          {entryErrorMessage ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {entryErrorMessage}
            </div>
          ) : null}

          {entryNoticeMessage ? (
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              {entryNoticeMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmittingEntry}
              className="rounded-2xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
            >
              {isSubmittingEntry ? "Saving Entry..." : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type EditMusterRollEntryModalProps = {
  isOpen: boolean;
  pettyContractors: PettyContractorRecord[];
  crewNameSuggestionsByPettyContractor: Map<string, CrewNameSuggestion[]>;
  isLoadingPettyContractors: boolean;
  recordDate: string;
  rows: MusterRollDraftRow[];
  summary: {
    totalRegularHours: number;
    totalOvertimeHours: number;
    totalAmount: number;
  };
  errorMessage: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRecordDateChange: (value: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: number) => void;
  onFieldChange: (
    rowId: number,
    key:
      | "pettyContractorId"
      | "crewName"
      | "crewType"
      | "regularHours"
      | "overtimeHours"
      | "rate",
    value: string
  ) => void;
};

function EditMusterRollEntryModal({
  isOpen,
  pettyContractors,
  crewNameSuggestionsByPettyContractor,
  isLoadingPettyContractors,
  recordDate,
  rows,
  summary,
  errorMessage,
  isSaving,
  onClose,
  onSubmit,
  onRecordDateChange,
  onAddRow,
  onDeleteRow,
  onFieldChange,
}: EditMusterRollEntryModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">Edit Muster Roll Entry</h3>
            <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
              Update the record date and any saved labour rows for this grouped
              muster roll submission.
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
          <div className="max-w-sm">
            <Field label="Record Date" required>
              <Input
                type="date"
                value={recordDate}
                onChange={(event) => onRecordDateChange(event.target.value)}
              />
            </Field>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
              <div>
                <h4 className="text-lg font-semibold">Crew Rows</h4>
                <p className="text-sm text-[var(--muted)]">
                  Edit the saved rows or add new ones for any missed entries.
                </p>
              </div>

              <button
                type="button"
                onClick={onAddRow}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-full table-fixed border-collapse text-left text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {[
                      "Petty Contractor",
                      "Crew Name",
                      "Crew Type",
                      "Regular Hours",
                      "Overtime Hours",
                      "Rate (12h)",
                      "Line Total",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)]">
                  {rows.map((row) => {
                    const regularHours = Number.parseFloat(row.regularHours || "0");
                    const overtimeHours = Number.parseFloat(
                      row.overtimeHours || "0"
                    );
                    const rate = Number.parseFloat(row.rate || "0");
                    const lineTotal =
                      ((Number.isFinite(regularHours) ? regularHours : 0) +
                        (Number.isFinite(overtimeHours) ? overtimeHours : 0)) *
                      (Number.isFinite(rate) ? rate : 0) /
                      12;

                    return (
                      <tr key={row.id}>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <select
                            value={row.pettyContractorId}
                            onChange={(event) =>
                              onFieldChange(
                                row.id,
                                "pettyContractorId",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          >
                            <option value="">
                              {isLoadingPettyContractors
                                ? "Loading petty contractors..."
                                : pettyContractors.length === 0
                                  ? "No petty contractors yet"
                                  : "Select petty contractor"}
                            </option>
                            {pettyContractors.map((contractor) => (
                              <option
                                key={contractor.id}
                                value={String(contractor.id)}
                              >
                                {contractor.petty_contractor_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <CrewNameAutocompleteInput
                            value={row.crewName}
                            onChange={(value) =>
                              onFieldChange(row.id, "crewName", value)
                            }
                            crewType={row.crewType}
                            suggestions={
                              crewNameSuggestionsByPettyContractor.get(
                                row.pettyContractorId
                              ) ?? []
                            }
                            placeholder="Crew / team name"
                          />
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <select
                            value={row.crewType}
                            onChange={(event) =>
                              onFieldChange(
                                row.id,
                                "crewType",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          >
                            <option value="">Select crew type</option>
                            <option value="Mason">Mason</option>
                            <option value="Labour">Labour</option>
                          </select>
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.regularHours}
                            onChange={(event) =>
                              onFieldChange(
                                row.id,
                                "regularHours",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          />
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.overtimeHours}
                            onChange={(event) =>
                              onFieldChange(
                                row.id,
                                "overtimeHours",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          />
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.rate}
                            onChange={(event) =>
                              onFieldChange(
                                row.id,
                                "rate",
                                event.target.value
                              )
                            }
                            className={compactInputClassName}
                          />
                        </td>
                        <td className="border border-[var(--border)] px-3 py-2 align-top text-[var(--muted)]">
                          {formatCurrencyInr(Number.isFinite(lineTotal) ? lineTotal : 0)}
                        </td>
                        <td className="border border-[var(--border)] px-2 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => onDeleteRow(row.id)}
                            disabled={rows.length <= 1}
                            title={
                              rows.length <= 1
                                ? "At least one row is required"
                                : "Delete row"
                            }
                            className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InfoTile label="Regular Hours" value={formatNumber(summary.totalRegularHours)} />
            <InfoTile label="Overtime Hours" value={formatNumber(summary.totalOvertimeHours)} />
            <InfoTile label="Estimated Amount" value={formatCurrencyInr(summary.totalAmount)} />
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

type DuplicateMusterRollEntryDialogProps = {
  entry: MusterRollEntry | null;
  pettyContractors: PettyContractorRecord[];
  rows: MusterRollDraftRow[];
  onClose: () => void;
  onDeleteRow: (rowId: number) => void;
  onDuplicate: () => void;
};

function DuplicateMusterRollEntryDialog({
  entry,
  pettyContractors,
  rows,
  onClose,
  onDeleteRow,
  onDuplicate,
}: DuplicateMusterRollEntryDialogProps) {
  if (!entry) {
    return null;
  }

  const summary = summarizeDraftRows(rows);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">Duplicate Muster Roll Entry</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Review the rows that will be copied. Delete any rows that should
              not be included, then open the cleaned copy in the Add New Entry form.
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

        <div className="grid gap-4 md:grid-cols-3">
          <InfoTile label="Original Date" value={formatDate(entry.recordDate)} />
          <InfoTile label="Crew Rows" value={String(rows.length)} />
          <InfoTile
            label="Petty Contractor"
            value={entry.pettyContractorSummary}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
              <thead className="bg-[var(--surface)]">
                <tr>
                  {[
                    "Petty Contractor",
                    "Crew Name",
                    "Crew Type",
                    "Regular Hours",
                    "Overtime Hours",
                    "Rate (12h)",
                    "Line Total",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((row) => {
                  const pettyContractor =
                    pettyContractors.find(
                      (contractor) =>
                        String(contractor.id) === row.pettyContractorId
                    ) ?? null;
                  const regularHours = Number.parseFloat(row.regularHours || "0");
                  const overtimeHours = Number.parseFloat(row.overtimeHours || "0");
                  const rate = Number.parseFloat(row.rate || "0");
                  const lineTotal =
                    ((Number.isFinite(regularHours) ? regularHours : 0) +
                      (Number.isFinite(overtimeHours) ? overtimeHours : 0)) *
                    (Number.isFinite(rate) ? rate : 0) /
                    12;

                  return (
                    <tr key={row.id}>
                      <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                        {pettyContractor?.petty_contractor_name ??
                          "Unknown contractor"}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2 font-medium">
                        {row.crewName || "-"}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                        {row.crewType || "-"}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                        {formatNumber(Number.isFinite(regularHours) ? regularHours : 0)}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                        {formatNumber(Number.isFinite(overtimeHours) ? overtimeHours : 0)}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                        {formatCurrencyInr(Number.isFinite(rate) ? rate : 0)}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2 text-[var(--muted)]">
                        {formatCurrencyInr(Number.isFinite(lineTotal) ? lineTotal : 0)}
                      </td>
                      <td className="border border-[var(--border)] px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onDeleteRow(row.id)}
                          disabled={rows.length <= 1}
                          title={
                            rows.length <= 1
                              ? "At least one row is required"
                              : "Delete row from duplicate"
                          }
                          className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InfoTile
            label="Regular Hours"
            value={formatNumber(summary.totalRegularHours)}
          />
          <InfoTile
            label="Overtime Hours"
            value={formatNumber(summary.totalOvertimeHours)}
          />
          <InfoTile
            label="Estimated Amount"
            value={formatCurrencyInr(summary.totalAmount)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
          >
            No
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={rows.length === 0}
            className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
          >
            Yes, Duplicate Entry
          </button>
        </div>
      </div>
    </div>
  );
}

type AdvancePaymentModalProps = {
  isOpen: boolean;
  pettyContractors: PettyContractorRecord[];
  isLoadingPettyContractors: boolean;
  title: string;
  description: string;
  recordDate: string;
  pettyContractorId: string;
  amount: string;
  paymentDescription: string;
  errorMessage: string;
  isSaving: boolean;
  submitLabel: string;
  savingLabel: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRecordDateChange: (value: string) => void;
  onPettyContractorIdChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
};

function AdvancePaymentModal({
  isOpen,
  pettyContractors,
  isLoadingPettyContractors,
  title,
  description,
  recordDate,
  pettyContractorId,
  amount,
  paymentDescription,
  errorMessage,
  isSaving,
  submitLabel,
  savingLabel,
  onClose,
  onSubmit,
  onRecordDateChange,
  onPettyContractorIdChange,
  onAmountChange,
  onDescriptionChange,
}: AdvancePaymentModalProps) {
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
            <h3 className="text-2xl font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
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
          <Field label="Record Date" required>
            <Input
              type="date"
              value={recordDate}
              onChange={(event) => onRecordDateChange(event.target.value)}
            />
          </Field>

          <Field label="Petty Contractor" required>
            <select
              value={pettyContractorId}
              onChange={(event) => onPettyContractorIdChange(event.target.value)}
              className={compactInputClassName}
            >
              <option value="">
                {isLoadingPettyContractors
                  ? "Loading petty contractors..."
                  : pettyContractors.length === 0
                    ? "No petty contractors yet"
                    : "Select petty contractor"}
              </option>
              {pettyContractors.map((contractor) => (
                <option key={contractor.id} value={String(contractor.id)}>
                  {contractor.petty_contractor_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Advance Payment Amount" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="Enter advance payment amount"
            />
          </Field>

          <Field label="Description (Optional)">
            <textarea
              value={paymentDescription}
              onChange={(event) => onDescriptionChange(event.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition duration-200 placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]"
              placeholder="Add any note for this advance payment"
            />
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
              {isSaving ? savingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type DeleteMusterRollEntryDialogProps = {
  entry: MusterRollEntry | null;
  errorMessage: string;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function DeleteMusterRollEntryDialog({
  entry,
  errorMessage,
  isDeleting,
  onClose,
  onDelete,
}: DeleteMusterRollEntryDialogProps) {
  if (!entry) {
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
            <h3 className="text-2xl font-semibold">
              {entry.entryType === "advance-payment"
                ? "Delete Advance Payment"
                : "Delete Muster Roll Entry"}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {entry.entryType === "advance-payment"
                ? "This will permanently remove this recorded advance payment."
                : "This will permanently remove all labour rows saved under this grouped muster roll entry."}
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
          <InfoTile
            label={
              entry.entryType === "advance-payment" ? "Record Date" : "Entry Date"
            }
            value={formatDate(entry.recordDate)}
          />
          <InfoTile label="Petty Contractor" value={entry.pettyContractorSummary} />
          {entry.entryType === "advance-payment" ? (
            <>
              <InfoTile
                label="Advance Amount"
                value={formatAccountingCurrencyInr(entry.totalAmount)}
              />
              <InfoTile
                label="Description"
                value={entry.advancePaymentDescription || "No description"}
              />
            </>
          ) : (
            <>
              <InfoTile
                label="Regular Hours"
                value={formatNumber(entry.totalRegularHours)}
              />
              <InfoTile
                label="Overtime Hours"
                value={formatNumber(entry.totalOvertimeHours)}
              />
            </>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-[var(--foreground)]">
          {entry.entryType === "advance-payment"
            ? "Deleting this entry will remove this saved advance payment record."
            : "Deleting this entry will remove every grouped muster roll row under this saved submission."}
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
            {isDeleting
              ? entry.entryType === "advance-payment"
                ? "Deleting Advance..."
                : "Deleting Entry..."
              : entry.entryType === "advance-payment"
                ? "Delete Advance Payment"
                : "Delete Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

type CrewNameAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: CrewNameSuggestion[];
  crewType: string;
  placeholder?: string;
};

function CrewNameAutocompleteInput({
  value,
  onChange,
  suggestions,
  crewType,
  placeholder,
}: CrewNameAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const visibleSuggestions = useMemo(() => {
    const normalizedValue = normalizeCrewName(value);

    return suggestions
      .filter((suggestion) => {
        if (!normalizedValue) {
          return true;
        }

        return suggestion.normalizedName.includes(normalizedValue);
      })
      .sort((left, right) => {
        const normalizedValuePresent = Boolean(normalizedValue);
        const leftStartsWith = normalizedValuePresent
          ? left.normalizedName.startsWith(normalizedValue)
          : false;
        const rightStartsWith = normalizedValuePresent
          ? right.normalizedName.startsWith(normalizedValue)
          : false;
        const leftCrewTypeMatch = crewType
          ? left.crewTypes.includes(crewType)
          : false;
        const rightCrewTypeMatch = crewType
          ? right.crewTypes.includes(crewType)
          : false;

        return (
          Number(rightStartsWith) - Number(leftStartsWith) ||
          Number(rightCrewTypeMatch) - Number(leftCrewTypeMatch) ||
          compareDateValues(right.lastUsedAt, left.lastUsedAt) ||
          right.useCount - left.useCount ||
          left.name.localeCompare(right.name)
        );
      })
      .filter(
        (suggestion) => suggestion.normalizedName !== normalizedValue || !normalizedValue
      )
      .slice(0, 6);
  }, [crewType, suggestions, value]);
  const activeHighlightedIndex =
    visibleSuggestions.length === 0
      ? 0
      : Math.min(highlightedIndex, visibleSuggestions.length - 1);

  function handleSelectSuggestion(name: string) {
    onChange(name);
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  return (
    <div className="relative">
      <input
        type="text"
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
          if (visibleSuggestions.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((prev) =>
              Math.min(prev + 1, visibleSuggestions.length - 1)
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
              handleSelectSuggestion(
                visibleSuggestions[activeHighlightedIndex]?.name ??
                  visibleSuggestions[0].name
              );
            }
          }
        }}
        className={compactInputClassName}
        placeholder={placeholder}
      />

      {isOpen && visibleSuggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
          <ul className="divide-y divide-[var(--border)]">
            {visibleSuggestions.map((suggestion, index) => (
              <li key={`${suggestion.normalizedName}-${suggestion.lastUsedAt}`}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectSuggestion(suggestion.name)}
                  className={[
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition duration-150",
                    activeHighlightedIndex === index
                      ? "bg-[var(--surface)] text-[var(--foreground)]"
                      : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  <span className="font-medium">{suggestion.name}</span>
                  <span className="text-[10px] text-[var(--subtle)]">
                    {formatDate(suggestion.lastUsedAt)}
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

type PettyContractorDialogProps = {
  isOpen: boolean;
  isLoadingPettyContractors: boolean;
  filteredPettyContractors: PettyContractorRecord[];
  pettyContractorSearchValue: string;
  newPettyContractorName: string;
  newLabourRate: string;
  newMasonRate: string;
  pettyContractorErrorMessage: string;
  pettyContractorSuccessMessage: string;
  isCreatingPettyContractor: boolean;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onNewNameChange: (value: string) => void;
  onNewLabourRateChange: (value: string) => void;
  onNewMasonRateChange: (value: string) => void;
  onEditPettyContractor: (pettyContractor: PettyContractorRecord) => void;
  onDeletePettyContractor: (pettyContractor: PettyContractorRecord) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function PettyContractorDialog({
  isOpen,
  isLoadingPettyContractors,
  filteredPettyContractors,
  pettyContractorSearchValue,
  newPettyContractorName,
  newLabourRate,
  newMasonRate,
  pettyContractorErrorMessage,
  pettyContractorSuccessMessage,
  isCreatingPettyContractor,
  onClose,
  onSearchChange,
  onNewNameChange,
  onNewLabourRateChange,
  onNewMasonRateChange,
  onEditPettyContractor,
  onDeletePettyContractor,
  onSubmit,
}: PettyContractorDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">Add New Petty Contractor</h3>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Search the existing list first so we avoid duplicates, then add a
              new petty contractor only when it does not already exist.
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
              <Input
                value={pettyContractorSearchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search existing petty contractors"
              />
            </div>

            <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
              <div className="border-b border-[var(--border)] px-4 py-4">
                <h4 className="text-lg font-semibold">Current Contractors</h4>
                <p className="text-sm text-[var(--muted)]">
                  {isLoadingPettyContractors
                    ? "Loading the current petty contractor database..."
                    : `${filteredPettyContractors.length} contractor(s) found.`}
                </p>
              </div>

              {isLoadingPettyContractors ? (
                <div className="p-6 text-sm text-[var(--muted)]">
                  Loading petty contractors...
                </div>
              ) : filteredPettyContractors.length === 0 ? (
                <div className="p-6 text-sm text-[var(--muted)]">
                  No petty contractors matched that search.
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        {[
                          "Petty Contractor",
                          "Mason Rate (12h)",
                          "Labour Rate (12h)",
                          "Added",
                          "Action",
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
                      {filteredPettyContractors.map((contractor) => (
                        <tr key={contractor.id}>
                          <td className="px-4 py-4 font-medium">
                            {contractor.petty_contractor_name}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatContractorRate(contractor.mason_rate)}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatContractorRate(contractor.labour_rate)}
                          </td>
                          <td className="px-4 py-4 text-[var(--muted)]">
                            {formatCreatedAt(contractor.created_at)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditPettyContractor(contractor)}
                                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePettyContractor(contractor)}
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
              New names are checked against the current list before insertion.
            </p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <Field label="Petty Contractor Name" required>
                <Input
                  value={newPettyContractorName}
                  onChange={(event) => onNewNameChange(event.target.value)}
                  placeholder="Enter petty contractor name"
                />
              </Field>

              <Field label="Mason Rate (12h)" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newMasonRate}
                  onChange={(event) => onNewMasonRateChange(event.target.value)}
                  placeholder="Enter mason rate"
                />
              </Field>

              <Field label="Labour Rate (12h)" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newLabourRate}
                  onChange={(event) => onNewLabourRateChange(event.target.value)}
                  placeholder="Enter labour rate"
                />
              </Field>

              {pettyContractorErrorMessage ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {pettyContractorErrorMessage}
                </div>
              ) : null}

              {pettyContractorSuccessMessage ? (
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  {pettyContractorSuccessMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isCreatingPettyContractor}
                className="w-full rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {isCreatingPettyContractor
                  ? "Adding Contractor..."
                  : "Add Petty Contractor"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

type EditPettyContractorModalProps = {
  pettyContractor: PettyContractorRecord | null;
  pettyContractorName: string;
  labourRate: string;
  masonRate: string;
  errorMessage: string;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onLabourRateChange: (value: string) => void;
  onMasonRateChange: (value: string) => void;
};

function EditPettyContractorModal({
  pettyContractor,
  pettyContractorName,
  labourRate,
  masonRate,
  errorMessage,
  isSaving,
  onClose,
  onSubmit,
  onNameChange,
  onLabourRateChange,
  onMasonRateChange,
}: EditPettyContractorModalProps) {
  if (!pettyContractor) {
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
            <h3 className="text-2xl font-semibold">Edit Petty Contractor</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Update the contractor name, mason rate, and labour rate.
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
          <Field label="Petty Contractor Name" required>
            <Input
              value={pettyContractorName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Enter petty contractor name"
            />
          </Field>

          <Field label="Mason Rate (12h)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={masonRate}
              onChange={(event) => onMasonRateChange(event.target.value)}
              placeholder="Enter mason rate"
            />
          </Field>

          <Field label="Labour Rate (12h)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={labourRate}
              onChange={(event) => onLabourRateChange(event.target.value)}
              placeholder="Enter labour rate"
            />
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

type DeletePettyContractorDialogProps = {
  pettyContractor: PettyContractorRecord | null;
  errorMessage: string;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
};

function DeletePettyContractorDialog({
  pettyContractor,
  errorMessage,
  isDeleting,
  onClose,
  onDelete,
}: DeletePettyContractorDialogProps) {
  if (!pettyContractor) {
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
            <h3 className="text-2xl font-semibold">Delete Petty Contractor</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              This will remove the petty contractor from the saved list for
              future Muster Roll entries.
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
          <InfoTile
            label="Petty Contractor"
            value={pettyContractor.petty_contractor_name}
          />
          <InfoTile
            label="Mason Rate (12h)"
            value={formatContractorRate(pettyContractor.mason_rate)}
          />
          <InfoTile
            label="Labour Rate (12h)"
            value={formatContractorRate(pettyContractor.labour_rate)}
          />
          <InfoTile label="Added" value={formatCreatedAt(pettyContractor.created_at)} />
        </div>

        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-[var(--foreground)]">
          Existing saved Muster Roll entries will stay visible, but this petty
          contractor will no longer be available in new dropdown selections.
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
            {isDeleting ? "Deleting Contractor..." : "Delete Petty Contractor"}
          </button>
        </div>
      </div>
    </div>
  );
}

type GenerateMusterRollDialogProps = {
  isOpen: boolean;
  projectName: string;
  entryCount: number;
  pettyContractorCount: number;
  reportMonthValue: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onReportMonthChange: (value: string) => void;
};

function GenerateMusterRollDialog({
  isOpen,
  projectName,
  entryCount,
  pettyContractorCount,
  reportMonthValue,
  onClose,
  onSubmit,
  onReportMonthChange,
}: GenerateMusterRollDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">Generate Muster Roll</h3>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              The report shell is ready. Next we can define the exact monthly
              report format and connect the export or printable view.
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

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <InfoTile label="Project" value={projectName} />
          <InfoTile label="Saved Entries" value={String(entryCount)} />
          <InfoTile
            label="Petty Contractors"
            value={String(pettyContractorCount)}
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Report Month" required>
            <Input
              type="month"
              value={reportMonthValue}
              onChange={(event) => onReportMonthChange(event.target.value)}
            />
          </Field>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-2xl bg-[var(--inverse-bg)] px-6 py-3 text-sm font-semibold text-[var(--inverse-fg)] transition duration-200 hover:scale-105 hover:cursor-pointer"
            >
              Prepare Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ExpandedMusterRollEntryDialogProps = {
  entry: MusterRollEntry | null;
  onClose: () => void;
};

function ExpandedMusterRollEntryDialog({
  entry,
  onClose,
}: ExpandedMusterRollEntryDialogProps) {
  if (!entry) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">
              {entry.entryType === "advance-payment"
                ? "Advance Payment"
                : "Muster Roll Entry"}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {entry.entryType === "advance-payment"
                ? "Review the recorded details for this petty contractor advance payment."
                : "Review the grouped labour rows currently saved for this entry."}
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
          <InfoTile
            label={
              entry.entryType === "advance-payment" ? "Record Date" : "Entry Date"
            }
            value={formatDate(entry.recordDate)}
          />
          <InfoTile
            label="Petty Contractor"
            value={entry.pettyContractorSummary}
          />
          {entry.entryType === "advance-payment" ? (
            <>
              <InfoTile
                label="Advance Amount"
                value={formatAccountingCurrencyInr(entry.totalAmount)}
              />
              <InfoTile label="Created By" value={entry.createdBy} />
            </>
          ) : (
            <>
              <InfoTile
                label="Regular Hours"
                value={formatNumber(entry.totalRegularHours)}
              />
              <InfoTile
                label="Overtime Hours"
                value={formatNumber(entry.totalOvertimeHours)}
              />
            </>
          )}
        </div>

        {entry.entryType === "advance-payment" ? (
          <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">
              Description
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--foreground)]">
              {entry.advancePaymentDescription || "No description added."}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {[
                      "Petty Contractor",
                      "Crew Name",
                      "Crew Type",
                      "Regular Hours",
                      "Overtime Hours",
                      "Rate",
                      "Line Total",
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
                  {entry.rows.map((row) => (
                    <tr key={row.rowId}>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {row.pettyContractorName}
                      </td>
                      <td className="px-4 py-4 font-medium">{row.crewName}</td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {row.crewType}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {formatNumber(row.regularHours)}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {formatNumber(row.overtimeHours)}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {formatCurrencyInr(row.rate)}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted)]">
                        {formatCurrencyInr(row.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCreatedAt(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function formatDate(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString();
}

function formatMonthYear(dateValue: string) {
  const date = parseDateValue(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
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

function compareDateValues(leftDateValue: string, rightDateValue: string) {
  const leftDate = parseDateValue(leftDateValue);
  const rightDate = parseDateValue(rightDateValue);

  const leftTime = Number.isNaN(leftDate.getTime()) ? 0 : leftDate.getTime();
  const rightTime = Number.isNaN(rightDate.getTime()) ? 0 : rightDate.getTime();

  return leftTime - rightTime;
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

function formatAccountingCurrencyInr(value: number) {
  if (value < 0) {
    return `(${formatCurrencyInr(Math.abs(value))})`;
  }

  return formatCurrencyInr(value);
}

function formatContractorRate(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return formatCurrencyInr(value);
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
        d="M9 5H5v4M15 5h4v4M19 15v4h-4M5 15v4h4"
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

function DuplicateIcon() {
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
        d="M8 8h10v10H8zM6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
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

