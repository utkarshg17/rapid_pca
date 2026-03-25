import { supabase } from "@/lib/supabase/client";

type CreateLabourSheetEntryInput = {
  projectId: number;
  labourDate: string;
  createdByUserId: number;
  createdByUserName: string;
  rows: Array<{
    crewRole: string;
    crewCode: string;
    crewName: string;
    item: string;
    costCode: string;
    floor: number;
    zone: string;
    description: string;
  }>;
};

export async function createLabourSheetEntry(
  input: CreateLabourSheetEntryInput
) {
  const entryGroupId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  const payload = input.rows.map((row) => ({
    project_id: input.projectId,
    labour_date: input.labourDate,
    crew_role: row.crewRole,
    crew_code: row.crewCode,
    crew_name: row.crewName.trim(),
    item: row.item,
    cost_code: row.costCode,
    floor: row.floor,
    zone: row.zone.trim(),
    description: row.description.trim(),
    created_by_user_id: input.createdByUserId,
    created_by_user_name: input.createdByUserName,
    entry_group_id: entryGroupId,
  }));

  const { error } = await supabase.from("labour_sheet").insert(payload);

  if (error) {
    console.error("Error creating labour sheet entry:", error);
    throw new Error(error.message || "Failed to save labour sheet entry.");
  }
}
