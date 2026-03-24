import { supabase } from "@/lib/supabase/client";

type CreateUnitQuantityEntryInput = {
  projectId: number;
  projectName: string;
  costCode: string;
  item: string;
  floor: number;
  zone: string;
  createdByUserId: number;
  createdByUserName: string;
  quantities: Array<{
    parameter: string;
    quantity: number;
    unitCost: number;
    unit: string;
  }>;
};

export async function createUnitQuantityEntry(
  input: CreateUnitQuantityEntryInput
) {
  const entryGroupId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  const payload = input.quantities.map((quantityRow) => ({
    project_id: input.projectId,
    project_name: input.projectName,
    cost_code: input.costCode,
    item: input.item,
    floor: input.floor,
    zone: input.zone.trim(),
    quantity_parameter: quantityRow.parameter,
    quantity: quantityRow.quantity,
    unit_cost: quantityRow.unitCost,
    unit: quantityRow.unit,
    created_by_user_id: input.createdByUserId,
    created_by_user_name: input.createdByUserName,
    entry_group_id: entryGroupId,
  }));

  const { error } = await supabase.from("unit_quantities").insert(payload);

  if (error) {
    console.error("Error creating unit quantity entry:", error);
    throw new Error(error.message || "Failed to save unit quantity entry.");
  }
}
