import { supabase } from "@/lib/supabase/client";
import type {
  UnitQuantityEntry,
  UnitQuantityRow,
} from "@/features/projects/types/unit-quantity";

function buildFallbackEntryGroupId(row: UnitQuantityRow) {
  return [
    row.project_id,
    row.item,
    row.floor,
    row.zone,
    row.created_by_user_id,
    row.created_at,
  ].join("::");
}

export async function getUnitQuantityEntries(
  projectId: number
): Promise<UnitQuantityEntry[]> {
  const { data, error } = await supabase
    .from("unit_quantities")
    .select(
      "id, created_at, project_id, project_name, cost_code, item, quantity_parameter, quantity, unit, floor, zone, created_by_user_id, created_by_user_name, entry_group_id"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching unit quantity entries:", error);
    return [];
  }

  const groupedEntries = new Map<string, UnitQuantityEntry>();

  ((data ?? []) as UnitQuantityRow[]).forEach((row) => {
    const entryGroupId = row.entry_group_id
      ? String(row.entry_group_id)
      : buildFallbackEntryGroupId(row);

    const existingEntry = groupedEntries.get(entryGroupId);

    if (existingEntry) {
      existingEntry.quantities.push({
        parameter: row.quantity_parameter,
        quantity: row.quantity,
        unit: row.unit,
      });
      return;
    }

    groupedEntries.set(entryGroupId, {
      entryGroupId,
      element: row.item,
      costCode: row.cost_code,
      floor: String(row.floor),
      zone: row.zone,
      createdAt: row.created_at,
      createdBy: row.created_by_user_name,
      quantities: [
        {
          parameter: row.quantity_parameter,
          quantity: row.quantity,
          unit: row.unit,
        },
      ],
    });
  });

  return Array.from(groupedEntries.values());
}
