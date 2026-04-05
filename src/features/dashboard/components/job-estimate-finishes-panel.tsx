"use client";

import {
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { deleteJobEstimateFinish } from "@/features/dashboard/services/delete-job-estimate-finish";
import { getJobEstimateFinishes } from "@/features/dashboard/services/get-job-estimate-finishes";
import { saveJobEstimateFinish } from "@/features/dashboard/services/save-job-estimate-finish";
import type {
  JobEstimate,
  JobEstimateFinish,
} from "@/features/dashboard/types/job-estimate";

const finishTypeOptions = [
  "Exterior Plaster",
  "Interior Plaster",
  "Exterior Paint",
  "Interior Paint",
  "Exterior Brickwork",
  "Interior Brickwork",
] as const;

const defaultRowCount = 5;

type FinishRow = {
  id: number;
  finishType: string;
  description: string;
  isPersisted: boolean;
};

type JobEstimateFinishesPanelProps = {
  estimate: JobEstimate;
};

export function JobEstimateFinishesPanel({
  estimate,
}: JobEstimateFinishesPanelProps) {
  const [rows, setRows] = useState<FinishRow[]>(createDefaultRows());
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const loadFinishes = useCallback(async () => {
    setIsLoadingRows(true);

    try {
      const savedRows = await getJobEstimateFinishes(estimate.id);
      setRows(buildInitialRows(savedRows));
      setSaveErrorMessage("");
      setSaveStatusMessage("");
    } catch (error) {
      console.error("Failed to load finishes:", error);
      setRows(createDefaultRows());
    } finally {
      setIsLoadingRows(false);
    }
  }, [estimate.id]);

  useEffect(() => {
    loadFinishes();
  }, [loadFinishes]);

  const activeRowCount = useMemo(
    () =>
      rows.filter((row) => row.finishType.trim() || row.description.trim()).length,
    [rows]
  );

  function handleRowChange(
    rowId: number,
    key: keyof Pick<FinishRow, "finishType" | "description">,
    value: string
  ) {
    setRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId ? { ...row, [key]: value } : row
      )
    );
  }

  function handleAddRow() {
    setRows((previousRows) => [...previousRows, createEmptyRow()]);
  }

  async function handleDeleteRow(rowId: number) {
    const row = rows.find((candidate) => candidate.id === rowId);

    if (!row) {
      return;
    }

    if (row.isPersisted) {
      setIsSaving(true);
      setSaveErrorMessage("");
      setSaveStatusMessage("Deleting row...");

      try {
        await deleteJobEstimateFinish(row.id);
        setRows((previousRows) => {
          const nextRows = previousRows.filter(
            (candidate) => candidate.id !== rowId
          );
          return nextRows.length === 0 ? createDefaultRows() : nextRows;
        });
        setSaveStatusMessage(`Deleted at ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error(error);
        setSaveErrorMessage(
          error instanceof Error ? error.message : "Failed to delete finish row."
        );
        setSaveStatusMessage("");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    setRows((previousRows) => {
      const nextRows = previousRows.filter((candidate) => candidate.id !== rowId);
      return nextRows.length === 0 ? createDefaultRows() : nextRows;
    });
  }

  async function persistRow(
    rowId: number,
    overrides?: Partial<Pick<FinishRow, "finishType" | "description">>
  ) {
    const existingRow = rows.find((candidate) => candidate.id === rowId);

    if (!existingRow) {
      return;
    }

    const nextRow = { ...existingRow, ...overrides };
    const hasContent = nextRow.finishType.trim() || nextRow.description.trim();

    if (!hasContent) {
      if (nextRow.isPersisted) {
        await handleDeleteRow(rowId);
      }
      return;
    }

    setIsSaving(true);
    setSaveErrorMessage("");
    setSaveStatusMessage("Saving changes...");

    try {
      const savedRow = await saveJobEstimateFinish({
        id: nextRow.isPersisted ? nextRow.id : undefined,
        jobEstimateId: estimate.id,
        finishType: nextRow.finishType,
        description: nextRow.description,
      });

      setRows((previousRows) =>
        previousRows.map((row) =>
          row.id === rowId
            ? {
                id: savedRow.id,
                finishType: savedRow.finishType,
                description: savedRow.description,
                isPersisted: true,
              }
            : row
        )
      );
      setSaveStatusMessage(`Saved at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error(error);
      setSaveErrorMessage(
        error instanceof Error ? error.message : "Failed to save finish row."
      );
      setSaveStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingRows) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
        Loading finishes...
      </section>
    );
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Finishes
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Key Finishing Inputs</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Capture the high-level finish descriptions the estimator wants the AI to
              consider. Each row saves as the user finishes editing it.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile label="Active Rows" value={String(activeRowCount)} />
            <InfoTile
              label="Status"
              value={isSaving ? "Saving..." : saveStatusMessage || "Ready"}
            />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Finishes Table</h3>
            <p className="text-sm text-[var(--muted)]">
              Use this to define the finish descriptions the estimator wants the AI
              to consider for this estimate.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddRow}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
          >
            Add Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
            <thead className="bg-[var(--surface)]">
              <tr>
                {["S.No.", "Finish Type", "Description", "Action"].map((heading) => (
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
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-[var(--muted)]">
                    {index + 1}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <select
                      value={row.finishType}
                      onChange={(event) => {
                        handleRowChange(row.id, "finishType", event.target.value);
                        void persistRow(row.id, { finishType: event.target.value });
                      }}
                      className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-xs text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]"
                    >
                      <option value="">Select finish type</option>
                      {finishTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 align-top">
                    <AutoResizingTextarea
                      value={row.description}
                      onChange={(event) =>
                        handleRowChange(row.id, "description", event.target.value)
                      }
                      onBlur={() => void persistRow(row.id)}
                      placeholder="Enter finish description"
                      className="min-h-[2.5rem] rounded-xl px-3 py-2 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => void handleDeleteRow(row.id)}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {saveErrorMessage ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
          {saveErrorMessage}
        </div>
      ) : null}
    </section>
  );
}

type AutoResizingTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

function AutoResizingTextarea({ className, value, ...props }: AutoResizingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      rows={1}
      className={[
        "w-full resize-none overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)] outline-none placeholder:text-[var(--placeholder)] focus:border-[var(--border-strong)]",
        className ?? "",
      ].join(" ")}
      {...props}
    />
  );
}

function buildInitialRows(savedRows: JobEstimateFinish[]) {
  const persistedRows = savedRows.map((row) => ({
    id: row.id,
    finishType: row.finishType,
    description: row.description,
    isPersisted: true,
  }));

  if (persistedRows.length >= defaultRowCount) {
    return persistedRows;
  }

  return [
    ...persistedRows,
    ...createDefaultRows(defaultRowCount - persistedRows.length),
  ];
}

function createDefaultRows(count = defaultRowCount) {
  return Array.from({ length: count }, () => createEmptyRow());
}

function createEmptyRow(): FinishRow {
  return {
    id: -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000)),
    finishType: "",
    description: "",
    isPersisted: false,
  };
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
