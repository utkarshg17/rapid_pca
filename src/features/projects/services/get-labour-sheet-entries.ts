import { supabase } from "@/lib/supabase/client";
import type {
  LabourSheetEntry,
  LabourSheetRow,
} from "@/features/projects/types/labour-sheet";

export async function getLabourSheetEntries(
  projectId: number
): Promise<LabourSheetEntry[]> {
  const { data, error } = await supabase
    .from("labour_sheet")
    .select(
      "id, created_at, project_id, labour_date, crew_role, crew_code, crew_name, item, cost_code, floor, zone, description, created_by_user_id, created_by_user_name, entry_group_id"
    )
    .eq("project_id", projectId)
    .order("labour_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching labour sheet entries:", error);
    return [];
  }

  const groupedEntries = new Map<string, LabourSheetEntry>();

  ((data ?? []) as LabourSheetRow[]).forEach((row) => {
    const entryGroupId = String(row.entry_group_id);
    const existingEntry = groupedEntries.get(entryGroupId);

    if (existingEntry) {
      existingEntry.rows.push({
        rowId: row.id,
        crewRole: row.crew_role,
        crewCode: row.crew_code,
        crewName: row.crew_name,
        item: row.item,
        costCode: row.cost_code,
        floor: String(row.floor),
        zone: row.zone,
        description: row.description,
      });
      return;
    }

    groupedEntries.set(entryGroupId, {
      id: row.id,
      createdAt: row.created_at,
      labourDate: row.labour_date,
      createdBy: row.created_by_user_name,
      entryGroupId,
      rows: [
        {
          rowId: row.id,
          crewRole: row.crew_role,
          crewCode: row.crew_code,
          crewName: row.crew_name,
          item: row.item,
          costCode: row.cost_code,
          floor: String(row.floor),
          zone: row.zone,
          description: row.description,
        },
      ],
    });
  });

  return Array.from(groupedEntries.values());
}
