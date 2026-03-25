import { supabase } from "@/lib/supabase/client";
import type { PettyContractorRecord } from "@/features/projects/types/muster-roll";

function normalizePettyContractorName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function createPettyContractor(
  pettyContractorName: string
): Promise<PettyContractorRecord> {
  const normalizedName = normalizePettyContractorName(pettyContractorName);

  if (!normalizedName) {
    throw new Error("Petty contractor name is required.");
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("petty_contractor_database")
    .select("id")
    .ilike("petty_contractor_name", normalizedName)
    .limit(1);

  if (existingError) {
    console.error("Error checking petty contractor duplicates:", existingError);
    throw new Error(
      existingError.message || "Failed to validate petty contractor name."
    );
  }

  if ((existingRows ?? []).length > 0) {
    throw new Error("That petty contractor already exists.");
  }

  const { data, error } = await supabase
    .from("petty_contractor_database")
    .insert({
      petty_contractor_name: normalizedName,
    })
    .select("id, created_at, petty_contractor_name")
    .single();

  if (error) {
    console.error("Error creating petty contractor:", error);
    throw new Error(error.message || "Failed to create petty contractor.");
  }

  return data as PettyContractorRecord;
}
