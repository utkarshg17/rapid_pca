import { supabase } from "@/lib/supabase/client";

export async function deleteJobEstimateFinish(rowId: number) {
  const { error } = await supabase
    .from("job_estimate_finishes")
    .delete()
    .eq("id", rowId);

  if (error) {
    console.error("Error deleting finish row:", error);
    throw new Error(error.message || "Failed to delete finish row.");
  }
}
