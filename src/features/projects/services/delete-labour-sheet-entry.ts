import { supabase } from "@/lib/supabase/client";

export async function deleteLabourSheetEntry(rowIds: number[]) {
  const { error } = await supabase
    .from("labour_sheet")
    .delete()
    .in("id", rowIds);

  if (error) {
    console.error("Error deleting labour sheet entry:", error);
    throw new Error(error.message || "Failed to delete labour sheet entry.");
  }
}
