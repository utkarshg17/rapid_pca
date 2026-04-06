"use client";

import {
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";
import { deleteJobEstimateOpening } from "@/features/dashboard/services/delete-job-estimate-opening";
import { getJobEstimateOpenings } from "@/features/dashboard/services/get-job-estimate-openings";
import { saveJobEstimateOpening } from "@/features/dashboard/services/save-job-estimate-opening";
import type {
  JobEstimate,
  JobEstimateOpening,
  JobEstimateOpeningType,
} from "@/features/dashboard/types/job-estimate";

type OpeningRow = {
  id: number;
  openingType: JobEstimateOpeningType;
  openingName: string;
  height: string;
  width: string;
  unit: string;
  quantity: string;
  description: string;
  isPersisted: boolean;
  sortOrder: number;
};

type JobEstimateOpeningsPanelProps = {
  estimate: JobEstimate;
};

const openingTypes: JobEstimateOpeningType[] = [
  "Door",
  "Window",
  "Ventilator",
  "Facade",
];
const defaultRowCountPerSection = 5;
const sqFtInSquareMillimeters = 92903.04;

export function JobEstimateOpeningsPanel({
  estimate,
}: JobEstimateOpeningsPanelProps) {
  const [rows, setRows] = useState<OpeningRow[]>(createDefaultRows());
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const loadOpenings = useCallback(async () => {
    setIsLoadingRows(true);

    try {
      const savedRows = await getJobEstimateOpenings(estimate.id);
      setRows(buildInitialRows(savedRows));
      setSaveErrorMessage("");
      setSaveStatusMessage("");
    } catch (error) {
      console.error("Failed to load openings:", error);
      setRows(createDefaultRows());
    } finally {
      setIsLoadingRows(false);
    }
  }, [estimate.id]);

  useEffect(() => {
    loadOpenings();
  }, [loadOpenings]);

  const activeRowCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.openingName.trim() ||
          row.height.trim() ||
          row.width.trim() ||
          row.quantity.trim() ||
          row.description.trim()
      ).length,
    [rows]
  );

  const totalOpeningAreaSqft = useMemo(
    () =>
      rows.reduce(
        (sum, row) => sum + calculateOpeningAreaSqft(row.height, row.width, row.quantity),
        0
      ),
    [rows]
  );

  function handleRowChange(
    rowId: number,
    key: keyof Pick<OpeningRow, "openingName" | "height" | "width" | "quantity" | "description">,
    value: string
  ) {
    setRows((previousRows) =>
      previousRows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }

  function handleAddRow(openingType: JobEstimateOpeningType) {
    setRows((previousRows) => [
      ...previousRows,
      createEmptyRow(openingType, getRowsForOpeningType(previousRows, openingType).length),
    ]);
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
        await deleteJobEstimateOpening(row.id);
        setRows((previousRows) =>
          ensureMinimumRowsByType(
            previousRows.filter((candidate) => candidate.id !== rowId)
          )
        );
        setSaveStatusMessage(`Deleted at ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error(error);
        setSaveErrorMessage(
          error instanceof Error ? error.message : "Failed to delete opening row."
        );
        setSaveStatusMessage("");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    setRows((previousRows) =>
      ensureMinimumRowsByType(previousRows.filter((candidate) => candidate.id !== rowId))
    );
  }

  async function persistRow(
    rowId: number,
    overrides?: Partial<Pick<OpeningRow, "openingName" | "height" | "width" | "quantity" | "description">>
  ) {
    const existingRow = rows.find((candidate) => candidate.id === rowId);

    if (!existingRow) {
      return;
    }

    const nextRow = { ...existingRow, ...overrides };
    const hasContent =
      nextRow.openingName.trim() ||
      nextRow.height.trim() ||
      nextRow.width.trim() ||
      nextRow.quantity.trim() ||
      nextRow.description.trim();

    if (!hasContent) {
      if (nextRow.isPersisted) {
        await handleDeleteRow(rowId);
      }
      return;
    }

    const sectionIndex = getRowsForOpeningType(rows, nextRow.openingType).findIndex(
      (row) => row.id === rowId
    );

    setIsSaving(true);
    setSaveErrorMessage("");
    setSaveStatusMessage("Saving changes...");

    try {
      const savedRow = await saveJobEstimateOpening({
        id: nextRow.isPersisted ? nextRow.id : undefined,
        jobEstimateId: estimate.id,
        openingType: nextRow.openingType,
        openingName: nextRow.openingName,
        height: nextRow.height,
        width: nextRow.width,
        unit: "mm",
        quantity: nextRow.quantity,
        description: nextRow.description,
        sortOrder: sectionIndex >= 0 ? sectionIndex : nextRow.sortOrder,
      });

      setRows((previousRows) =>
        previousRows.map((row) =>
          row.id === rowId
            ? {
                id: savedRow.id,
                openingType: savedRow.openingType,
                openingName: savedRow.openingName,
                height: savedRow.height,
                width: savedRow.width,
                unit: savedRow.unit,
                quantity: savedRow.quantity,
                description: savedRow.description,
                isPersisted: true,
                sortOrder: savedRow.sortOrder,
              }
            : row
        )
      );
      setSaveStatusMessage(`Saved at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error(error);
      setSaveErrorMessage(
        error instanceof Error ? error.message : "Failed to save opening row."
      );
      setSaveStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingRows) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
        Loading openings...
      </section>
    );
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Openings
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Openings Schedule</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Capture the major door, window, ventilator, and facade openings so the
              estimator has a more complete understanding of the building envelope.
              Each row saves as the user finishes editing it.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile label="Active Rows" value={String(activeRowCount)} />
            <InfoTile
              label="Total Opening Area"
              value={`${formatArea(totalOpeningAreaSqft)} sq.ft`}
            />
            <InfoTile
              label="Status"
              value={isSaving ? "Saving..." : saveStatusMessage || "Ready"}
            />
          </div>
        </div>
      </div>

      {openingTypes.map((openingType) => {
        const sectionRows = getRowsForOpeningType(rows, openingType);
        const sectionArea = sectionRows.reduce(
          (sum, row) => sum + calculateOpeningAreaSqft(row.height, row.width, row.quantity),
          0
        );

        return (
          <section
            key={openingType}
            className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold">{openingType} Openings</h3>
                <p className="text-sm text-[var(--muted)]">
                  Total opening area: {formatArea(sectionArea)} sq.ft
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAddRow(openingType)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
              >
                Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border)] text-left text-sm">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {[
                      "S.No.",
                      `${openingType} Name`,
                      "Height (mm)",
                      "Width (mm)",
                      "Quantity",
                      "Total Opening Area (sq.ft)",
                      "Description",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)] whitespace-nowrap"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)]">
                  {sectionRows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-[var(--muted)]">
                        {index + 1}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Input
                          value={row.openingName}
                          onChange={(event) =>
                            handleRowChange(row.id, "openingName", event.target.value)
                          }
                          onBlur={() => void persistRow(row.id)}
                          placeholder={`Enter ${openingType.toLowerCase()} name`}
                          className="h-10 min-w-[12rem] rounded-xl px-3 py-2 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Input
                          value={row.height}
                          onChange={(event) =>
                            handleRowChange(row.id, "height", event.target.value)
                          }
                          onBlur={() => void persistRow(row.id)}
                          inputMode="decimal"
                          placeholder="Enter height"
                          className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Input
                          value={row.width}
                          onChange={(event) =>
                            handleRowChange(row.id, "width", event.target.value)
                          }
                          onBlur={() => void persistRow(row.id)}
                          inputMode="decimal"
                          placeholder="Enter width"
                          className="h-10 min-w-[8rem] rounded-xl px-3 py-2 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <Input
                          value={row.quantity}
                          onChange={(event) =>
                            handleRowChange(row.id, "quantity", event.target.value)
                          }
                          onBlur={() => void persistRow(row.id)}
                          inputMode="numeric"
                          placeholder="Enter quantity"
                          className="h-10 min-w-[7rem] rounded-xl px-3 py-2 text-xs"
                        />
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-[var(--muted)]">
                        {formatArea(
                          calculateOpeningAreaSqft(row.height, row.width, row.quantity)
                        )} sq.ft
                      </td>
                      <td className="px-4 py-2 align-top">
                        <AutoResizingTextarea
                          value={row.description}
                          onChange={(event) =>
                            handleRowChange(row.id, "description", event.target.value)
                          }
                          onBlur={() => void persistRow(row.id)}
                          placeholder="Enter description"
                          className="min-h-[2.5rem] min-w-[14rem] rounded-xl px-3 py-2 text-xs"
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
        );
      })}

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

