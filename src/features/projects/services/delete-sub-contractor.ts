import { supabase } from "@/lib/supabase/client";

export async function deleteSubContractor(id: number) {
  const { error } = await supabase
    .from("sub_contractor_database")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting sub-contractor:", error);
    throw new Error(error.message || "Failed to delete sub-contractor.");
  }
}
