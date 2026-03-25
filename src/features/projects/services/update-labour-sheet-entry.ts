import { supabase } from "@/lib/supabase/client";

type UpdateLabourSheetEntryInput = Array<{
  rowId: number;
  crewRole: string;
  crewCode: string;
  crewName: string;
  item: string;
  costCode: string;
  floor: number;
  zone: string;
  description: string;
}>;

export async function updateLabourSheetEntry(
  input: UpdateLabourSheetEntryInput
) {
  const updateResults = await Promise.all(
    input.map((row) =>
      supabase
        .from("labour_sheet")
        .update({
          crew_role: row.crewRole,
          crew_code: row.crewCode,
          crew_name: row.crewName.trim(),
          item: row.item,
          cost_code: row.costCode,
          floor: row.floor,
          zone: row.zone.trim(),
          description: row.description.trim(),
        })
        .eq("id", row.rowId)
    )
  );

  const failedResult = updateResults.find((result) => result.error);

  if (failedResult?.error) {
    console.error("Error updating labour sheet entry:", failedResult.error);
    throw new Error(
      failedResult.error.message || "Failed to update labour sheet entry."
    );
  }
}
