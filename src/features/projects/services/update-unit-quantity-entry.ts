import { supabase } from "@/lib/supabase/client";

type UpdateUnitQuantityEntryInput = Array<{
  rowId: number;
  quantity: number;
}>;

export async function updateUnitQuantityEntry(
  input: UpdateUnitQuantityEntryInput
) {
  const updateResults = await Promise.all(
    input.map((row) =>
      supabase
        .from("unit_quantities")
        .update({ quantity: row.quantity })
        .eq("id", row.rowId)
    )
  );

  const failedResult = updateResults.find((result) => result.error);

  if (failedResult?.error) {
    console.error("Error updating unit quantity entry:", failedResult.error);
    throw new Error(
      failedResult.error.message || "Failed to update unit quantity entry."
    );
  }
}
