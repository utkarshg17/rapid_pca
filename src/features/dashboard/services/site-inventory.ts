import { supabase } from "@/lib/supabase/client";
import type {
  CreateSiteInventoryTransactionInput,
  SaveSiteInventoryItemInput,
  SaveSiteInventorySourceInput,
  SiteInventoryBalance,
  SiteInventoryBalanceRecord,
  SiteInventoryItem,
  SiteInventoryItemRecord,
  SiteInventorySource,
  SiteInventorySourceRecord,
  SiteInventorySourceType,
  SiteInventoryTransaction,
  SiteInventoryTransactionLineRecord,
  SiteInventoryTransactionRecord,
  SiteInventoryUnit,
} from "@/features/dashboard/types/site-inventory";

const validSourceTypes = new Set<SiteInventorySourceType>([
  "Site",
  "Supplier",
  "Other",
]);
const validUnits = new Set<SiteInventoryUnit>([
  "Bags",
  "cu.m",
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
  if (input.fromSourceId === input.toSourceId) {
    throw new Error("Choose different From and To sources.");
  }

  const validLines = input.lines.filter(
    (line) => line.itemId > 0 && line.quantity > 0
  );

  if (validLines.length === 0) {
    throw new Error("Add at least one item line with quantity greater than zero.");
  }

  const sources = await getSiteInventorySources();
  const fromSource = sources.find((source) => source.id === input.fromSourceId);
  const toSource = sources.find((source) => source.id === input.toSourceId);

  if (!fromSource || !toSource) {
    throw new Error("Choose valid From and To sources.");
  }

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
    })
    .select("id")
    .single();

  if (transactionError || !transactionData) {
    throw new Error(transactionError?.message || "Failed to create inventory transaction.");
  }

  const transactionId = transactionData.id as number;

  const { error: lineError } = await supabase
    .from("site_inventory_transaction_lines")
    .insert(
      validLines.map((line, index) => ({
        transaction_id: transactionId,
        item_id: line.itemId,
        quantity: line.quantity,
        unit: line.unit,
        remarks: toNullableText(line.remarks),
        sort_order: index,
      }))
    );

  if (lineError) {
    throw new Error(lineError.message || "Failed to save inventory transaction lines.");
  }

  for (const line of validLines) {
    if (fromSource.sourceType === "Site") {
      await adjustSiteInventoryBalance({
        siteSourceId: fromSource.id,
        itemId: line.itemId,
        unit: line.unit,
        delta: -line.quantity,
      });
    }

    if (toSource.sourceType === "Site") {
      await adjustSiteInventoryBalance({
        siteSourceId: toSource.id,
        itemId: line.itemId,
        unit: line.unit,
        delta: line.quantity,
      });
    }
  }

  return transactionId;
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
      "id, created_at, transaction_date, from_source_id, to_source_id, challan_bill_no, vehicle_number, remarks, created_by_id, created_by_name, status"
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

async function adjustSiteInventoryBalance({
  siteSourceId,
  itemId,
  unit,
  delta,
}: {
  siteSourceId: number;
  itemId: number;
  unit: SiteInventoryUnit;
  delta: number;
}) {
  const { data: existingBalance, error: balanceError } = await supabase
    .from("site_inventory_balances")
    .select("id, quantity_on_hand")
    .eq("site_source_id", siteSourceId)
    .eq("item_id", itemId)
    .eq("unit", unit)
    .limit(1)
    .maybeSingle();

  if (balanceError) {
    throw new Error(balanceError.message || "Failed to read site inventory balance.");
  }

  if (existingBalance?.id) {
    const nextQuantity = Number(existingBalance.quantity_on_hand ?? 0) + delta;
    const { error: updateError } = await supabase
      .from("site_inventory_balances")
      .update({ quantity_on_hand: nextQuantity })
      .eq("id", existingBalance.id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update site inventory balance.");
    }

    return;
  }

  const { error: insertError } = await supabase
    .from("site_inventory_balances")
    .insert({
      site_source_id: siteSourceId,
      item_id: itemId,
      unit,
      quantity_on_hand: delta,
    });

  if (insertError) {
    throw new Error(insertError.message || "Failed to create site inventory balance.");
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





