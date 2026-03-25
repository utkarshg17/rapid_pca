import { supabase } from "@/lib/supabase/client";

type CreateMusterRollEntryInput = {
  projectId: number;
  recordDate: string;
  createdByUserId: number;
  createdByUserName: string;
  rows: Array<{
    pettyContractorId: number;
    pettyContractorName: string;
    crewName: string;
    crewType: string;
    regularHours: number;
    overtimeHours: number;
    rate: number;
  }>;
};

export async function createMusterRollEntry(
  input: CreateMusterRollEntryInput
) {
  const entryGroupId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  const payload = input.rows.map((row) => ({
    project_id: input.projectId,
    record_date: input.recordDate,
    petty_contractor_id: row.pettyContractorId,
    petty_contractor_name: row.pettyContractorName.trim(),
    crew_name: row.crewName.trim(),
    crew_type: row.crewType.trim(),
    regular_hours: row.regularHours,
    overtime_hours: row.overtimeHours,
    rate: row.rate,
    entry_group_id: entryGroupId,
    created_by_user_id: input.createdByUserId,
    created_by_user_name: input.createdByUserName,
  }));

  const { error } = await supabase.from("muster_roll").insert(payload);

  if (error) {
    console.error("Error creating muster roll entry:", error);
    throw new Error(error.message || "Failed to save muster roll entry.");
  }
}
