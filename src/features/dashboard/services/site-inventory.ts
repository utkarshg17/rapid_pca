import { supabase } from "@/lib/supabase/client";
import type {
  CreateSiteInventoryTransactionInput,
  SaveSiteInventoryItemInput,
  SaveSiteInventorySourceInput,
  SiteInventoryBalance,
  SiteInventoryBalanceRecord,
  SiteInventoryItem,
  SiteInventoryItemRecord,
  SiteInventoryMovementStatus,
  SiteInventorySource,
  SiteInventorySourceRecord,
  SiteInventorySourceType,
  SiteInventoryTransaction,
  SiteInventoryTransactionLineRecord,
  SiteInventoryTransactionRecord,
  SiteInventoryUnit,
  UpdateSiteInventoryTransactionInput,
} from "@/features/dashboard/types/site-inventory";

const validSourceTypes = new Set<SiteInventorySourceType>([
  "Site",
  "Supplier",
  "Other",
]);
const validMovementStatuses = new Set<SiteInventoryMovementStatus>([
  "In Transit",
  "Received",
  "Disputed",
  "Cancelled",
]);
const validUnits = new Set<SiteInventoryUnit>([
  "Bags",
  "bundle",
  "cu.m",
  "cu.ft",
  "sq.ft",
  "count",
  "litre",
  "kg",
  "ton",
]);
const legacyUnitMap: Record<string, SiteInventoryUnit> = {
  EA: "count",
  L: "litre",
  MT: "ton",
};

export async function getSiteInventorySources(): Promise<SiteInventorySource[]> {
  const { data, error } = await supabase
    .from("site_inventory_sources")
    .select(
      "id, created_at, source_name, source_type, created_by_id, created_by_name, is_active"
    )
    .order("source_type", { ascending: true })
    .order("source_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load inventory sources.");
  }

  return ((data ?? []) as SiteInventorySourceRecord[]).map(mapSourceRecord);
}

export async function saveSiteInventorySource(
  input: SaveSiteInventorySourceInput
): Promise<SiteInventorySource> {
  const payload = {
    source_name: input.sourceName.trim(),
    source_type: input.sourceType,
    created_by_id: toNullableUuid(input.createdById),
    created_by_name: input.createdByName.trim() || null,
    is_active: input.isActive,
  };

  const query = input.id
    ? supabase.from("site_inventory_sources").update(payload).eq("id", input.id)
    : supabase.from("site_inventory_sources").insert(payload);

  const { data, error } = await query
    .select(
      "id, created_at, source_name, source_type, created_by_id, created_by_name, is_active"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save inventory source.");
  }

  return mapSourceRecord(data as SiteInventorySourceRecord);
}

export async function deleteSiteInventorySource(sourceId: number) {
  const { error } = await supabase
    .from("site_inventory_sources")
    .delete()
    .eq("id", sourceId);

  if (error) {
    throw new Error(error.message || "Failed to delete inventory source.");
  }
}

export async function getSiteInventoryItems(): Promise<SiteInventoryItem[]> {
  const { data, error } = await supabase
    .from("site_inventory_items")
    .select(
      "id, created_at, item_name, default_unit, category, description, created_by_id, created_by_name, is_active"
    )
    .order("category", { ascending: true })
    .order("item_name", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load inventory items.");
  }

  return ((data ?? []) as SiteInventoryItemRecord[]).map(mapItemRecord);
}

export async function saveSiteInventoryItem(
  input: SaveSiteInventoryItemInput
): Promise<SiteInventoryItem> {
  const payload = {
    item_name: input.itemName.trim(),
    default_unit: input.defaultUnit,
    category: toNullableText(input.category),
    description: toNullableText(input.description),
    created_by_id: toNullableUuid(input.createdById),
    created_by_name: input.createdByName.trim() || null,
    is_active: input.isActive,
  };

  const query = input.id
    ? supabase.from("site_inventory_items").update(payload).eq("id", input.id)
    : supabase.from("site_inventory_items").insert(payload);

  const { data, error } = await query
    .select(
      "id, created_at, item_name, default_unit, category, description, created_by_id, created_by_name, is_active"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save inventory item.");
  }

  return mapItemRecord(data as SiteInventoryItemRecord);
}

