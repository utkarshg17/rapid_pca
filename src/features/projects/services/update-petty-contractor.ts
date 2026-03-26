import { supabase } from "@/lib/supabase/client";
import type { PettyContractorRecord } from "@/features/projects/types/muster-roll";

function normalizePettyContractorName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function updatePettyContractor(input: {
  id: number;
  pettyContractorName: string;
  labourRate: number;
  masonRate: number;
}): Promise<PettyContractorRecord> {
  const normalizedName = normalizePettyContractorName(input.pettyContractorName);

  if (!normalizedName) {
    throw new Error("Petty contractor name is required.");
  }

  if (!Number.isFinite(input.labourRate) || input.labourRate < 0) {
    throw new Error("Labour rate must be a valid non-negative number.");
  }

  if (!Number.isFinite(input.masonRate) || input.masonRate < 0) {
    throw new Error("Mason rate must be a valid non-negative number.");
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("petty_contractor_database")
    .select("id")
    .ilike("petty_contractor_name", normalizedName)
    .neq("id", input.id)
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
    .update({
      petty_contractor_name: normalizedName,
      labour_rate: input.labourRate,
      mason_rate: input.masonRate,
    })
    .eq("id", input.id)
    .select("id, created_at, petty_contractor_name, labour_rate, mason_rate")
    .single();

  if (error) {
    console.error("Error updating petty contractor:", error);
    throw new Error(error.message || "Failed to update petty contractor.");
  }

  return data as PettyContractorRecord;
}
