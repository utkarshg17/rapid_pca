import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateOverviewSummaryItem,
  JobEstimateDetailedItemRecord,
  JobEstimateDetailedItemRowRecord,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimateOverviewSummary(
  jobEstimateId: number
): Promise<JobEstimateOverviewSummaryItem[]> {
  const { data: itemData, error: itemError } = await supabase
    .from("job_estimate_detailed_items")
    .select("id, cost_code, item_name, unit")
    .eq("job_estimate_id", jobEstimateId)
    .order("cost_code", { ascending: true });

  if (itemError) {
    throw new Error(itemError.message);
  }

  const itemRows = (itemData ?? []) as Pick<
    JobEstimateDetailedItemRecord,
    "id" | "cost_code" | "item_name" | "unit"
  >[];

  if (itemRows.length === 0) {
    return [];
  }

  const detailedItemIds = itemRows.map((row) => row.id);
  const costCodes = itemRows.map((row) => row.cost_code);

  const [{ data: rowData, error: rowError }, { data: costCodeData, error: costCodeError }] =
    await Promise.all([
      supabase
        .from("job_estimate_detailed_item_rows")
        .select("detailed_item_id, quantity, quantity_per_gfa, unit, row_total")
        .in("detailed_item_id", detailedItemIds),
      supabase
        .from("cost_code_database")
        .select("cost_code, category")
        .in("cost_code", costCodes),
    ]);

  if (rowError) {
    throw new Error(rowError.message);
  }

  if (costCodeError) {
    throw new Error(costCodeError.message);
  }

  const rowsByDetailedItemId = new Map<number, JobEstimateDetailedItemRowRecord[]>();

  ((rowData ?? []) as Pick<
    JobEstimateDetailedItemRowRecord,
    "detailed_item_id" | "quantity" | "quantity_per_gfa" | "unit" | "row_total"
  >[]).forEach((row) => {
    const existingRows = rowsByDetailedItemId.get(row.detailed_item_id) ?? [];
    existingRows.push(row as JobEstimateDetailedItemRowRecord);
    rowsByDetailedItemId.set(row.detailed_item_id, existingRows);
  });

  const categoryByCostCode = new Map<string, string>();

  ((costCodeData ?? []) as Array<{ cost_code: string | null; category: string | null }>).forEach(
    (row) => {
      if (typeof row.cost_code === "string" && row.cost_code.trim()) {
        categoryByCostCode.set(row.cost_code, row.category?.trim() || "Uncategorized");
      }
    }
  );

  return itemRows.map((itemRow) => {
    const savedRows = rowsByDetailedItemId.get(itemRow.id) ?? [];
    const totalQuantity = savedRows.reduce(
      (sum, row) => sum + (row.quantity ?? 0),
      0
    );
    const totalQuantityPerGfa = savedRows.reduce(
      (sum, row) => sum + (row.quantity_per_gfa ?? 0),
      0
    );
    const totalCost = savedRows.reduce(
      (sum, row) => sum + (row.row_total ?? 0),
      0
    );

    return {
      costCode: itemRow.cost_code,
      category: categoryByCostCode.get(itemRow.cost_code) ?? "Uncategorized",
      item: itemRow.item_name,
      quantity: totalQuantity,
      quantityPerGfa: totalQuantityPerGfa,
      unit: savedRows[0]?.unit?.trim() || itemRow.unit || "",
      cost: totalCost,
    };
  });
}