export async function deleteSiteInventoryItem(itemId: number) {
  const { error } = await supabase
    .from("site_inventory_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw new Error(error.message || "Failed to delete inventory item.");
  }
}

export async function getSiteInventoryTransactions(): Promise<
  SiteInventoryTransaction[]
> {
  const [transactions, sources, items] = await Promise.all([
    fetchTransactionRecords(),
    getSiteInventorySources(),
    getSiteInventoryItems(),
  ]);

  if (transactions.length === 0) {
    return [];
  }

  const transactionIds = transactions.map((transaction) => transaction.id);
  const { data: lineData, error: lineError } = await supabase
    .from("site_inventory_transaction_lines")
    .select("id, created_at, transaction_id, item_id, quantity, unit, remarks, sort_order")
    .in("transaction_id", transactionIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lineError) {
    throw new Error(lineError.message || "Failed to load inventory transaction lines.");
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const linesByTransactionId = new Map<number, SiteInventoryTransactionLineRecord[]>();

  ((lineData ?? []) as SiteInventoryTransactionLineRecord[]).forEach((line) => {
    const lines = linesByTransactionId.get(line.transaction_id) ?? [];
    lines.push(line);
    linesByTransactionId.set(line.transaction_id, lines);
  });

  return transactions.map((transaction) => {
    const fromSource = sourceById.get(transaction.from_source_id);
    const toSource = sourceById.get(transaction.to_source_id);

    return {
      id: transaction.id,
      createdAt: transaction.created_at,
      transactionDate: transaction.transaction_date,
      fromSourceId: transaction.from_source_id,
      fromSourceName: fromSource?.sourceName ?? "Unknown source",
      fromSourceType: fromSource?.sourceType ?? "Other",
      toSourceId: transaction.to_source_id,
      toSourceName: toSource?.sourceName ?? "Unknown source",
      toSourceType: toSource?.sourceType ?? "Other",
      challanBillNo: transaction.challan_bill_no ?? "",
      vehicleNumber: transaction.vehicle_number ?? "",
      remarks: transaction.remarks ?? "",
      createdById: transaction.created_by_id,
      createdByName: transaction.created_by_name ?? "",
      status: transaction.status ?? "posted",
      movementStatus: normalizeMovementStatus(transaction.movement_status),
      movementStatusUpdatedAt: transaction.movement_status_updated_at ?? transaction.created_at,
      movementStatusUpdatedById: transaction.movement_status_updated_by_id,
      movementStatusUpdatedByName: transaction.movement_status_updated_by_name ?? "",
      lines: (linesByTransactionId.get(transaction.id) ?? []).map((line) => ({
        id: line.id,
        createdAt: line.created_at,
        transactionId: line.transaction_id,
        itemId: line.item_id,
        itemName: itemById.get(line.item_id)?.itemName ?? "Unknown item",
        itemCategory: itemById.get(line.item_id)?.category ?? "",
        quantity: line.quantity ?? 0,
        unit: normalizeUnit(line.unit),
        remarks: line.remarks ?? "",
        sortOrder: line.sort_order ?? 0,
      })),
    };
  });
}

export async function createSiteInventoryTransaction(
  input: CreateSiteInventoryTransactionInput
): Promise<number> {
  assertValidTransactionHeader({
    fromSourceId: input.fromSourceId,
    toSourceId: input.toSourceId,
  });

  const validLines = normalizeTransactionLinesInput(input.lines);

  const { data: transactionData, error: transactionError } = await supabase
    .from("site_inventory_transactions")
    .insert({
      transaction_date: input.transactionDate || new Date().toISOString().slice(0, 10),
      from_source_id: input.fromSourceId,
      to_source_id: input.toSourceId,
      challan_bill_no: toNullableText(input.challanBillNo),
      vehicle_number: toNullableText(input.vehicleNumber),
      remarks: toNullableText(input.remarks),
      created_by_id: toNullableUuid(input.createdById),
      created_by_name: input.createdByName.trim() || null,
      status: "posted",
      movement_status: normalizeMovementStatus(input.movementStatus ?? "Received"),
      movement_status_updated_at: new Date().toISOString(),
      movement_status_updated_by_id: toNullableUuid(input.createdById),
      movement_status_updated_by_name: input.createdByName.trim() || null,
    })
    .select("id")
    .single();

  if (transactionError || !transactionData) {
    throw new Error(transactionError?.message || "Failed to create inventory transaction.");
  }

  const transactionId = transactionData.id as number;

  await insertTransactionLines(transactionId, validLines);
  await rebuildSiteInventoryBalances();

  return transactionId;
}

export async function updateSiteInventoryTransaction(
  input: UpdateSiteInventoryTransactionInput
): Promise<number> {
  assertValidTransactionHeader({
    fromSourceId: input.fromSourceId,
    toSourceId: input.toSourceId,
  });

  const validLines = normalizeTransactionLinesInput(input.lines);

  const { data: existingTransaction, error: existingTransactionError } = await supabase
    .from("site_inventory_transactions")
    .select("id")
    .eq("id", input.transactionId)
    .limit(1)
    .maybeSingle();

  if (existingTransactionError) {
    throw new Error(existingTransactionError.message || "Failed to load inventory transaction.");
  }

  if (!existingTransaction?.id) {
    throw new Error("This inventory movement no longer exists.");
  }

  const { error: updateError } = await supabase
    .from("site_inventory_transactions")
    .update({
      transaction_date: input.transactionDate || new Date().toISOString().slice(0, 10),
      from_source_id: input.fromSourceId,
      to_source_id: input.toSourceId,
      challan_bill_no: toNullableText(input.challanBillNo),
      vehicle_number: toNullableText(input.vehicleNumber),
      remarks: toNullableText(input.remarks),
      movement_status: normalizeMovementStatus(input.movementStatus),
      movement_status_updated_by_id: toNullableUuid(input.movementStatusUpdatedById),
      movement_status_updated_by_name: input.movementStatusUpdatedByName.trim() || null,
    })
    .eq("id", input.transactionId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update inventory transaction.");
  }

  const { error: deleteLinesError } = await supabase
    .from("site_inventory_transaction_lines")
    .delete()
    .eq("transaction_id", input.transactionId);

  if (deleteLinesError) {
    throw new Error(deleteLinesError.message || "Failed to replace inventory transaction lines.");
  }

  await insertTransactionLines(input.transactionId, validLines);
  await rebuildSiteInventoryBalances();

  return input.transactionId;
}

export async function updateSiteInventoryTransactionMovementStatus({
  transactionId,
  movementStatus,
  updatedById,
  updatedByName,
}: {
  transactionId: number;
  movementStatus: SiteInventoryMovementStatus;
  updatedById: string | null;
  updatedByName: string;
}) {
  const { error } = await supabase
    .from("site_inventory_transactions")
    .update({
      movement_status: normalizeMovementStatus(movementStatus),
      movement_status_updated_by_id: toNullableUuid(updatedById),
      movement_status_updated_by_name: updatedByName.trim() || null,
    })
    .eq("id", transactionId);

  if (error) {
    throw new Error(error.message || "Failed to update inventory movement status.");
  }

  await rebuildSiteInventoryBalances();
}

export async function deleteSiteInventoryTransaction(transactionId: number) {
  const { error } = await supabase
    .from("site_inventory_transactions")
    .delete()
    .eq("id", transactionId);

  if (error) {
    throw new Error(error.message || "Failed to delete inventory transaction.");
  }

  await rebuildSiteInventoryBalances();
}

export async function getSiteInventoryBalances(): Promise<SiteInventoryBalance[]> {
  const [sources, items, balanceRows] = await Promise.all([
    getSiteInventorySources(),
    getSiteInventoryItems(),
    fetchBalanceRecords(),
  ]);

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const itemById = new Map(items.map((item) => [item.id, item]));

  return balanceRows
    .map((row) => {
      const source = sourceById.get(row.site_source_id);
      const item = itemById.get(row.item_id);

      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        siteSourceId: row.site_source_id,
        siteName: source?.sourceName ?? "Unknown site",
        itemId: row.item_id,
        itemName: item?.itemName ?? "Unknown item",
        itemCategory: item?.category ?? "",
        unit: normalizeUnit(row.unit),
        quantityOnHand: row.quantity_on_hand ?? 0,
      };
    })
    .sort(
      (left, right) =>
        left.siteName.localeCompare(right.siteName) ||
        left.itemName.localeCompare(right.itemName) ||
        left.unit.localeCompare(right.unit)
    );
}

