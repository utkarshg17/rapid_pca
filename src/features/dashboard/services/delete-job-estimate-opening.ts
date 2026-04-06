import { supabase } from "@/lib/supabase/client";

export async function deleteJobEstimateOpening(rowId: number) {
  const { error } = await supabase
    .from("job_estimate_openings")
    .delete()
    .eq("id", rowId);

  if (error) {
    console.error("Error deleting opening row:", error);
    throw new Error(error.message || "Failed to delete opening row.");
  }
}