function buildInitialRows(savedRows: JobEstimateOpening[]) {
  return ensureMinimumRowsByType(
    savedRows.map((row) => ({
      id: row.id,
      openingType: row.openingType,
      openingName: row.openingName,
      height: row.height,
      width: row.width,
      unit: row.unit || "mm",
      quantity: row.quantity,
      description: row.description,
      isPersisted: true,
      sortOrder: row.sortOrder,
    }))
  );
}

function createDefaultRows() {
  return openingTypes.flatMap((openingType) =>
    Array.from({ length: defaultRowCountPerSection }, (_, index) =>
      createEmptyRow(openingType, index)
    )
  );
}

function ensureMinimumRowsByType(rows: OpeningRow[]) {
  return openingTypes.flatMap((openingType) => {
    const sectionRows = getRowsForOpeningType(rows, openingType).sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id - right.id
    );

    if (sectionRows.length >= defaultRowCountPerSection) {
      return sectionRows.map((row, index) => ({ ...row, sortOrder: index }));
    }

    return [
      ...sectionRows.map((row, index) => ({ ...row, sortOrder: index })),
      ...Array.from(
        { length: defaultRowCountPerSection - sectionRows.length },
        (_, index) => createEmptyRow(openingType, sectionRows.length + index)
      ),
    ];
  });
}

function createEmptyRow(
  openingType: JobEstimateOpeningType,
  sortOrder = 0
): OpeningRow {
  return {
    id: -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000)),
    openingType,
    openingName: "",
    height: "",
    width: "",
    unit: "mm",
    quantity: "",
    description: "",
    isPersisted: false,
    sortOrder,
  };
}

function getRowsForOpeningType(rows: OpeningRow[], openingType: JobEstimateOpeningType) {
  return rows.filter((row) => row.openingType === openingType);
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim();
  const parsed = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateOpeningAreaSqft(height: string, width: string, quantity: string) {
  const parsedHeight = parseOptionalNumber(height);
  const parsedWidth = parseOptionalNumber(width);
  const parsedQuantity = parseOptionalNumber(quantity);

  if (parsedHeight <= 0 || parsedWidth <= 0 || parsedQuantity <= 0) {
    return 0;
  }

  return (parsedHeight * parsedWidth * parsedQuantity) / sqFtInSquareMillimeters;
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

function formatArea(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

