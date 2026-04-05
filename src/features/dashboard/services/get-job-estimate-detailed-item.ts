import { supabase } from "@/lib/supabase/client";
import type {
  JobEstimateDetailedItemRecord,
  JobEstimateDetailedItemRowRecord,
  JobEstimateDetailedItemWithRows,
} from "@/features/dashboard/types/job-estimate";

export async function getJobEstimateDetailedItem(
  jobEstimateId: number,
  costCode: string
): Promise<JobEstimateDetailedItemWithRows | null> {
  const { data: itemData, error: itemError } = await supabase
    .from("job_estimate_detailed_items")
    .select("*")
    .eq("job_estimate_id", jobEstimateId)
    .eq("cost_code", costCode)
    .limit(1)
    .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (!itemData) {
    return null;
  }

  const { data: rowData, error: rowError } = await supabase
    .from("job_estimate_detailed_item_rows")
    .select("*")
    .eq("detailed_item_id", itemData.id)
    .order("sort_order", { ascending: true });

  if (rowError) {
    throw new Error(rowError.message);
  }

  return {
    item: mapDetailedItemRecord(itemData as JobEstimateDetailedItemRecord),
    rows: ((rowData ?? []) as JobEstimateDetailedItemRowRecord[]).map(
      mapDetailedItemRowRecord
    ),
  };
}

function mapDetailedItemRecord(row: JobEstimateDetailedItemRecord) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    jobEstimateId: row.job_estimate_id,
    costCode: row.cost_code,
    itemName: row.item_name,
    unit: row.unit,
    saveStatus: row.save_status ?? "draft",
    sourceType: row.source_type ?? "manual",
    aiGeneratedAt: row.ai_generated_at,
    savedById: row.saved_by_id,
    savedByName: row.saved_by_name ?? "",
  };
}

function mapDetailedItemRowRecord(row: JobEstimateDetailedItemRowRecord) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    detailedItemId: row.detailed_item_id,
    rowKey: row.row_key,
    rowLabel: row.row_label,
    quantity: row.quantity ?? 0,
    unit: row.unit ?? "",
    materialCostPerUnit: row.material_cost_per_unit ?? 0,
    labourCostPerUnit: row.labour_cost_per_unit ?? 0,
    equipmentCostPerUnit: row.equipment_cost_per_unit ?? 0,
    totalCostPerUnit: row.total_cost_per_unit ?? 0,
    rowTotal: row.row_total ?? 0,
    assumedSystem: row.assumed_system ?? "",
    assumptions: row.assumptions ?? "",
    confidence: row.confidence ?? "pending",
    status: row.status ?? "draft",
    sortOrder: row.sort_order ?? 0,
  };
}
