import { supabase } from "@/lib/supabase/client";

export async function deleteMusterRollEntry(rowIds: number[]) {
  const { error } = await supabase
    .from("muster_roll")
    .delete()
    .in("id", rowIds);

  if (error) {
    console.error("Error deleting muster roll entry:", error);
    throw new Error(error.message || "Failed to delete muster roll entry.");
  }
}
