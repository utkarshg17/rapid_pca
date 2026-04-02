import { supabase } from "@/lib/supabase/client";

export async function deletePettyContractor(id: number) {
  const { error } = await supabase
    .from("petty_contractor_database")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting petty contractor:", error);
    throw new Error(error.message || "Failed to delete petty contractor.");
  }
}
