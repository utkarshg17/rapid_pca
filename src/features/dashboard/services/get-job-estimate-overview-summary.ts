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
        .select(
          "detailed_item_id, quantity, quantity_per_gfa, unit, material_cost_per_unit, labour_cost_per_unit, equipment_cost_per_unit, row_total"
        )
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
    | "detailed_item_id"
    | "quantity"
    | "quantity_per_gfa"
    | "unit"
    | "material_cost_per_unit"
    | "labour_cost_per_unit"
    | "equipment_cost_per_unit"
    | "row_total"
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
    const materialCostPerUnit = calculateWeightedRate(
      savedRows,
      "material_cost_per_unit",
      totalQuantity
    );
    const labourCostPerUnit = calculateWeightedRate(
      savedRows,
      "labour_cost_per_unit",
      totalQuantity
    );
    const equipmentCostPerUnit = calculateWeightedRate(
      savedRows,
      "equipment_cost_per_unit",
      totalQuantity
    );

    return {
      costCode: itemRow.cost_code,
      category: categoryByCostCode.get(itemRow.cost_code) ?? "Uncategorized",
      item: itemRow.item_name,
      quantity: totalQuantity,
      quantityPerGfa: totalQuantityPerGfa,
      unit: savedRows[0]?.unit?.trim() || itemRow.unit || "",
      materialCostPerUnit,
      labourCostPerUnit,
      equipmentCostPerUnit,
      cost: totalCost,
    };
  });
}

function calculateWeightedRate(
  rows: JobEstimateDetailedItemRowRecord[],
  key:
    | "material_cost_per_unit"
    | "labour_cost_per_unit"
    | "equipment_cost_per_unit",
  totalQuantity: number
) {
  if (totalQuantity > 0) {
    return (
      rows.reduce(
        (sum, row) => sum + (row.quantity ?? 0) * (row[key] ?? 0),
        0
      ) / totalQuantity
    );
  }

  const rates = rows
    .map((row) => row[key] ?? 0)
    .filter((rate) => Number.isFinite(rate) && rate > 0);

  if (rates.length === 0) {
    return 0;
  }

  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}
