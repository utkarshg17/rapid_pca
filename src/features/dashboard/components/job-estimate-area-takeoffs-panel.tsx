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
import { deleteJobEstimateAreaTakeoff } from "@/features/dashboard/services/delete-job-estimate-area-takeoff";
import { getJobEstimateAreaTakeoffs } from "@/features/dashboard/services/get-job-estimate-area-takeoffs";
import { getRoomTypeOptions } from "@/features/dashboard/services/get-room-type-options";
import { saveJobEstimateAreaTakeoff } from "@/features/dashboard/services/save-job-estimate-area-takeoff";
import type {
  JobEstimate,
  JobEstimateAreaTakeoff,
  RoomTypeOption,
} from "@/features/dashboard/types/job-estimate";

type AreaTakeoffRow = {
  id: number;
  roomType: string;
  area: string;
  unit: string;
  floorFinish: string;
  isPersisted: boolean;
};

type JobEstimateAreaTakeoffsPanelProps = {
  estimate: JobEstimate;
};

const defaultRowCount = 10;

export function JobEstimateAreaTakeoffsPanel({
  estimate,
}: JobEstimateAreaTakeoffsPanelProps) {
  const [rows, setRows] = useState<AreaTakeoffRow[]>(createDefaultRows());
  const [roomTypeOptions, setRoomTypeOptions] = useState<RoomTypeOption[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [isLoadingRoomTypes, setIsLoadingRoomTypes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const loadAreaTakeoffs = useCallback(async () => {
    setIsLoadingRows(true);

    try {
      const savedRows = await getJobEstimateAreaTakeoffs(estimate.id);
      setRows(buildInitialRows(savedRows));
      setSaveErrorMessage("");
      setSaveStatusMessage("");
    } catch (error) {
      console.error("Failed to load area takeoffs:", error);
      setRows(createDefaultRows());
    } finally {
      setIsLoadingRows(false);
    }
  }, [estimate.id]);

  useEffect(() => {
    loadAreaTakeoffs();
  }, [loadAreaTakeoffs]);

  useEffect(() => {
    let isMounted = true;

    async function loadRoomTypes() {
      setIsLoadingRoomTypes(true);

      try {
        const options = await getRoomTypeOptions();

        if (!isMounted) {
          return;
        }

        setRoomTypeOptions(options);
      } catch (error) {
        console.error("Failed to load room type options:", error);

        if (isMounted) {
          setRoomTypeOptions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRoomTypes(false);
        }
      }
    }

    loadRoomTypes();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeRowCount = useMemo(
    () =>
      rows.filter(
        (row) => row.roomType.trim() || row.area.trim() || row.floorFinish.trim()
      ).length,
    [rows]
  );
  const totalArea = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const parsedArea = Number.parseFloat(row.area);
        return sum + (Number.isFinite(parsedArea) ? parsedArea : 0);
      }, 0),
    [rows]
  );

  function handleRowChange(
    rowId: number,
    key: keyof Pick<AreaTakeoffRow, "roomType" | "area" | "floorFinish">,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  }

  function handleAddRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
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
        await deleteJobEstimateAreaTakeoff(row.id);
        setRows((prev) => {
          const nextRows = prev.filter((candidate) => candidate.id !== rowId);
          return nextRows.length === 0 ? createDefaultRows() : nextRows;
        });
        setSaveStatusMessage(`Deleted at ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        console.error(error);
        setSaveErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to delete area takeoff row."
        );
        setSaveStatusMessage("");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    setRows((prev) => {
      const nextRows = prev.filter((candidate) => candidate.id !== rowId);
      return nextRows.length === 0 ? createDefaultRows() : nextRows;
    });
  }

  async function persistRow(
    rowId: number,
    overrides?: Partial<Pick<AreaTakeoffRow, "roomType" | "area" | "floorFinish">>
  ) {
    const existingRow = rows.find((candidate) => candidate.id === rowId);

    if (!existingRow) {
      return;
    }

    const nextRow = { ...existingRow, ...overrides };
    const hasContent =
      nextRow.roomType.trim() ||
      nextRow.area.trim() ||
      nextRow.floorFinish.trim();

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
      const savedRow = await saveJobEstimateAreaTakeoff({
        id: nextRow.isPersisted ? nextRow.id : undefined,
        jobEstimateId: estimate.id,
        roomType: nextRow.roomType,
        area: nextRow.area,
        unit: "sq.ft",
        floorFinish: nextRow.floorFinish,
      });

      setRows((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                id: savedRow.id,
                roomType: savedRow.roomType,
                area: savedRow.area,
                unit: savedRow.unit,
                floorFinish: savedRow.floorFinish,
                isPersisted: true,
              }
            : row
        )
      );
      setSaveStatusMessage(`Saved at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error(error);
      setSaveErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save area takeoff row."
      );
      setSaveStatusMessage("");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingRows) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6 text-[var(--foreground)]">
        Loading area takeoffs...
      </section>
    );
  }

  return (
    <section className="space-y-6 text-[var(--foreground)]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
              Area Takeoffs
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Room Area Takeoffs</h2>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Break down the project by room type, area, and floor finish so the
              estimator can give the AI a clearer sense of the building program.
              Each row saves as the user finishes editing it.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile label="Total Area" value={`${formatArea(totalArea)} sq.ft`} />
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
            <h3 className="text-lg font-semibold">Area Takeoff Table</h3>
            <p className="text-sm text-[var(--muted)]">
              Start with the default rows below and add more whenever you need them.
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
                {[
                  "S.No.",
                  "Room Type",
                  "Area",
                  "Unit",
                  "Floor Finish",
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
              {rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-[var(--muted)]">
                    {index + 1}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <RoomTypeAutocompleteInput
                      value={row.roomType}
                      roomTypeOptions={roomTypeOptions}
                      isLoadingRoomTypes={isLoadingRoomTypes}
                      onChange={(value) =>
                        handleRowChange(row.id, "roomType", value)
                      }
                      onCommit={(value) =>
                        void persistRow(row.id, { roomType: value })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <Input
                      value={row.area}
                      onChange={(event) =>
                        handleRowChange(row.id, "area", event.target.value)
                      }
                      onBlur={() => void persistRow(row.id)}
                      inputMode="decimal"
                      placeholder="Enter area"
                      className="h-10 rounded-xl px-3 py-2 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">sq.ft</td>
                  <td className="px-4 py-2 align-top">
                    <AutoResizingTextarea
                      value={row.floorFinish}
                      onChange={(event) =>
                        handleRowChange(row.id, "floorFinish", event.target.value)
                      }
                      onBlur={() => void persistRow(row.id)}
                      placeholder="Enter floor finish"
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
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {saveErrorMessage}
        </div>
      ) : null}
    </section>
  );
}

type RoomTypeAutocompleteInputProps = {
  value: string;
  roomTypeOptions: RoomTypeOption[];
  isLoadingRoomTypes: boolean;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
};

function RoomTypeAutocompleteInput({
  value,
  roomTypeOptions,
  isLoadingRoomTypes,
  onChange,
  onCommit,
}: RoomTypeAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const visibleOptions = useMemo(() => {
    const normalizedValue = normalizeValue(value).toLowerCase();
    const matches = roomTypeOptions.filter((option) => {
      if (!normalizedValue) {
        return true;
      }

      return option.room_name.toLowerCase().includes(normalizedValue);
    });

    return matches
      .sort((left, right) => {
        const leftStartsWith = normalizedValue
          ? left.room_name.toLowerCase().startsWith(normalizedValue)
          : false;
        const rightStartsWith = normalizedValue
          ? right.room_name.toLowerCase().startsWith(normalizedValue)
          : false;

        return (
          Number(rightStartsWith) - Number(leftStartsWith) ||
          left.room_name.localeCompare(right.room_name)
        );
      })
      .slice(0, 8);
  }, [roomTypeOptions, value]);
  const activeHighlightedIndex =
    visibleOptions.length === 0
      ? 0
      : Math.min(highlightedIndex, visibleOptions.length - 1);

  function handleSelect(option: RoomTypeOption) {
    onChange(option.room_name);
    onCommit(option.room_name);
    setIsOpen(false);
    setHighlightedIndex(0);
  }

  return (
    <div className="relative">
      <Input
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
          onCommit(value);
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
              handleSelect(
                visibleOptions[activeHighlightedIndex] ?? visibleOptions[0]
              );
            }
          }
        }}
        placeholder={
          isLoadingRoomTypes
            ? "Loading room types..."
            : roomTypeOptions.length === 0
              ? "No room types available"
              : "Type to search room types"
        }
        className="h-10 rounded-xl px-3 py-2 text-xs"
      />

      {isOpen && !isLoadingRoomTypes && visibleOptions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
          <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
            {visibleOptions.map((option, index) => (
              <li key={option.id}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className={[
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition duration-150",
                    activeHighlightedIndex === index
                      ? "bg-[var(--surface)] text-[var(--foreground)]"
                      : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--surface)]",
                  ].join(" ")}
                >
                  <span className="font-medium">{option.room_name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
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
function buildInitialRows(savedRows: JobEstimateAreaTakeoff[]) {
  const persistedRows = savedRows.map((row) => ({
    id: row.id,
    roomType: row.roomType,
    area: row.area,
    unit: row.unit || "sq.ft",
    floorFinish: row.floorFinish,
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

function createEmptyRow(): AreaTakeoffRow {
  return {
    id: -1 * (Date.now() * 1000 + Math.floor(Math.random() * 1000)),
    roomType: "",
    area: "",
    unit: "sq.ft",
    floorFinish: "",
    isPersisted: false,
  };
}

function normalizeValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

