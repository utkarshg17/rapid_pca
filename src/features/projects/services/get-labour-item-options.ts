import { supabase } from "@/lib/supabase/client";
import type { LabourItemOption } from "@/features/projects/types/labour-sheet";

export async function getLabourItemOptions(): Promise<LabourItemOption[]> {
  const { data, error } = await supabase
    .from("cost_code_database")
    .select("item, cost_code")
    .order("item", { ascending: true });

  if (error) {
    console.error("Error fetching labour item options:", error);
    return [];
  }

  const uniqueOptions = new Map<string, LabourItemOption>();

  (data ?? []).forEach((row) => {
    if (typeof row.item !== "string" || typeof row.cost_code !== "string") {
      return;
    }

    const key = `${row.item}::${row.cost_code}`;

    if (!uniqueOptions.has(key)) {
      uniqueOptions.set(key, {
        item: row.item,
        cost_code: row.cost_code,
      });
    }
  });

  return Array.from(uniqueOptions.values());
}
