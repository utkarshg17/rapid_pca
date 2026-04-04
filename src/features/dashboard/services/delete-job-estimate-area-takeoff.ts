import { supabase } from "@/lib/supabase/client";

export async function deleteJobEstimateAreaTakeoff(rowId: number) {
  const { error } = await supabase
    .from("job_estimate_area_takeoffs")
    .delete()
    .eq("id", rowId);

  if (error) {
    console.error("Error deleting area takeoff row:", error);
    throw new Error(error.message || "Failed to delete area takeoff row.");
  }
}
