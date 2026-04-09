
"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/features/auth/services/get-current-user-profile";
import {
  createSiteInventoryTransaction,
  deleteSiteInventoryItem,
  deleteSiteInventorySource,
  deleteSiteInventoryTransaction,
  getSiteInventoryBalances,
  getSiteInventoryItems,
  getSiteInventorySources,
  getSiteInventoryTransactions,
  saveSiteInventoryItem,
  saveSiteInventorySource,
  updateSiteInventoryTransaction,
} from "@/features/dashboard/services/site-inventory";
import type {
  SiteInventoryBalance,
  SiteInventoryItem,
  SiteInventorySource,
  SiteInventorySourceType,
  SiteInventoryTransaction,
  SiteInventoryUnit,
} from "@/features/dashboard/types/site-inventory";

const inventoryUnits: SiteInventoryUnit[] = ["Bags", "cu.m", "sq.ft", "count", "litre", "kg", "ton"];
const inventoryItemCategories = [
  "Fixed Asset",
  "Consumable Asset",
  "Fixed-Consumable Asset",
] as const;
const sourceTypes: SiteInventorySourceType[] = ["Site", "Supplier", "Other"];

type SiteInventoryWorkspaceProps = {
  profile: UserProfile | null;
};

type InventoryTab = "logs" | "inventory";
type InventoryViewMode = "site" | "item";

type TransactionLineDraft = {
  id: number;
  fromSourceId: string;
  toSourceId: string;
  itemId: string;
  quantity: string;
  unit: SiteInventoryUnit;
  challanBillNo: string;
  vehicleNumber: string;
  remarks: string;
};

const createEmptyLine = (index = 0): TransactionLineDraft => ({
  id: Date.now() + index,
  fromSourceId: "",
  toSourceId: "",
  itemId: "",
  quantity: "",
  unit: "count",
  challanBillNo: "",
  vehicleNumber: "",
  remarks: "",
});

function createDefaultLines() {
  return Array.from({ length: 5 }, (_, index) => createEmptyLine(index));
}

