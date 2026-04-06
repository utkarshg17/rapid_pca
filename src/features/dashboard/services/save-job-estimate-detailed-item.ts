import { supabase } from "@/lib/supabase/client";
import type { SaveJobEstimateDetailedItemInput } from "@/features/dashboard/types/job-estimate";

export async function saveJobEstimateDetailedItem(
  input: SaveJobEstimateDetailedItemInput
) {
  const { data: itemData, error: itemError } = await supabase
    .from("job_estimate_detailed_items")
    .upsert(
      {
        job_estimate_id: input.jobEstimateId,
        cost_code: input.costCode,
        item_name: input.itemName,
        unit: input.unit,
        gfa_snapshot: input.gfaSnapshot,
        save_status: input.saveStatus ?? "reviewed",
        source_type: input.sourceType ?? "ai_edited",
        ai_generated_at: input.aiGeneratedAt ?? null,
        saved_by_id: input.savedById ?? null,
        saved_by_name: input.savedByName ?? null,
      },
      {
        onConflict: "job_estimate_id,cost_code",
      }
    )
    .select("id")
    .single();

  if (itemError || !itemData) {
    throw new Error(itemError?.message ?? "Failed to save detailed estimate item.");
  }

  const detailedItemId = itemData.id;

  const { data: existingRows, error: existingRowsError } = await supabase
    .from("job_estimate_detailed_item_rows")
    .select("row_key")
    .eq("detailed_item_id", detailedItemId);

  if (existingRowsError) {
    throw new Error(existingRowsError.message);
  }

  const nextRowKeys = new Set(input.rows.map((row) => row.rowKey));
  const rowKeysToDelete = (existingRows ?? [])
    .map((row) => row.row_key as string)
    .filter((rowKey) => !nextRowKeys.has(rowKey));

  if (rowKeysToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("job_estimate_detailed_item_rows")
      .delete()
      .eq("detailed_item_id", detailedItemId)
      .in("row_key", rowKeysToDelete);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (input.rows.length > 0) {
    const { error: rowUpsertError } = await supabase
      .from("job_estimate_detailed_item_rows")
      .upsert(
        input.rows.map((row) => ({
          detailed_item_id: detailedItemId,
          row_key: row.rowKey,
          row_label: row.rowLabel,
          quantity: row.quantity,
          quantity_per_gfa: row.quantityPerGfa,
          unit: row.unit,
          material_cost_per_unit: row.materialCostPerUnit,
          labour_cost_per_unit: row.labourCostPerUnit,
          equipment_cost_per_unit: row.equipmentCostPerUnit,
          total_cost_per_unit: row.totalCostPerUnit,
          row_total: row.rowTotal,
          assumed_system: row.assumedSystem || null,
          assumptions: row.assumptions || null,
          confidence: row.confidence,
          status: row.status,
          sort_order: row.sortOrder,
        })),
        {
          onConflict: "detailed_item_id,row_key",
        }
      );

    if (rowUpsertError) {
      throw new Error(rowUpsertError.message);
    }
  }

  return detailedItemId;
}
