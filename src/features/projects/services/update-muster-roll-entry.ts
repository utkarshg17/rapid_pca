import { supabase } from "@/lib/supabase/client";

type UpdateMusterRollEntryInput = Array<{
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

export async function updateMusterRollEntry(
  input: UpdateMusterRollEntryInput
) {
  const updateResults = await Promise.all(
    input.map((row) =>
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

  const failedResult = updateResults.find((result) => result.error);

  if (failedResult?.error) {
    console.error("Error updating muster roll entry:", failedResult.error);
    throw new Error(
      failedResult.error.message || "Failed to update muster roll entry."
    );
  }
}