export function SiteInventoryWorkspace({ profile }: SiteInventoryWorkspaceProps) {
  const [sources, setSources] = useState<SiteInventorySource[]>([]);
  const [items, setItems] = useState<SiteInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<SiteInventoryTransaction[]>([]);
  const [balances, setBalances] = useState<SiteInventoryBalance[]>([]);
  const [activeTab, setActiveTab] = useState<InventoryTab>("logs");
  const [inventoryViewMode, setInventoryViewMode] =
    useState<InventoryViewMode>("site");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSourceDialogOpen, setIsSourceDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(
    null
  );
  const [isDeletingTransactionId, setIsDeletingTransactionId] = useState<
    number | null
  >(null);
  const [transactionDate, setTransactionDate] = useState(getTodayInputValue());
  const [lineDrafts, setLineDrafts] =
    useState<TransactionLineDraft[]>(createDefaultLines);
  const [isPostingTransaction, setIsPostingTransaction] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const createdByName = useMemo(() => buildUserName(profile), [profile]);
  const siteSources = useMemo(
    () => sources.filter((source) => source.sourceType === "Site" && source.isActive),
    [sources]
  );
  const activeSources = useMemo(
    () => sources.filter((source) => source.isActive),
    [sources]
  );
  const activeItems = useMemo(
    () => items.filter((item) => item.isActive),
    [items]
  );

  const refreshInventory = useCallback(async () => {
    setIsLoading(true);

    try {
      const [loadedSources, loadedItems, loadedTransactions, loadedBalances] =
        await Promise.all([
          getSiteInventorySources(),
          getSiteInventoryItems(),
          getSiteInventoryTransactions(),
          getSiteInventoryBalances(),
        ]);

      setSources(loadedSources);
      setItems(loadedItems);
      setTransactions(loadedTransactions);
      setBalances(loadedBalances);
      setErrorMessage("");
    } catch (error) {
      console.error("Failed to load site inventory workspace:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load site inventory."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  useEffect(() => {
    if (!selectedSiteId && siteSources.length > 0) {
      setSelectedSiteId(String(siteSources[0].id));
    }
  }, [selectedSiteId, siteSources]);

  useEffect(() => {
    if (!selectedItemId && activeItems.length > 0) {
      setSelectedItemId(String(activeItems[0].id));
    }
  }, [activeItems, selectedItemId]);

  const balancesForSelectedSite = useMemo(
    () =>
      balances.filter((balance) => String(balance.siteSourceId) === selectedSiteId),
    [balances, selectedSiteId]
  );

  const balancesForSelectedItem = useMemo(
    () => balances.filter((balance) => String(balance.itemId) === selectedItemId),
    [balances, selectedItemId]
  );

  function handleLineChange(
    rowId: number,
    key: keyof Omit<TransactionLineDraft, "id">,
    value: string
  ) {
    setLineDrafts((previousRows) =>
      previousRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (key === "itemId") {
          const selectedItem = items.find((item) => String(item.id) === value);
          return {
            ...row,
            itemId: value,
            unit: selectedItem?.defaultUnit ?? row.unit,
          };
        }

        if (key === "unit") {
          return { ...row, unit: value as SiteInventoryUnit };
        }

        return { ...row, [key]: value };
      })
    );
  }

  function handleAddLine() {
    setLineDrafts((previousRows) => [
      ...previousRows,
      createEmptyLine(previousRows.length),
    ]);
  }

  function handleDeleteLine(rowId: number) {
    setLineDrafts((previousRows) => {
      const nextRows = previousRows.filter((row) => row.id !== rowId);
      return nextRows.length > 0 ? nextRows : [createEmptyLine()];
    });
  }


  function resetLogComposer() {
    setEditingTransactionId(null);
    setTransactionDate(getTodayInputValue());
    setLineDrafts(createDefaultLines());
  }

  function handleOpenCreateLogDialog() {
    setErrorMessage("");
    setStatusMessage("");
    resetLogComposer();
    setIsLogDialogOpen(true);
  }

  function handleCloseLogDialog() {
    setIsLogDialogOpen(false);
    resetLogComposer();
  }

  function handleEditTransaction(transaction: SiteInventoryTransaction) {
    setErrorMessage("");
    setStatusMessage("");
    setEditingTransactionId(transaction.id);
    setTransactionDate(transaction.transactionDate || getTodayInputValue());
    setLineDrafts(
      transaction.lines.length > 0
        ? transaction.lines.map((line, index) => ({
            id: Date.now() + index,
            fromSourceId: String(transaction.fromSourceId),
            toSourceId: String(transaction.toSourceId),
            itemId: String(line.itemId),
            quantity: String(line.quantity),
            unit: line.unit,
            challanBillNo: transaction.challanBillNo,
            vehicleNumber: transaction.vehicleNumber,
            remarks: line.remarks || transaction.remarks,
          }))
        : [createEmptyLine()]
    );
    setIsLogDialogOpen(true);
  }

  async function handleDeleteTransaction(transactionId: number) {
    const shouldDelete = window.confirm(
      "Delete this inventory movement? This will also update the site balances."
    );

    if (!shouldDelete) {
      return;
    }

    setErrorMessage("");
    setStatusMessage("");
    setIsDeletingTransactionId(transactionId);

    try {
      await deleteSiteInventoryTransaction(transactionId);

      if (editingTransactionId === transactionId) {
        handleCloseLogDialog();
      }

      setStatusMessage(`Inventory movement deleted at ${new Date().toLocaleTimeString()}`);
      await refreshInventory();
    } catch (error) {
      console.error("Failed to delete inventory transaction:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete inventory movement."
      );
    } finally {
      setIsDeletingTransactionId(null);
    }
  }
  async function handlePostTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");

    const touchedLines = lineDrafts.filter((line) => isTransactionLineTouched(line));

    if (touchedLines.length === 0) {
      setErrorMessage("Add at least one item with a quantity greater than zero.");
      return;
    }

    const validLines = touchedLines.map((line, index) => ({
      rowNumber: index + 1,
      fromSourceId: Number(line.fromSourceId),
      toSourceId: Number(line.toSourceId),
      itemId: Number(line.itemId),
      quantity: parseInventoryNumber(line.quantity),
      unit: line.unit,
      challanBillNo: line.challanBillNo,
      vehicleNumber: line.vehicleNumber,
      remarks: line.remarks,
    }));

    const incompleteLine = validLines.find(
      (line) =>
        !line.fromSourceId ||
        !line.toSourceId ||
        !line.itemId ||
        line.quantity <= 0
    );

    if (incompleteLine) {
      setErrorMessage(
        `Complete From, To, Item, and Qty for row ${incompleteLine.rowNumber}.`
      );
      return;
    }

    const sameSourceLine = validLines.find(
      (line) => line.fromSourceId === line.toSourceId
    );

    if (sameSourceLine) {
      setErrorMessage(
        `From and To sources cannot be the same on row ${sameSourceLine.rowNumber}.`
      );
      return;
    }

    setIsPostingTransaction(true);
    setStatusMessage(editingTransactionId ? "Saving inventory movement..." : "Posting inventory movements...");

    try {
      if (editingTransactionId) {
        const headerLine = validLines[0];
        const mismatchedHeaderLine = validLines.find(
          (line) =>
            line.fromSourceId !== headerLine.fromSourceId ||
            line.toSourceId !== headerLine.toSourceId ||
            line.challanBillNo !== headerLine.challanBillNo ||
            line.vehicleNumber !== headerLine.vehicleNumber ||
            line.remarks !== headerLine.remarks
        );

        if (mismatchedHeaderLine) {
          setErrorMessage(
            "While editing one saved movement, all rows must use the same From, To, Challan / Bill, Vehicle, and Remarks."
          );
          setStatusMessage("");
          return;
        }

        await updateSiteInventoryTransaction({
          transactionId: editingTransactionId,
          transactionDate,
          fromSourceId: headerLine.fromSourceId,
          toSourceId: headerLine.toSourceId,
          challanBillNo: headerLine.challanBillNo,
          vehicleNumber: headerLine.vehicleNumber,
          remarks: headerLine.remarks,
          lines: validLines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            unit: line.unit,
            remarks: line.remarks,
          })),
        });

        handleCloseLogDialog();
        setStatusMessage(`Inventory movement updated at ${new Date().toLocaleTimeString()}`);
      } else {
        for (const line of validLines) {
          await createSiteInventoryTransaction({
            transactionDate,
            fromSourceId: line.fromSourceId,
            toSourceId: line.toSourceId,
            challanBillNo: line.challanBillNo,
            vehicleNumber: line.vehicleNumber,
            remarks: line.remarks,
            createdById: getInventoryCreatedById(profile),
            createdByName,
            lines: [
              {
                itemId: line.itemId,
                quantity: line.quantity,
                unit: line.unit,
                remarks: line.remarks,
              },
            ],
          });
        }

        handleCloseLogDialog();
        setStatusMessage(
          `Posted ${validLines.length} movement${
            validLines.length === 1 ? "" : "s"
          } at ${new Date().toLocaleTimeString()}`
        );
      }

      await refreshInventory();
    } catch (error) {
      console.error("Failed to post inventory transaction:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save inventory movement."
      );
      setStatusMessage("");
    } finally {
      setIsPostingTransaction(false);
    }
  }
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-8 text-[var(--foreground)]">
        Loading site inventory...
      </section>
    );
  }

  return (
    <>
      <section className="space-y-6 text-[var(--foreground)]">
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href="/dashboard"
                className="inline-flex text-xs uppercase tracking-[0.22em] text-[var(--subtle)] transition duration-200 hover:text-[var(--foreground)]"
              >
                Back To Dashboard
              </Link>
              <h1 className="mt-4 text-3xl font-semibold">Site Inventory</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                Record supplier receipts and site-to-site transfers, then review the
                current stock available at each active site.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsSourceDialogOpen(true)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-5 py-3 text-sm font-semibold transition duration-200 hover:scale-105 hover:cursor-pointer hover:border-[var(--border-strong)]"
              >
                Manage Sources
              </button>
              <button
                type="button"
                onClick={() => setIsItemDialogOpen(true)}
                className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
              >
                Manage Items
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-lg)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <TabButton
              label="Inventory Logs"
              isActive={activeTab === "logs"}
              onClick={() => setActiveTab("logs")}
            />
            <TabButton
              label="Actual Inventory"
              isActive={activeTab === "inventory"}
              onClick={() => setActiveTab("inventory")}
            />
          </div>

          {activeTab === "logs" ? (
            <button
              type="button"
              onClick={handleOpenCreateLogDialog}
              className="rounded-2xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500"
            >
              Add Inventory Log
            </button>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <InventoryLogsPanel
            sources={activeSources}
            items={activeItems}
            transactions={transactions}
            transactionDate={transactionDate}
            lineDrafts={lineDrafts}
            isLogDialogOpen={isLogDialogOpen}
            isPostingTransaction={isPostingTransaction}
            statusMessage={statusMessage}
            onTransactionDateChange={setTransactionDate}
            onLineChange={handleLineChange}
            onAddLine={handleAddLine}
            onDeleteLine={handleDeleteLine}
            editingTransactionId={editingTransactionId}
            isDeletingTransactionId={isDeletingTransactionId}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onCloseLogDialog={handleCloseLogDialog}
            onSubmit={handlePostTransaction}
          />
        ) : (
          <ActualInventoryPanel
            sites={siteSources}
            items={activeItems}
            balances={balances}
            inventoryViewMode={inventoryViewMode}
            selectedSiteId={selectedSiteId}
            selectedItemId={selectedItemId}
            balancesForSelectedSite={balancesForSelectedSite}
            balancesForSelectedItem={balancesForSelectedItem}
            transactions={transactions}
            onInventoryViewModeChange={setInventoryViewMode}
            onSelectedSiteIdChange={setSelectedSiteId}
            onSelectedItemIdChange={setSelectedItemId}
          />
        )}
      </section>

      <SourceManagerDialog
        isOpen={isSourceDialogOpen}
        sources={sources}
        profile={profile}
        createdByName={createdByName}
        onClose={() => setIsSourceDialogOpen(false)}
        onRefresh={refreshInventory}
      />
      <ItemManagerDialog
        isOpen={isItemDialogOpen}
        items={items}
        profile={profile}
        createdByName={createdByName}
        onClose={() => setIsItemDialogOpen(false)}
        onRefresh={refreshInventory}
      />
    </>
  );
}

