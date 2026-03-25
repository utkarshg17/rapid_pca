import { supabase } from "@/lib/supabase/client";
import type { PettyContractorRecord } from "@/features/projects/types/muster-roll";

export async function getPettyContractors(): Promise<PettyContractorRecord[]> {
  const { data, error } = await supabase
    .from("petty_contractor_database")
    .select("id, created_at, petty_contractor_name")
    .order("petty_contractor_name", { ascending: true });

  if (error) {
    console.error("Error fetching petty contractors:", error);
    return [];
  }

  return (data ?? []) as PettyContractorRecord[];
}
