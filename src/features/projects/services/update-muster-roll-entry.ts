import { supabase } from "@/lib/supabase/client";

type UpdateMusterRollEntryInput = {
  projectId: number;
  entryGroupId: string;
  createdByUserId: number;
  createdByUserName: string;
  rows: Array<{
    rowId: number;
    recordDate: string;
    pettyContractorId: number;
    pettyContractorName: string;
    crewName: string;
    crewType: string;
    regularHours: number;
    overtimeHours: number;
    rate: number;
  }>;
};

export async function updateMusterRollEntry(
  input: UpdateMusterRollEntryInput
) {
  const existingRows = input.rows.filter((row) => row.rowId > 0);
  const newRows = input.rows.filter((row) => row.rowId <= 0);

  const updateResults = await Promise.all(
    existingRows.map((row) =>
      supabase
        .from("muster_roll")
        .update({
          record_date: row.recordDate,
          petty_contractor_id: row.pettyContractorId,
          petty_contractor_name: row.pettyContractorName.trim(),
          crew_name: row.crewName.trim(),
          crew_type: row.crewType.trim(),
          regular_hours: row.regularHours,
          overtime_hours: row.overtimeHours,
          rate: row.rate,
        })
        .eq("id", row.rowId)
    )
  );

  const failedUpdateResult = updateResults.find((result) => result.error);

  if (failedUpdateResult?.error) {
    console.error("Error updating muster roll entry:", failedUpdateResult.error);
    throw new Error(
      failedUpdateResult.error.message || "Failed to update muster roll entry."
    );
  }

  if (newRows.length === 0) {
    return;
  }

  const insertPayload = newRows.map((row) => ({
    project_id: input.projectId,
    record_date: row.recordDate,
    petty_contractor_id: row.pettyContractorId,
    petty_contractor_name: row.pettyContractorName.trim(),
    crew_name: row.crewName.trim(),
    crew_type: row.crewType.trim(),
    regular_hours: row.regularHours,
    overtime_hours: row.overtimeHours,
    rate: row.rate,
    entry_group_id: input.entryGroupId,
    created_by_user_id: input.createdByUserId,
    created_by_user_name: input.createdByUserName,
  }));

  const { error } = await supabase.from("muster_roll").insert(insertPayload);

  if (error) {
    console.error("Error inserting new muster roll rows during edit:", error);
    throw new Error(error.message || "Failed to add new muster roll rows.");
  }
}