async function fetchTransactionRecords() {
  const { data, error } = await supabase
    .from("site_inventory_transactions")
    .select(
      "id, created_at, transaction_date, from_source_id, to_source_id, challan_bill_no, vehicle_number, remarks, created_by_id, created_by_name, status, movement_status, movement_status_updated_at, movement_status_updated_by_id, movement_status_updated_by_name"
    )
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load inventory transactions.");
  }

  return (data ?? []) as SiteInventoryTransactionRecord[];
}

async function fetchBalanceRecords() {
  const { data, error } = await supabase
    .from("site_inventory_balances")
    .select(
      "id, created_at, updated_at, site_source_id, item_id, unit, quantity_on_hand"
    )
    .order("site_source_id", { ascending: true })
    .order("item_id", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load site inventory balances.");
  }

  return (data ?? []) as SiteInventoryBalanceRecord[];
}

function assertValidTransactionHeader({
  fromSourceId,
  toSourceId,
}: {
  fromSourceId: number;
  toSourceId: number;
}) {
  if (!fromSourceId || !toSourceId) {
    throw new Error("Choose valid From and To sources.");
  }

  if (fromSourceId === toSourceId) {
    throw new Error("Choose different From and To sources.");
  }
}

function normalizeTransactionLinesInput(
  lines: Array<{
    itemId: number;
    quantity: number;
    unit: SiteInventoryUnit;
    remarks: string;
  }>
) {
  const validLines = lines.filter((line) => line.itemId > 0 && line.quantity > 0);

  if (validLines.length === 0) {
    throw new Error("Add at least one item line with quantity greater than zero.");
  }

  return validLines.map((line) => ({
    itemId: line.itemId,
    quantity: line.quantity,
    unit: line.unit,
    remarks: line.remarks,
  }));
}

