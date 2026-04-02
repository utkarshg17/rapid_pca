import { supabase } from "@/lib/supabase/client";

export async function deleteProductionLogEntry(entryId: number) {
  const { error } = await supabase
    .from("production_log")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("Error deleting production log entry:", error);
    throw new Error(error.message || "Failed to delete production log entry.");
  }
}