type InventoryLogsPanelProps = {
  sources: SiteInventorySource[];
  items: SiteInventoryItem[];
  transactions: SiteInventoryTransaction[];
  transactionDate: string;
  lineDrafts: TransactionLineDraft[];
  isLogDialogOpen: boolean;
  isPostingTransaction: boolean;
  statusMessage: string;
  editingTransactionId: number | null;
  isDeletingTransactionId: number | null;
  onTransactionDateChange: (value: string) => void;
  onLineChange: (
    rowId: number,
    key: keyof Omit<TransactionLineDraft, "id">,
    value: string
  ) => void;
  onAddLine: () => void;
  onDeleteLine: (rowId: number) => void;
  onEditTransaction: (transaction: SiteInventoryTransaction) => void;
  onDeleteTransaction: (transactionId: number) => Promise<void>;
  onCloseLogDialog: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function InventoryLogsPanel({
  sources,
  items,
  transactions,
  transactionDate,
  lineDrafts,
  isLogDialogOpen,
  isPostingTransaction,
  statusMessage,
  editingTransactionId,
  isDeletingTransactionId,
  onTransactionDateChange,
  onLineChange,
  onAddLine,
  onDeleteLine,
  onEditTransaction,
  onDeleteTransaction,
  onCloseLogDialog,
  onSubmit,
}: InventoryLogsPanelProps) {
  return (
    <div className="space-y-6">
      {isLogDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6"
          onClick={onCloseLogDialog}
        >
          <section
            className="max-h-[90vh] w-full max-w-[96vw] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
                  {editingTransactionId ? "Edit Movement" : "New Movement"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {editingTransactionId ? "Edit Inventory Log" : "Add Inventory Log"}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                  Supplier-to-site entries add stock to the receiving site. Site-to-site
                  transfers subtract from the origin site and add to the destination site.
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseLogDialog}
                disabled={isPostingTransaction}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div className="max-w-sm">
                <Field label="Transaction Date" required>
                  <Input
                    type="date"
                    value={transactionDate}
                    onChange={(event) => onTransactionDateChange(event.target.value)}
                  />
                </Field>
              </div>

              <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
                  <div>
                    <h4 className="text-lg font-semibold">Inventory Rows</h4>
                    <p className="text-sm text-[var(--muted)]">
                      Each filled row posts as its own movement, so From, To, challan,
                      vehicle, and remarks can differ row by row.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onAddLine}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                  >
                    Add Row
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1650px] table-fixed border-collapse text-left text-sm">
                    <thead className="bg-[var(--surface)]">
                      <tr>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">From</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">To</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Item</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Qty</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Unit</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Challan / Bill</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Vehicle</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Remarks</th>
                        <th className="border border-[var(--border)] px-3 py-3 text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {lineDrafts.map((line) => (
                        <tr key={line.id}>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <select
                              value={line.fromSourceId}
                              onChange={(event) =>
                                onLineChange(line.id, "fromSourceId", event.target.value)
                              }
                              className={compactSelectClassName}
                            >
                              <option value="">Select source</option>
                              {sources.map((source) => (
                                <option key={source.id} value={String(source.id)}>
                                  {source.sourceName} ({source.sourceType})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <select
                              value={line.toSourceId}
                              onChange={(event) =>
                                onLineChange(line.id, "toSourceId", event.target.value)
                              }
                              className={compactSelectClassName}
                            >
                              <option value="">Select destination</option>
                              {sources.map((source) => (
                                <option key={source.id} value={String(source.id)}>
                                  {source.sourceName} ({source.sourceType})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <select
                              value={line.itemId}
                              onChange={(event) =>
                                onLineChange(line.id, "itemId", event.target.value)
                              }
                              className={compactSelectClassName}
                            >
                              <option value="">Select item</option>
                              {items.map((item) => (
                                <option key={item.id} value={String(item.id)}>
                                  {item.itemName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <Input
                              value={line.quantity}
                              onChange={(event) =>
                                onLineChange(line.id, "quantity", event.target.value)
                              }
                              inputMode="decimal"
                              placeholder="0"
                              className="h-10 rounded-lg px-3 py-2 text-sm"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <select
                              value={line.unit}
                              onChange={(event) =>
                                onLineChange(line.id, "unit", event.target.value)
                              }
                              className={compactSelectClassName}
                            >
                              {inventoryUnits.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <Input
                              value={line.challanBillNo}
                              onChange={(event) =>
                                onLineChange(line.id, "challanBillNo", event.target.value)
                              }
                              placeholder="Challan / bill"
                              className="h-10 rounded-lg px-3 py-2 text-sm"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <Input
                              value={line.vehicleNumber}
                              onChange={(event) =>
                                onLineChange(line.id, "vehicleNumber", event.target.value)
                              }
                              placeholder="Vehicle no."
                              className="h-10 rounded-lg px-3 py-2 text-sm"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <Input
                              value={line.remarks}
                              onChange={(event) =>
                                onLineChange(line.id, "remarks", event.target.value)
                              }
                              placeholder="Line remarks"
                              className="h-10 rounded-lg px-3 py-2 text-sm"
                            />
                          </td>
                          <td className="border border-[var(--border)] px-2 py-1">
                            <button
                              type="button"
                              onClick={() => onDeleteLine(line.id)}
                              className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {statusMessage ? (
                  <span className="text-sm text-[var(--muted)]">{statusMessage}</span>
                ) : null}
                <button
                  type="submit"
                  disabled={isPostingTransaction}
                  className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPostingTransaction
                    ? editingTransactionId
                      ? "Saving..."
                      : "Posting..."
                    : editingTransactionId
                      ? "Save Changes"
                      : "Post Inventory Log"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">
            Inventory Logs
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Recent Movements</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center text-sm text-[var(--muted)]">
            No inventory movements have been recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px] border-collapse text-left text-sm">
              <thead className="bg-[var(--surface)]">
                <tr>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Date</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">From</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">To</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Items</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Item Category</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Challan / Bill</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Vehicle</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Remarks</th>
                  <th className="px-3 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {formatDate(transaction.transactionDate)}
                    </td>
                    <td className="px-3 py-3">
                      {transaction.fromSourceName}
                      <p className="text-xs text-[var(--subtle)]">{transaction.fromSourceType}</p>
                    </td>
                    <td className="px-3 py-3">
                      {transaction.toSourceName}
                      <p className="text-xs text-[var(--subtle)]">{transaction.toSourceType}</p>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      <div className="space-y-1">
                        {transaction.lines.map((line) => (
                          <p key={line.id}>
                            {line.itemName}: {formatQuantity(line.quantity)} {line.unit}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      <div className="space-y-1">
                        {transaction.lines.map((line) => (
                          <p key={line.id}>{line.itemCategory || "--"}</p>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {transaction.challanBillNo || "--"}
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {transaction.vehicleNumber || "--"}
                    </td>
                    <td className="px-3 py-3 text-[var(--muted)]">
                      {transaction.remarks || "--"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(transaction)}
                          disabled={
                            isPostingTransaction || isDeletingTransactionId === transaction.id
                          }
                          className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {editingTransactionId === transaction.id && isLogDialogOpen
                            ? "Editing..."
                            : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteTransaction(transaction.id)}
                          disabled={
                            isDeletingTransactionId === transaction.id || isPostingTransaction
                          }
                          className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingTransactionId === transaction.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
type ActualInventoryPanelProps = {
  sites: SiteInventorySource[];
  items: SiteInventoryItem[];
  balances: SiteInventoryBalance[];
  inventoryViewMode: InventoryViewMode;
  selectedSiteId: string;
  selectedItemId: string;
  balancesForSelectedSite: SiteInventoryBalance[];
  balancesForSelectedItem: SiteInventoryBalance[];
  transactions: SiteInventoryTransaction[];
  onInventoryViewModeChange: (value: InventoryViewMode) => void;
  onSelectedSiteIdChange: (value: string) => void;
  onSelectedItemIdChange: (value: string) => void;
};

function ActualInventoryPanel({
  sites,
  items,
  balances,
  inventoryViewMode,
  selectedSiteId,
  selectedItemId,
  balancesForSelectedSite,
  balancesForSelectedItem,
  transactions,
  onInventoryViewModeChange,
  onSelectedSiteIdChange,
  onSelectedItemIdChange,
}: ActualInventoryPanelProps) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-[var(--shadow-lg)]">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--subtle)]">Actual Inventory</p>
          <h2 className="mt-2 text-2xl font-semibold">Current Site Balances</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Review what is currently available at each site, or pick one item to see
            where it is available across all sites.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <TabButton label="By Site" isActive={inventoryViewMode === "site"} onClick={() => onInventoryViewModeChange("site")} />
          <TabButton label="By Item" isActive={inventoryViewMode === "item"} onClick={() => onInventoryViewModeChange("item")} />
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <InfoTile label="Active Sites" value={String(sites.length)} />
        <InfoTile label="Inventory Items" value={String(items.length)} />
        <InfoTile label="Balance Rows" value={String(balances.length)} />
      </div>

      {inventoryViewMode === "site" ? (
        <div className="space-y-4">
          <Field label="Select Site">
            <select value={selectedSiteId} onChange={(event) => onSelectedSiteIdChange(event.target.value)} className={selectClassName}>
              <option value="">Select site</option>
              {sites.map((site) => <option key={site.id} value={String(site.id)}>{site.sourceName}</option>)}
            </select>
          </Field>
          <BalanceTable mode="site" rows={balancesForSelectedSite} transactions={transactions} />
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Select Item">
            <select value={selectedItemId} onChange={(event) => onSelectedItemIdChange(event.target.value)} className={selectClassName}>
              <option value="">Select item</option>
              {items.map((item) => <option key={item.id} value={String(item.id)}>{item.itemName}</option>)}
            </select>
          </Field>
          <BalanceTable mode="item" rows={balancesForSelectedItem} transactions={transactions} />
        </div>
      )}
    </section>
  );
}

function BalanceTable({
  mode,
  rows,
  transactions,
}: {
  mode: InventoryViewMode;
  rows: SiteInventoryBalance[];
  transactions: SiteInventoryTransaction[];
}) {
  const [expandedBalanceId, setExpandedBalanceId] = useState<number | null>(null);

  if (rows.length === 0) {
    return <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-8 text-center text-sm text-[var(--muted)]">No balance rows found for this selection.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
        <thead className="bg-[var(--surface)]">
          <tr>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">{mode === "site" ? "Item" : "Site"}</th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Unit</th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Category</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Quantity On Hand</th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Last Updated</th>
            <th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const isExpanded = expandedBalanceId === row.id;
            const movementHistory = getBalanceMovementHistory(row, transactions);

            return (
              <Fragment key={row.id}>
                <tr>
                  <td className="px-4 py-3 font-medium">{mode === "site" ? row.itemName : row.siteName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.unit}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.itemCategory || "--"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatQuantity(row.quantityOnHand)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDateTime(row.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedBalanceId(isExpanded ? null : row.id)}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} inventory history for ${row.itemName}`}
                      title={isExpanded ? "Collapse history" : "View history"}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]"
                    >
                      <ExpandIcon />
                    </button>
                  </td>
                </tr>

                {isExpanded ? (
                  <tr>
                    <td colSpan={6} className="bg-[var(--panel-soft)] px-4 py-4">
                      <InventoryBalanceHistory row={row} movementHistory={movementHistory} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
type BalanceMovement = {
  transaction: SiteInventoryTransaction;
  line: SiteInventoryTransaction["lines"][number];
  quantityIn: number;
  quantityOut: number;
  netQuantity: number;
  runningTotal: number;
};

function InventoryBalanceHistory({
  row,
  movementHistory,
}: {
  row: SiteInventoryBalance;
  movementHistory: BalanceMovement[];
}) {
  if (movementHistory.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
        No matching movement history was found for {row.itemName} at {row.siteName}. Current balance: {formatQuantity(row.quantityOnHand)} {row.unit}.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Movement History</p>
          <h4 className="mt-1 text-base font-semibold">{row.itemName} at {row.siteName}</h4>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold">
          Final Total: {formatQuantity(row.quantityOnHand)} {row.unit}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead className="bg-[var(--surface)]">
            <tr>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">Date</th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">From</th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">To</th>
              <th className="px-3 py-3 text-right uppercase tracking-[0.16em] text-[var(--subtle)]">In</th>
              <th className="px-3 py-3 text-right uppercase tracking-[0.16em] text-[var(--subtle)]">Out</th>
              <th className="px-3 py-3 text-right uppercase tracking-[0.16em] text-[var(--subtle)]">Running Total</th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">Challan / Bill</th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">Vehicle</th>
              <th className="px-3 py-3 uppercase tracking-[0.16em] text-[var(--subtle)]">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {movementHistory.map((movement) => (
              <tr key={`${movement.transaction.id}-${movement.line.id}`}>
                <td className="px-3 py-3 text-[var(--muted)]">{formatDate(movement.transaction.transactionDate)}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{movement.transaction.fromSourceName}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{movement.transaction.toSourceName}</td>
                <td className="px-3 py-3 text-right font-medium text-green-600">{movement.quantityIn ? formatQuantity(movement.quantityIn) : "--"}</td>
                <td className="px-3 py-3 text-right font-medium text-red-500">{movement.quantityOut ? formatQuantity(movement.quantityOut) : "--"}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatQuantity(movement.runningTotal)} {row.unit}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{movement.transaction.challanBillNo || "--"}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{movement.transaction.vehicleNumber || "--"}</td>
                <td className="px-3 py-3 text-[var(--muted)]">{movement.line.remarks || movement.transaction.remarks || "--"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[var(--surface)]">
            <tr>
              <td colSpan={5} className="px-3 py-3 font-semibold">Final Total</td>
              <td className="px-3 py-3 text-right font-semibold">{formatQuantity(row.quantityOnHand)} {row.unit}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function getBalanceMovementHistory(
  row: SiteInventoryBalance,
  transactions: SiteInventoryTransaction[]
): BalanceMovement[] {
  let runningTotal = 0;

  return transactions
    .flatMap((transaction) =>
      transaction.lines.flatMap((line) => {
        if (line.itemId !== row.itemId || line.unit !== row.unit) {
          return [];
        }

        const quantityIn =
          transaction.toSourceId === row.siteSourceId && transaction.toSourceType === "Site"
            ? line.quantity
            : 0;
        const quantityOut =
          transaction.fromSourceId === row.siteSourceId && transaction.fromSourceType === "Site"
            ? line.quantity
            : 0;

        if (!quantityIn && !quantityOut) {
          return [];
        }

        return [
          {
            transaction,
            line,
            quantityIn,
            quantityOut,
            netQuantity: quantityIn - quantityOut,
            runningTotal: 0,
          },
        ];
      })
    )
    .sort(
      (left, right) =>
        getInventoryMovementTime(left.transaction) - getInventoryMovementTime(right.transaction)
    )
    .map((movement) => {
      runningTotal += movement.netQuantity;
      return { ...movement, runningTotal };
    });
}

function getInventoryMovementTime(transaction: SiteInventoryTransaction) {
  const transactionTime = new Date(transaction.transactionDate).getTime();
  const createdTime = new Date(transaction.createdAt).getTime();

  return (Number.isNaN(transactionTime) ? 0 : transactionTime) +
    (Number.isNaN(createdTime) ? 0 : createdTime / 100000000);
}
function SourceManagerDialog({
  isOpen,
  sources,
  profile,
  createdByName,
  onClose,
  onRefresh,
}: {
  isOpen: boolean;
  sources: SiteInventorySource[];
  profile: UserProfile | null;
  createdByName: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<SiteInventorySourceType>("Site");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  function resetForm() {
    setEditingSourceId(null);
    setSourceName("");
    setSourceType("Site");
    setIsActive(true);
    setErrorMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceName.trim()) {
      setErrorMessage("Enter a source name first.");
      return;
    }
    setIsSaving(true);
    setErrorMessage("");
    try {
      await saveSiteInventorySource({
        id: editingSourceId ?? undefined,
        sourceName,
        sourceType,
        isActive,
        createdById: getInventoryCreatedById(profile),
        createdByName,
      });
      resetForm();
      await onRefresh();
    } catch (error) {
      console.error("Failed to save source:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to save source.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(sourceId: number) {
    setIsSaving(true);
    setErrorMessage("");
    try {
      await deleteSiteInventorySource(sourceId);
      resetForm();
      await onRefresh();
    } catch (error) {
      console.error("Failed to delete source:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete source. It may already be used in transactions.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DialogShell title="Manage Inventory Sources" onClose={onClose}>
      <form onSubmit={handleSubmit} className="mb-5 grid gap-4 lg:grid-cols-[1fr_180px_140px_auto] lg:items-end">
        <Field label="Source Name" required>
          <Input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Site, supplier, or other source" />
        </Field>
        <Field label="Type" required>
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SiteInventorySourceType)} className={selectClassName}>
            {sourceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={isActive ? "active" : "inactive"} onChange={(event) => setIsActive(event.target.value === "active")} className={selectClassName}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <button type="submit" disabled={isSaving} className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60">
          {editingSourceId ? "Save Source" : "Add Source"}
        </button>
      </form>

      {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-[var(--surface)]"><tr><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Source</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Type</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Status</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Action</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sources.map((source) => (
              <tr key={source.id}>
                <td className="px-4 py-3 font-medium">{source.sourceName}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{source.sourceType}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{source.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingSourceId(source.id); setSourceName(source.sourceName); setSourceType(source.sourceType); setIsActive(source.isActive); }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)]">Edit</button><button type="button" onClick={() => void handleDelete(source.id)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DialogShell>
  );
}

function ItemManagerDialog({
  isOpen,
  items,
  profile,
  createdByName,
  onClose,
  onRefresh,
}: {
  isOpen: boolean;
  items: SiteInventoryItem[];
  profile: UserProfile | null;
  createdByName: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemName, setItemName] = useState("");
  const [defaultUnit, setDefaultUnit] = useState<SiteInventoryUnit>("count");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  function resetForm() {
    setEditingItemId(null);
    setItemName("");
    setDefaultUnit("count");
    setCategory("");
    setDescription("");
    setIsActive(true);
    setErrorMessage("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemName.trim()) {
      setErrorMessage("Enter an item name first.");
      return;
    }
    setIsSaving(true);
    setErrorMessage("");
    try {
      await saveSiteInventoryItem({ id: editingItemId ?? undefined, itemName, defaultUnit, category, description, isActive, createdById: getInventoryCreatedById(profile), createdByName });
      resetForm();
      await onRefresh();
    } catch (error) {
      console.error("Failed to save item:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to save item.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(itemId: number) {
    setIsSaving(true);
    setErrorMessage("");
    try {
      await deleteSiteInventoryItem(itemId);
      resetForm();
      await onRefresh();
    } catch (error) {
      console.error("Failed to delete item:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete item. It may already be used in transactions.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DialogShell title="Manage Inventory Items" onClose={onClose} maxWidth="max-w-6xl">
      <form onSubmit={handleSubmit} className="mb-5 grid gap-4 lg:grid-cols-[1fr_150px_220px_140px_auto] lg:items-end">
        <Field label="Item Name" required>
          <Input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Inventory item" />
        </Field>
        <Field label="Default Unit" required>
          <select value={defaultUnit} onChange={(event) => setDefaultUnit(event.target.value as SiteInventoryUnit)} className={selectClassName}>
            {inventoryUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={selectClassName}>
            <option value="">Select category</option>
            {category && !inventoryItemCategories.includes(category as (typeof inventoryItemCategories)[number]) ? (
              <option value={category}>{category}</option>
            ) : null}
            {inventoryItemCategories.map((itemCategory) => (
              <option key={itemCategory} value={itemCategory}>{itemCategory}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={isActive ? "active" : "inactive"} onChange={(event) => setIsActive(event.target.value === "active")} className={selectClassName}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <button type="submit" disabled={isSaving} className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60">{editingItemId ? "Save Item" : "Add Item"}</button>
        <div className="lg:col-span-5"><Field label="Description"><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional item description" /></Field></div>
      </form>

      {errorMessage ? <ErrorMessage message={errorMessage} /> : null}
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-[var(--surface)]"><tr><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Item</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Unit</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Category</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Description</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Status</th><th className="px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">Action</th></tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.itemName}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{item.defaultUnit}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{item.category || "--"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{item.description || "--"}</td>
                <td className="px-4 py-3 text-[var(--muted)]">{item.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingItemId(item.id); setItemName(item.itemName); setDefaultUnit(item.defaultUnit); setCategory(item.category); setDescription(item.description); setIsActive(item.isActive); }} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium transition duration-200 hover:cursor-pointer hover:border-[var(--border-strong)]">Edit</button><button type="button" onClick={() => void handleDelete(item.id)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] transition duration-200 hover:cursor-pointer hover:border-red-400 hover:text-red-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DialogShell>
  );
}

function DialogShell({ title, children, onClose, maxWidth = "max-w-5xl" }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4 py-6" onClick={onClose}>
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 text-[var(--foreground)] shadow-[var(--shadow-lg)]`} onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-[var(--muted)]">Add, edit, or remove reusable inventory master data.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm transition duration-200 hover:scale-105 hover:cursor-pointer hover:bg-[var(--surface-strong)]">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TabButton({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={["rounded-2xl border px-4 py-2.5 text-sm font-medium transition duration-200", "hover:scale-105 hover:cursor-pointer", isActive ? "border-[var(--inverse-bg)] bg-[var(--inverse-bg)] text-[var(--inverse-fg)]" : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--foreground)] hover:border-[var(--border-strong)]"].join(" ")}>{label}</button>;
}

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <label className="block space-y-2 text-sm text-[var(--muted)]"><span className="block text-xs uppercase tracking-[0.18em] text-[var(--subtle)]">{label}{required ? <span className="ml-1 text-red-300">*</span> : null}</span>{children}</label>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4"><p className="text-[11px] uppercase tracking-[0.18em] text-[var(--subtle)]">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>;
}

function ErrorMessage({ message }: { message: string }) {
  return <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</div>;
}

const selectClassName = "h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 text-sm text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]";
const compactSelectClassName = "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 text-sm text-[var(--foreground)] outline-none transition duration-200 focus:border-[var(--border-strong)]";

function buildUserName(profile: UserProfile | null) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
}

function getInventoryCreatedById(profile: UserProfile | null) {
  return isUuid(profile?.auth_user_id ?? "") ? profile?.auth_user_id ?? null : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
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
function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isTransactionLineTouched(line: TransactionLineDraft) {
  return Boolean(
    line.fromSourceId ||
      line.toSourceId ||
      line.itemId ||
      line.quantity.trim() ||
      line.challanBillNo.trim() ||
      line.vehicleNumber.trim() ||
      line.remarks.trim()
  );
}

function parseInventoryNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toLocaleString("en-IN") : value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
