async function insertTransactionLines(
  transactionId: number,
  lines: Array<{
    itemId: number;
    quantity: number;
    unit: SiteInventoryUnit;
    remarks: string;
  }>
) {
  const { error } = await supabase
    .from("site_inventory_transaction_lines")
    .insert(
      lines.map((line, index) => ({
        transaction_id: transactionId,
        item_id: line.itemId,
        quantity: line.quantity,
        unit: line.unit,
        remarks: toNullableText(line.remarks),
        sort_order: index,
      }))
    );

  if (error) {
    throw new Error(error.message || "Failed to save inventory transaction lines.");
  }
}

async function rebuildSiteInventoryBalances() {
  const [transactions, sources] = await Promise.all([
    fetchTransactionRecords(),
    getSiteInventorySources(),
  ]);

  const siteSourceTypeById = new Map(
    sources.map((source) => [source.id, source.sourceType])
  );
  const postedTransactions = transactions.filter(
    (transaction) =>
      (transaction.status ?? "posted") === "posted" &&
      normalizeMovementStatus(transaction.movement_status) === "Received"
  );
  const transactionIds = postedTransactions.map((transaction) => transaction.id);

  const { error: clearError } = await supabase
    .from("site_inventory_balances")
    .delete()
    .gt("id", 0);

  if (clearError) {
    throw new Error(clearError.message || "Failed to reset site inventory balances.");
  }

  if (transactionIds.length === 0) {
    return;
  }

  const { data: lineData, error: lineError } = await supabase
    .from("site_inventory_transaction_lines")
    .select("transaction_id, item_id, quantity, unit")
    .in("transaction_id", transactionIds)
    .order("transaction_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (lineError) {
    throw new Error(lineError.message || "Failed to rebuild inventory balances.");
  }

  const linesByTransactionId = new Map<number, Array<{ item_id: number; quantity: number; unit: string }>>();

  ((lineData ?? []) as Array<{ transaction_id: number; item_id: number; quantity: number; unit: string }>).forEach((line) => {
    const existingLines = linesByTransactionId.get(line.transaction_id) ?? [];
    existingLines.push(line);
    linesByTransactionId.set(line.transaction_id, existingLines);
  });

  const balanceMap = new Map<string, { site_source_id: number; item_id: number; unit: SiteInventoryUnit; quantity_on_hand: number }>();

  for (const transaction of postedTransactions) {
    const fromSourceType = siteSourceTypeById.get(transaction.from_source_id) ?? "Other";
    const toSourceType = siteSourceTypeById.get(transaction.to_source_id) ?? "Other";
    const lines = linesByTransactionId.get(transaction.id) ?? [];

    for (const line of lines) {
      const normalizedUnit = normalizeUnit(line.unit);

      if (fromSourceType === "Site") {
        const balanceKey = `${transaction.from_source_id}-${line.item_id}-${normalizedUnit}`;
        const existingBalance = balanceMap.get(balanceKey) ?? {
          site_source_id: transaction.from_source_id,
          item_id: line.item_id,
          unit: normalizedUnit,
          quantity_on_hand: 0,
        };
        existingBalance.quantity_on_hand -= Number(line.quantity ?? 0);
        balanceMap.set(balanceKey, existingBalance);
      }

      if (toSourceType === "Site") {
        const balanceKey = `${transaction.to_source_id}-${line.item_id}-${normalizedUnit}`;
        const existingBalance = balanceMap.get(balanceKey) ?? {
          site_source_id: transaction.to_source_id,
          item_id: line.item_id,
          unit: normalizedUnit,
          quantity_on_hand: 0,
        };
        existingBalance.quantity_on_hand += Number(line.quantity ?? 0);
        balanceMap.set(balanceKey, existingBalance);
      }
    }
  }

  const balancesToInsert = Array.from(balanceMap.values()).filter(
    (balance) => balance.quantity_on_hand !== 0
  );

  if (balancesToInsert.length === 0) {
    return;
  }

  const { error: insertBalancesError } = await supabase
    .from("site_inventory_balances")
    .insert(balancesToInsert);

  if (insertBalancesError) {
    throw new Error(insertBalancesError.message || "Failed to rebuild site inventory balances.");
  }
}

