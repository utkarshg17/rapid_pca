import { supabase } from "@/lib/supabase/client";

export async function deleteUnitQuantityEntry(rowIds: number[]) {
  const { error } = await supabase
    .from("unit_quantities")
    .delete()
    .in("id", rowIds);

  if (error) {
    console.error("Error deleting unit quantity entry:", error);
    throw new Error(error.message || "Failed to delete unit quantity entry.");
  }
}