function mapSourceRecord(row: SiteInventorySourceRecord): SiteInventorySource {
  return {
    id: row.id,
    createdAt: row.created_at,
    sourceName: row.source_name,
    sourceType: normalizeSourceType(row.source_type),
    createdById: row.created_by_id,
    createdByName: row.created_by_name ?? "",
    isActive: row.is_active ?? true,
  };
}

function mapItemRecord(row: SiteInventoryItemRecord): SiteInventoryItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    itemName: row.item_name,
    defaultUnit: normalizeUnit(row.default_unit),
    category: row.category ?? "",
    description: row.description ?? "",
    createdById: row.created_by_id,
    createdByName: row.created_by_name ?? "",
    isActive: row.is_active ?? true,
  };
}

function normalizeMovementStatus(value: string | null | undefined): SiteInventoryMovementStatus {
  return validMovementStatuses.has(value as SiteInventoryMovementStatus)
    ? (value as SiteInventoryMovementStatus)
    : "Received";
}

function normalizeSourceType(value: string): SiteInventorySourceType {
  return validSourceTypes.has(value as SiteInventorySourceType)
    ? (value as SiteInventorySourceType)
    : "Other";
}

function normalizeUnit(value: string): SiteInventoryUnit {
  const normalizedValue = value.trim();
  const legacyUnit = legacyUnitMap[normalizedValue];

  if (legacyUnit) {
    return legacyUnit;
  }

  return validUnits.has(normalizedValue as SiteInventoryUnit)
    ? (normalizedValue as SiteInventoryUnit)
    : "count";
}

function toNullableText(value: string) {
  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue : null;
}

function toNullableUuid(value: string | null) {
  if (!value) {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}








